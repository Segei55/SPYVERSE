import React from 'react';
import { Volume2, VolumeX, Settings, Server, Shield, HelpCircle } from 'lucide-react';
import { sound } from '../utils/sound';

interface NavbarProps {
  onOpenSettings: () => void;
  onOpenServerGuide: () => void;
  onOpenPacks: () => void;
  isOnlineConnected?: boolean;
  serverUrl?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  onOpenServerGuide,
  onOpenPacks,
  isOnlineConnected,
  serverUrl,
}) => {
  const [isMuted, setIsMuted] = React.useState(sound.getIsMuted());

  const toggleSound = () => {
    const next = !isMuted;
    sound.setIsMuted(next);
    setIsMuted(next);
    if (!next) sound.playClick();
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
          <Shield className="w-5 h-5 text-slate-950 font-bold" />
        </div>
        <div>
          <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 font-mono">
            SPYVERSE
          </span>
          <span className="hidden sm:inline-block ml-2 text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-400">
            v1.0
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Connection status badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnlineConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span className="text-slate-400">
            {isOnlineConnected ? 'Сетевой сервер подключён' : 'Локальный режим'}
          </span>
        </div>

        {/* Content Packs Library */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenPacks();
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Библиотека и редактор наборов"
        >
          <span className="text-emerald-400 font-bold">19</span> Наборов
        </button>

        {/* Server & LAN guide */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenServerGuide();
          }}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
          title="Свой сервер и подключение друзей по LAN / VPN"
          aria-label="Свой сервер и руководство по сети"
        >
          <Server className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
          title={isMuted ? 'Включить звук' : 'Выключить звук'}
          aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenSettings();
          }}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
          title="Настройки"
          aria-label="Настройки игры"
        >
          <Settings className="w-4 h-4 text-slate-300" />
        </button>
      </div>
    </header>
  );
};
