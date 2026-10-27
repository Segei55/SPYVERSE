import React, { useState } from 'react';
import { X, Volume2, Mic, Server, Globe, Check } from 'lucide-react';
import { sound } from '../utils/sound';
import { getStoredServerUrl, setStoredServerUrl } from '../utils/socket';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [volume, setVolume] = useState(sound.getVolume());
  const [isMuted, setIsMuted] = useState(sound.getIsMuted());
  const [serverUrl, setServerUrl] = useState(getStoredServerUrl());
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      window.location.reload();
      return;
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
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
        <div className="p-6 space-y-6">
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
            <p className="text-xs text-slate-400 leading-relaxed">
              Управление микрофоном и режим Push-To-Talk (удержание клавиши <strong>Пробел</strong>) доступны прямо на панели комнаты.
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
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
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
