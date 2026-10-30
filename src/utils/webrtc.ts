import { Socket } from 'socket.io-client';

export interface VoicePeer {
  id: string;
  stream?: MediaStream;
}

export type SpeakingCallback = (peerId: string, isSpeaking: boolean) => void;
export type VolumeCallback = (volume: number) => void;

interface VoiceSignalData {
  type: 'offer' | 'answer' | 'candidate';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export class WebRTCVoiceManager {
  private socket: Socket | null = null;
  private voiceSignalHandler: ((payload: { senderPeerId: string; signalData: VoiceSignalData }) => void) | null = null;
  private voiceIceServersHandler: ((iceServers: unknown) => void) | null = null;
  private localStream: MediaStream | null = null;
  private outgoingStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private pendingNegotiations: Set<string> = new Set();
  private negotiatingPeers: Set<string> = new Set();
  private signalQueues: Map<string, Promise<void>> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private iceRestartTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private iceRestartAttempts: Map<string, number> = new Map();
  private microphoneStartPromise: Promise<boolean> | null = null;
  private microphoneRequestId = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneGain: GainNode | null = null;
  private animFrameId: number | null = null;

  private isMuted: boolean = false;
  private isRoundMuted: boolean = false;
  private isPushToTalk: boolean = false;
  private isPttActive: boolean = false;
  private isSpeaking: boolean = false;
  private selectedInputDeviceId: string = '';
  private micGain = 1;
  private onSpeakingChange: SpeakingCallback | null = null;
  private onVolumeChange: VolumeCallback | null = null;
  private localPeerId: string | null = null;
  private targetPeerIds: string[] = [];

  private iceServers: RTCIceServer[] = [
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
    if (this.socket && this.voiceSignalHandler) {
      this.socket.off('voice_signal', this.voiceSignalHandler);
    }
    if (this.socket && this.voiceIceServersHandler) {
      this.socket.off('voice_ice_servers', this.voiceIceServersHandler);
    }
    this.socket = socket;
    this.onSpeakingChange = onSpeaking;
    this.onVolumeChange = onVolume;

    this.voiceSignalHandler = ({ senderPeerId, signalData }) => {
      void this.enqueueIncomingSignal(senderPeerId, signalData).catch((error) => {
        console.warn(`[WebRTC] Failed to process signal from ${senderPeerId}:`, error);
      });
    };
    this.socket.on('voice_signal', this.voiceSignalHandler);
    this.voiceIceServersHandler = (iceServers: unknown) => {
      if (!Array.isArray(iceServers) || !iceServers.every(this.isIceServer)) {
        console.warn('[WebRTC] Ignoring invalid ICE server configuration from server.');
        return;
      }
      this.iceServers = iceServers;
    };
    this.socket.on('voice_ice_servers', this.voiceIceServersHandler);
  }

  public async startMicrophone(): Promise<boolean> {
    if (this.localStream) return true;
    if (this.microphoneStartPromise) return this.microphoneStartPromise;

    const requestId = ++this.microphoneRequestId;
    const pendingStart = this.acquireMicrophone(requestId);
    this.microphoneStartPromise = pendingStart;
    try {
      return await pendingStart;
    } finally {
      if (this.microphoneStartPromise === pendingStart) {
        this.microphoneStartPromise = null;
      }
    }
  }

  private async acquireMicrophone(requestId: number): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This device or browser does not support microphone access.');
      }
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        ...(this.selectedInputDeviceId ? { deviceId: { exact: this.selectedInputDeviceId } } : {}),
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      } catch (error) {
        const errorName = error instanceof DOMException ? error.name : '';
        if (
          !this.selectedInputDeviceId ||
          (errorName !== 'OverconstrainedError' && errorName !== 'NotFoundError')
        ) {
          throw error;
        }
        console.warn('[WebRTC] Selected microphone is unavailable; falling back to the default device.');
        this.selectedInputDeviceId = '';
        try {
          localStorage.removeItem('spyverse_voice_device');
        } catch {}
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
      }

      if (requestId !== this.microphoneRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.localStream = stream;

      // Setup audio analyzer for volume detection & speaking indicator
      this.setupVolumeAnalyzer();
      if (this.audioContext?.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (error) {
          console.warn('[WebRTC] Audio analyzer could not resume; using the microphone stream directly:', error);
          this.disableVolumeAnalyzer();
        }
      }
      this.updateTrackState();

      // Если состав комнаты уже известен, создаём соединения с участниками
      if (this.localPeerId) {
        this.syncPeers(this.localPeerId, this.targetPeerIds);
      }
      await this.attachLocalTracksToPeers();

      return true;
    } catch (err) {
      console.warn('[WebRTC] Microphone access denied or unavailable:', err);
      this.localStream?.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.outgoingStream?.getTracks().forEach((track) => track.stop());
      this.outgoingStream = null;
      if (this.audioContext && this.audioContext.state !== 'closed') {
        void this.audioContext.close().catch((closeError) => {
          console.warn('[WebRTC] Failed to close audio context after microphone error:', closeError);
        });
      }
      this.audioContext = null;
      this.analyser = null;
      this.microphoneGain = null;
      return false;
    }
  }

  public stopMicrophone(): void {
    this.microphoneRequestId++;
    this.microphoneStartPromise = null;
    if (this.animFrameId !== null) {
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
      void this.audioContext.close().catch((error) => {
        console.warn('[WebRTC] Failed to close audio context:', error);
      });
      this.audioContext = null;
    }
    this.analyser = null;
    this.microphoneGain = null;
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.pendingNegotiations.clear();
    this.negotiatingPeers.clear();
    this.signalQueues.clear();
    for (const timer of this.iceRestartTimers.values()) {
      clearTimeout(timer);
    }
    this.iceRestartTimers.clear();
    this.iceRestartAttempts.clear();
    for (const audio of this.remoteAudioElements.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    this.remoteAudioElements.clear();
  }

  private setupVolumeAnalyzer(): void {
    if (!this.localStream) return;
    try {
      if (this.animFrameId !== null) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        void this.audioContext.close().catch((error) => {
          console.warn('[WebRTC] Failed to replace audio context:', error);
        });
      }
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

        const voiceEnabled =
          !this.isMuted && !this.isRoundMuted && (!this.isPushToTalk || this.isPttActive);
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
                isMuted: this.isMuted || this.isRoundMuted,
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
      this.disableVolumeAnalyzer();
    }
  }

  private disableVolumeAnalyzer(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.analyser = null;
    this.microphoneGain = null;
    this.outgoingStream?.getTracks().forEach((track) => track.stop());
    this.outgoingStream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close().catch((error) => {
        console.warn('[WebRTC] Failed to close unavailable audio analyzer:', error);
      });
    }
    this.audioContext = null;
  }

  private isIceServer(value: unknown): value is RTCIceServer {
    if (!value || typeof value !== 'object') return false;
    const server = value as { urls?: unknown; username?: unknown; credential?: unknown };
    const hasUrls =
      (typeof server.urls === 'string' && server.urls.length > 0) ||
      (Array.isArray(server.urls) &&
        server.urls.length > 0 &&
        server.urls.every((url) => typeof url === 'string' && url.length > 0));
    return (
      hasUrls &&
      (server.username === undefined || typeof server.username === 'string') &&
      (server.credential === undefined || typeof server.credential === 'string')
    );
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
        isMuted: this.isMuted || this.isRoundMuted,
        isSpeaking: false,
      });
    }
  }

  public setRoundMuted(muted: boolean): void {
    if (this.isRoundMuted === muted) return;
    this.isRoundMuted = muted;
    this.isSpeaking = false;
    this.updateTrackState();
    if (this.socket) {
      this.socket.emit('voice_state_update', {
        isMuted: this.isMuted || this.isRoundMuted,
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
    const shouldEnable =
      !this.isMuted && !this.isRoundMuted && (!this.isPushToTalk || this.isPttActive);
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

    for (const peerId of Array.from(this.peerConnections.keys())) {
      if (!peerIds.includes(peerId)) {
        this.removePeer(peerId);
      }
    }

    for (const peerId of peerIds) {
      if (peerId !== localPeerId && localPeerId < peerId) {
        void this.connectToPeer(peerId).catch((error) => {
          console.warn(`[WebRTC] Failed to create connection to ${peerId}:`, error);
        });
      }
    }
  }

  public async connectToPeer(targetPeerId: string): Promise<void> {
    if (this.peerConnections.has(targetPeerId)) return;

    try {
      this.createPeerConnection(targetPeerId);
      this.pendingNegotiations.add(targetPeerId);
      await this.createPendingOffer(targetPeerId);
    } catch (error) {
      this.removePeer(targetPeerId);
      throw error;
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(peerId, pc);

    if (this.localStream) {
      const stream = this.outgoingStream ?? this.localStream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.peerConnections.get(peerId) === pc) {
        this.socket.emit('voice_signal', {
          targetPeerId: peerId,
          signalData: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      let audio = this.remoteAudioElements.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.remoteAudioElements.set(peerId, audio);
      }
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void audio.play().catch((error: unknown) => {
        console.warn(`[WebRTC] Could not play remote audio from ${peerId}:`, error);
      });
    };

    pc.onconnectionstatechange = () => {
      if (this.peerConnections.get(peerId) !== pc) return;
      if (pc.connectionState === 'connected') {
        this.clearIceRestart(peerId);
      } else if (pc.connectionState === 'failed') {
        this.scheduleIceRestart(peerId, pc, 500);
      } else if (pc.connectionState === 'disconnected') {
        this.scheduleIceRestart(peerId, pc, 3000);
      }
    };

    return pc;
  }

  public unlockRemoteAudio(): void {
    for (const [peerId, audio] of this.remoteAudioElements) {
      if (audio.paused && audio.srcObject) {
        void audio.play().catch((error: unknown) => {
          console.warn(`[WebRTC] Could not resume remote audio from ${peerId}:`, error);
        });
      }
    }
  }

  private scheduleIceRestart(peerId: string, pc: RTCPeerConnection, delay: number): void {
    if (!this.localPeerId || this.localPeerId > peerId || this.iceRestartTimers.has(peerId)) return;
    const timer = setTimeout(() => {
      this.iceRestartTimers.delete(peerId);
      if (
        this.peerConnections.get(peerId) !== pc ||
        (pc.connectionState !== 'failed' && pc.connectionState !== 'disconnected')
      ) {
        return;
      }
      const attempts = this.iceRestartAttempts.get(peerId) ?? 0;
      if (attempts >= 5) {
        console.warn(`[WebRTC] Could not restore connection with ${peerId} after ${attempts} ICE restarts.`);
        return;
      }
      this.iceRestartAttempts.set(peerId, attempts + 1);
      try {
        pc.restartIce();
        this.pendingNegotiations.add(peerId);
        void this.createPendingOffer(peerId).catch((error) => {
          console.warn(`[WebRTC] ICE restart negotiation failed for ${peerId}:`, error);
          this.scheduleIceRestart(peerId, pc, Math.min(15000, 1000 * 2 ** attempts));
        });
      } catch (error) {
        console.warn(`[WebRTC] ICE restart failed for ${peerId}:`, error);
        this.scheduleIceRestart(peerId, pc, Math.min(15000, 1000 * 2 ** attempts));
      }
    }, delay);
    this.iceRestartTimers.set(peerId, timer);
  }

  private clearIceRestart(peerId: string): void {
    const timer = this.iceRestartTimers.get(peerId);
    if (timer !== undefined) clearTimeout(timer);
    this.iceRestartTimers.delete(peerId);
    this.iceRestartAttempts.delete(peerId);
  }

  private async handleIncomingSignal(senderPeerId: string, signalData: VoiceSignalData): Promise<void> {
    if (this.localPeerId && !this.targetPeerIds.includes(senderPeerId)) return;

    if (signalData.type === 'candidate' && signalData.candidate) {
      const pc = this.peerConnections.get(senderPeerId);
      if (!pc || !pc.remoteDescription) {
        const candidates = this.pendingCandidates.get(senderPeerId) ?? [];
        candidates.push(signalData.candidate);
        this.pendingCandidates.set(senderPeerId, candidates);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      return;
    }

    let pc = this.peerConnections.get(senderPeerId);
    if (signalData.type === 'offer' && signalData.offer) {
      pc ??= this.createPeerConnection(senderPeerId);
      if (pc.signalingState !== 'stable') {
        if (this.localPeerId && this.localPeerId < senderPeerId) {
          console.warn(`[WebRTC] Ignoring colliding offer from ${senderPeerId}.`);
          return;
        }
        await pc.setLocalDescription({ type: 'rollback' });
      }
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
      await this.flushPendingCandidates(senderPeerId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket?.emit('voice_signal', {
        targetPeerId: senderPeerId,
        signalData: { type: 'answer', answer: pc.localDescription },
      });
      await this.createPendingOffer(senderPeerId);
    } else if (signalData.type === 'answer' && signalData.answer) {
      if (!pc) {
        console.warn(`[WebRTC] Received an answer from unknown peer ${senderPeerId}.`);
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
      await this.flushPendingCandidates(senderPeerId, pc);
      await this.createPendingOffer(senderPeerId);
    }
  }

  private async enqueueIncomingSignal(senderPeerId: string, signalData: VoiceSignalData): Promise<void> {
    const previous = this.signalQueues.get(senderPeerId) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.handleIncomingSignal(senderPeerId, signalData));
    this.signalQueues.set(senderPeerId, current);
    try {
      await current;
    } finally {
      if (this.signalQueues.get(senderPeerId) === current) {
        this.signalQueues.delete(senderPeerId);
      }
    }
  }

  private async createPendingOffer(peerId: string): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (
      !pc ||
      !this.pendingNegotiations.has(peerId) ||
      this.negotiatingPeers.has(peerId) ||
      pc.signalingState !== 'stable'
    ) {
      return;
    }

    this.pendingNegotiations.delete(peerId);
    this.negotiatingPeers.add(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket?.emit('voice_signal', {
        targetPeerId: peerId,
        signalData: { type: 'offer', offer: pc.localDescription },
      });
    } catch (error) {
      this.pendingNegotiations.add(peerId);
      throw error;
    } finally {
      this.negotiatingPeers.delete(peerId);
    }
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const candidates = this.pendingCandidates.get(peerId);
    if (!candidates) return;
    this.pendingCandidates.delete(peerId);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn(`[WebRTC] Ignoring invalid ICE candidate from ${peerId}:`, error);
      }
    }
  }

  private async attachLocalTracksToPeers(): Promise<void> {
    if (!this.localStream) return;
    const stream = this.outgoingStream ?? this.localStream;
    const [track] = stream.getAudioTracks();
    if (!track) return;

    for (const [peerId, pc] of this.peerConnections) {
      try {
        const audioTransceiver = pc.getTransceivers().find(
          (transceiver) => transceiver.receiver.track.kind === 'audio'
        );
        if (audioTransceiver?.sender.track === track) continue;
        if (audioTransceiver) {
          await audioTransceiver.sender.replaceTrack(track);
          audioTransceiver.direction = 'sendrecv';
        } else {
          pc.addTrack(track, stream);
        }
        this.pendingNegotiations.add(peerId);
        await this.createPendingOffer(peerId);
      } catch (error) {
        console.warn(`[WebRTC] Failed to add microphone to connection with ${peerId}:`, error);
      }
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
    this.pendingCandidates.delete(peerId);
    this.pendingNegotiations.delete(peerId);
    this.negotiatingPeers.delete(peerId);
    this.clearIceRestart(peerId);
    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.remoteAudioElements.delete(peerId);
    }
  }
}

export const voiceManager = new WebRTCVoiceManager();
