import { Socket } from 'socket.io-client';

export interface VoicePeer {
  id: string;
  stream?: MediaStream;
}

export type SpeakingCallback = (peerId: string, isSpeaking: boolean) => void;
export type VolumeCallback = (volume: number) => void;

export class WebRTCVoiceManager {
  private socket: Socket | null = null;
  private localStream: MediaStream | null = null;
  private outgoingStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneGain: GainNode | null = null;
  private animFrameId: number | null = null;

  private isMuted: boolean = false;
  private isPushToTalk: boolean = false;
  private isPttActive: boolean = false;
  private isSpeaking: boolean = false;
  private selectedInputDeviceId: string = '';
  private micGain = 1;
  private onSpeakingChange: SpeakingCallback | null = null;
  private onVolumeChange: VolumeCallback | null = null;
  private localPeerId: string | null = null;
  private targetPeerIds: string[] = [];

  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  constructor() {
    try {
      const savedMute = localStorage.getItem('spyverse_voice_muted');
      if (savedMute !== null) this.isMuted = savedMute === 'true';
      const savedPtt = localStorage.getItem('spyverse_voice_ptt');
      if (savedPtt !== null) this.isPushToTalk = savedPtt === 'true';
      const savedDev = localStorage.getItem('spyverse_voice_device');
      if (savedDev) this.selectedInputDeviceId = savedDev;
      const savedGain = localStorage.getItem('spyverse_mic_gain');
      if (savedGain !== null) {
        const parsedGain = Number(savedGain);
        if (Number.isFinite(parsedGain)) this.micGain = Math.max(0, Math.min(2, parsedGain));
      }
    } catch {}
  }

  public init(socket: Socket, onSpeaking: SpeakingCallback, onVolume: VolumeCallback): void {
    this.socket = socket;
    this.onSpeakingChange = onSpeaking;
    this.onVolumeChange = onVolume;

    // Listen for incoming WebRTC signaling
    this.socket.on('voice_signal', async ({ senderPeerId, signalData }) => {
      await this.handleIncomingSignal(senderPeerId, signalData);
    });
  }

  public async startMicrophone(): Promise<boolean> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: this.selectedInputDeviceId
          ? { deviceId: { exact: this.selectedInputDeviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
        video: false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Setup audio analyzer for volume detection & speaking indicator
      this.setupVolumeAnalyzer();
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.updateTrackState();

      // Если состав комнаты уже известен, создаём соединения с участниками
      if (this.localPeerId) {
        this.syncPeers(this.localPeerId, this.targetPeerIds);
      }

      return true;
    } catch (err) {
      console.warn('[WebRTC] Microphone access denied or unavailable:', err);
      this.localStream?.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.outgoingStream?.getTracks().forEach((track) => track.stop());
      this.outgoingStream = null;
      if (this.audioContext && this.audioContext.state !== 'closed') {
        void this.audioContext.close();
      }
      this.audioContext = null;
      this.analyser = null;
      this.microphoneGain = null;
      return false;
    }
  }

  public stopMicrophone(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.outgoingStream) {
      this.outgoingStream.getTracks().forEach((track) => track.stop());
      this.outgoingStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.microphoneGain = null;
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();
  }

