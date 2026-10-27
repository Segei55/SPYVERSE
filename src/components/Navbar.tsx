import React from 'react';
import { Volume2, VolumeX, Settings, Server, Shield, FolderOpen } from 'lucide-react';
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
    <header className="mobile-navbar h-16 border-b border-slate-700/80 bg-slate-950/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-400/40 flex items-center justify-center">
          <Shield className="w-4 h-4 text-emerald-300 font-bold" />
        </div>
        <div>
          <span className="text-lg font-bold tracking-[0.18em] text-slate-100 font-mono">
            SPYVERSE
          </span>
          <span className="hidden sm:inline-block ml-2 text-[9px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded-sm bg-slate-900 border border-slate-700 text-slate-400">
            CASE FILE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
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
          className="px-2 sm:px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Библиотека и редактор наборов"
        >
          <FolderOpen className="h-4 w-4 text-emerald-400 sm:hidden" />
          <span className="hidden sm:inline"><span className="text-emerald-400 font-bold">19</span> Наборов</span>
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
