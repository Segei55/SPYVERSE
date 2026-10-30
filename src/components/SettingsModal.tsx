import React, { useEffect, useState } from 'react';
import { X, Volume2, Mic, Server, Globe, Check } from 'lucide-react';
import { sound } from '../utils/sound';
import { getStoredServerUrl, setStoredServerUrl } from '../utils/socket';
import { voiceManager } from '../utils/webrtc';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [volume, setVolume] = useState(sound.getVolume());
  const [isMuted, setIsMuted] = useState(sound.getIsMuted());
  const [serverUrl, setServerUrl] = useState(getStoredServerUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [micGain, setMicGain] = useState(voiceManager.getMicrophoneGain());
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevelDb, setMicLevelDb] = useState<number | null>(null);
  const [micTestError, setMicTestError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsTestingMic(false);
      setMicLevelDb(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isTestingMic) return;

    let active = true;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let animationFrame = 0;

    const stopTest = () => {
      active = false;
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close();
      }
    };

    const measureMicrophone = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Браузер не поддерживает доступ к микрофону.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        audioContext = new AudioContext();
        await audioContext.resume();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);

        const updateLevel = () => {
          if (!active) return;
          analyser.getFloatTimeDomainData(samples);
          let sumSquares = 0;
          for (const sample of samples) sumSquares += sample * sample;
          const rms = Math.sqrt(sumSquares / samples.length);
          const db = rms > 0 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms))) : -60;
          setMicLevelDb(db);
          animationFrame = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось запустить тест микрофона.';
        setMicTestError(message);
        setMicLevelDb(null);
        setIsTestingMic(false);
      }
    };

    setMicTestError(null);
    void measureMicrophone();
    return stopTest;
  }, [isOpen, isTestingMic]);

  if (!isOpen) return null;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    sound.setVolume(val);
    if (isMuted && val > 0) {
      setIsMuted(false);
      sound.setIsMuted(false);
    }
  };

  const handleSaveServer = () => {
    sound.playClick();
    const trimmed = serverUrl.trim();
    const changed = trimmed !== getStoredServerUrl();
    setStoredServerUrl(trimmed);
    if (changed) {
      // Socket привязан к адресу сервера при старте, поэтому перезагружаем клиент
      try {
        sessionStorage.setItem('spyverse_reopen_settings', 'true');
      } catch {}
      window.location.reload();
      return;
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="safe-area-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="case-surface flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Настройки SPYVERSE
          </h2>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Закрыть настройки"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-6">
          {/* Sound Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                Громкость эффектов
              </label>
              <span className="text-xs font-mono text-emerald-400">
                {isMuted ? 'Выкл' : `${Math.round(volume * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => sound.playReveal()}
                className="text-xs text-emerald-400 hover:underline cursor-pointer"
              >
                Проверить звук
              </button>
            </div>
          </div>

          {/* Dedicated Server IP / URL */}
          <div className="pt-4 border-t border-slate-800/80">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-1.5">
              <Server className="w-4 h-4 text-cyan-400" />
              Адрес сетевого сервера
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Оставьте пустым для встроенного сервера или укажите IP:порт друга (LAN, Hamachi, Radmin).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="http://192.168.1.50:3001"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <button
                onClick={handleSaveServer}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : 'Сохранить'}
              </button>
            </div>
          </div>

          {/* Voice Chat controls info */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">Голосовая связь WebRTC</h3>
            </div>
            <label className="mt-3 flex items-center justify-between text-xs text-slate-300">
              <span>Громкость микрофона</span>
              <span className="font-mono text-emerald-400">{Math.round(micGain * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={micGain}
              onChange={(event) => {
                const nextGain = Number(event.currentTarget.value);
                setMicGain(nextGain);
                voiceManager.setMicrophoneGain(nextGain);
              }}
              aria-label="Громкость микрофона"
              className="mt-2 w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex-1" role="meter" aria-label="Уровень микрофона в dBFS" aria-valuemin={-60} aria-valuemax={0} aria-valuenow={micLevelDb ?? -60}>
                <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                  <span>{micLevelDb === null ? 'Уровень микрофона' : `${Math.round(micLevelDb)} dBFS`}</span>
                  <span>0 dBFS</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-slate-700 bg-slate-950">
                  <div
                    className={`h-full rounded-full transition-[width] duration-75 ${
                      micLevelDb !== null && micLevelDb > -12 ? 'bg-rose-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${micLevelDb === null ? 0 : Math.max(2, ((micLevelDb + 60) / 60) * 100)}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMicLevelDb(null);
                  setIsTestingMic((testing) => !testing);
                }}
                className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                {isTestingMic ? 'Остановить тест' : 'Тест микрофона'}
              </button>
            </div>
            {isTestingMic && !micTestError && (
              <p className="mt-2 text-[10px] text-emerald-400" role="status">
                Проверка микрофона активна — произнесите что-нибудь.
              </p>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Шкала показывает уровень в dBFS относительно цифрового максимума (0 dBFS), а не физическую громкость в помещении.
            </p>
            {micTestError && <p role="alert" className="mt-2 text-xs text-rose-400">{micTestError}</p>}
            <p className="mt-2 text-[10px] text-slate-500">
              Управление микрофоном и Push-To-Talk (Пробел) также доступны на панели комнаты.
            </p>
          </div>

          {/* Language */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-slate-200">Язык интерфейса</span>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
              Русский (RU)
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-slate-800 bg-slate-950 p-4">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
