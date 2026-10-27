import React, { useState } from 'react';
import {
  Shield,
  Play,
  Users,
  Wifi,
  FolderOpen,
  Server,
  Settings,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { sound } from '../utils/sound';
import { OFFICIAL_PACKS } from '../../packages/content/src/index';

interface MainMenuProps {
  onCreateRoom: (hostName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onStartPassAndPlay: () => void;
  onOpenPacks: () => void;
  onOpenServerGuide: () => void;
  onOpenSettings: () => void;
  isConnecting?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onCreateRoom,
  onJoinRoom,
  onStartPassAndPlay,
  onOpenPacks,
  onOpenServerGuide,
  onOpenSettings,
  isConnecting = false,
}) => {
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem('spyverse_player_name') || 'Агент';
    } catch {
      return 'Агент';
    }
  });
  const [roomIdInput, setRoomIdInput] = useState('');

  const saveName = (name: string) => {
    setPlayerName(name);
    try {
      localStorage.setItem('spyverse_player_name', name);
    } catch {}
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    sound.playClick();
    onCreateRoom(playerName.trim());
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomIdInput.trim()) return;
    sound.playClick();
    onJoinRoom(roomIdInput.trim().toUpperCase(), playerName.trim());
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 select-none animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-semibold tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>СОЦИАЛЬНАЯ ИГРА В СТИЛЕ «ШПИОН» ДЛЯ ДРУЗЕЙ</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white font-mono">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            SPYVERSE
          </span>
        </h1>

        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Один из участников — шпион, не знающий секретную локацию. Задавайте наводящие вопросы, блефуйте, вычисляйте предателя или угадайте объект до конца раунда!
        </p>
      </div>

      {/* Main Choice Panels */}
      {mode === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* 1. Host Network Room */}
          <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all group shadow-xl">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Создать комнату
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Станьте хостом сетевой игры, настройте правила и пригласите друзей по коду комнаты.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                setMode('create');
              }}
              className="mt-6 w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <span>Создать игру</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Join Network Room */}
          <div className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all group shadow-xl">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                  Войти по коду
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Подключитесь к комнате хоста через локальную сеть, Hamachi или Radmin VPN.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                setMode('join');
              }}
              className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700/80"
            >
              <span>Ввести код</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3. Pass & Play Offline */}
          <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/50 rounded-3xl p-6 flex flex-col justify-between transition-all group shadow-xl">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-teal-400 transition-colors">
                  Офлайн (Один экран)
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Играйте за одним ПК или смартфоном, передавая устройство по кругу для просмотра ролей.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                onStartPassAndPlay();
              }}
              className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700/80"
            >
              <span>Играть локально</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mode: Create Room Form */}
      {mode === 'create' && (
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
          <div className="text-center">
            <h3 className="text-xl font-black text-white">Создание новой комнаты</h3>
            <p className="text-xs text-slate-400 mt-1">Вы будете хостом и сможете управлять настройками</p>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Ваш игровой позывной</label>
              <input
                type="text"
                required
                maxLength={24}
                value={playerName}
                onChange={(e) => saveName(e.target.value)}
                placeholder="Например: Нео, Бонд, Призрак"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={isConnecting}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {isConnecting ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mode: Join Room Form */}
      {mode === 'join' && (
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
          <div className="text-center">
            <h3 className="text-xl font-black text-white">Подключение к комнате</h3>
            <p className="text-xs text-slate-400 mt-1">Введите код комнаты, полученный от хоста</p>
          </div>

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Код комнаты (6 символов)</label>
              <input
                type="text"
                required
                maxLength={12}
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                placeholder="Например: SPY789"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-base font-mono font-bold tracking-widest text-center text-emerald-400 uppercase focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Ваше имя</label>
              <input
                type="text"
                required
                maxLength={24}
                value={playerName}
                onChange={(e) => saveName(e.target.value)}
                placeholder="Имя игрока"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={isConnecting}
                className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                {isConnecting ? 'Подключение...' : 'Войти'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Secondary Features Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
        <button
          onClick={() => {
            sound.playClick();
            onOpenPacks();
          }}
          className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3 cursor-pointer text-left"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-xs text-white block">{OFFICIAL_PACKS.length} Наборов локаций</span>
            <span className="text-[11px] text-slate-400">Редактор и импорт JSON</span>
          </div>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenServerGuide();
          }}
          className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3 cursor-pointer text-left"
        >
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-xs text-white block">Свой сервер / LAN</span>
            <span className="text-[11px] text-slate-400">Hamachi, Radmin, порты</span>
          </div>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenSettings();
          }}
          className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3 cursor-pointer text-left"
        >
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-xs text-white block">Настройки</span>
            <span className="text-[11px] text-slate-400">Звук, микрофон, IP</span>
          </div>
        </button>
      </div>
    </div>
  );
};