  private setupVolumeAnalyzer(): void {
    if (!this.localStream) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphoneGain = this.audioContext.createGain();
      this.microphoneGain.gain.value = this.micGain;
      const output = this.audioContext.createMediaStreamDestination();
      source.connect(this.microphoneGain);
      this.microphoneGain.connect(this.analyser);
      this.microphoneGain.connect(output);
      this.outgoingStream = output.stream;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingCandidateSince = 0;
      let speakingCandidate: boolean | null = null;

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalizedVolume = Math.min(100, Math.round((avg / 128) * 100));

        if (this.onVolumeChange) {
          this.onVolumeChange(normalizedVolume);
        }

        const voiceEnabled = !this.isMuted && (!this.isPushToTalk || this.isPttActive);
        const isSpeakingNow = voiceEnabled && normalizedVolume > (this.isSpeaking ? 10 : 20);
        if (isSpeakingNow !== this.isSpeaking) {
          if (speakingCandidate !== isSpeakingNow) {
            speakingCandidate = isSpeakingNow;
            speakingCandidateSince = performance.now();
          } else if (performance.now() - speakingCandidateSince >= (isSpeakingNow ? 200 : 450)) {
            this.isSpeaking = isSpeakingNow;
            speakingCandidate = null;
            if (this.socket) {
              this.socket.emit('voice_state_update', {
                isMuted: this.isMuted,
                isSpeaking: isSpeakingNow,
              });
            }
          }
        } else {
          speakingCandidate = null;
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('[WebRTC] Analyzer init error:', err);
      throw err;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.isSpeaking = false;
    try {
      localStorage.setItem('spyverse_voice_muted', muted.toString());
    } catch {}
    this.updateTrackState();
    if (this.socket) {
      this.socket.emit('voice_state_update', {
        isMuted: this.isMuted,
        isSpeaking: false,
      });
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getMicrophoneGain(): number {
    return this.micGain;
  }

  public setMicrophoneGain(gain: number): void {
    this.micGain = Math.max(0, Math.min(2, gain));
    try {
      localStorage.setItem('spyverse_mic_gain', this.micGain.toString());
    } catch {}
    if (this.microphoneGain && this.audioContext) {
      this.microphoneGain.gain.setTargetAtTime(this.micGain, this.audioContext.currentTime, 0.02);
    }
  }

  public setPushToTalk(enabled: boolean): void {
    this.isPushToTalk = enabled;
    try {
      localStorage.setItem('spyverse_voice_ptt', enabled.toString());
    } catch {}
    this.updateTrackState();
  }

  public getIsPushToTalk(): boolean {
    return this.isPushToTalk;
  }

  public setPttActive(active: boolean): void {
    if (this.isPttActive === active) return;
    this.isPttActive = active;
    this.updateTrackState();
  }

  private updateTrackState(): void {
    if (!this.localStream) return;
    const shouldEnable = !this.isMuted && (!this.isPushToTalk || this.isPttActive);
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    (this.outgoingStream ?? this.localStream).getAudioTracks().forEach((track) => {
      track.enabled = shouldEnable;
    });
  }

  /**
   * Синхронизирует P2P-соединения (mesh) с участниками комнаты.
   * Offer создаёт игрок с меньшим ID, поэтому встречных предложений не возникает.
   */
  public syncPeers(localPeerId: string, peerIds: string[]): void {
    this.localPeerId = localPeerId;
    this.targetPeerIds = peerIds;

    // Без микрофона соединения создаются после его включения
    if (!this.localStream) return;

    for (const peerId of Array.from(this.peerConnections.keys())) {
      if (!peerIds.includes(peerId)) {
        this.removePeer(peerId);
      }
    }

    for (const peerId of peerIds) {
      if (peerId !== localPeerId && localPeerId < peerId) {
        void this.connectToPeer(peerId);
      }
    }
  }

  public async connectToPeer(targetPeerId: string): Promise<void> {
    if (this.peerConnections.has(targetPeerId)) return;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(targetPeerId, pc);

    if (this.localStream) {
      const stream = this.outgoingStream ?? this.localStream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('voice_signal', {
          targetPeerId,
          signalData: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteAudio = new Audio();
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.autoplay = true;
      remoteAudio.play().catch(() => {});
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (this.socket) {
      this.socket.emit('voice_signal', {
        targetPeerId,
        signalData: { type: 'offer', offer },
      });
    }
  }

  private async handleIncomingSignal(senderPeerId: string, signalData: { type: string; offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }): Promise<void> {
    let pc = this.peerConnections.get(senderPeerId);

    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: this.iceServers });
      this.peerConnections.set(senderPeerId, pc);

      if (this.localStream) {
        const stream = this.outgoingStream ?? this.localStream;
        stream.getTracks().forEach((track) => pc!.addTrack(track, stream));
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          this.socket.emit('voice_signal', {
            targetPeerId: senderPeerId,
            signalData: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        remoteAudio.play().catch(() => {});
      };
    }

    if (signalData.type === 'offer' && signalData.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.socket) {
        this.socket.emit('voice_signal', {
          targetPeerId: senderPeerId,
          signalData: { type: 'answer', answer },
        });
      }
    } else if (signalData.type === 'answer' && signalData.answer) {
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
    } else if (signalData.type === 'candidate' && signalData.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
    }
  }

  /** Закрывает все голосовые соединения (например, при выходе из комнаты). */
  public disconnectAllPeers(): void {
    for (const peerId of Array.from(this.peerConnections.keys())) {
      this.removePeer(peerId);
    }
    this.localPeerId = null;
    this.targetPeerIds = [];
  }

  public removePeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
  }
}

export const voiceManager = new WebRTCVoiceManager();
