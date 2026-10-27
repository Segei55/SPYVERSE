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
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8 select-none animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="relative border-y border-slate-700/80 py-7 sm:py-9">
        <div className="case-kicker mb-3 flex items-center gap-2">
          <span className="inline-block h-px w-8 bg-emerald-400/70" />
          <span>Отдел расследований · Дело № 001</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-[0.12em] text-slate-100 font-mono">
          SPYVERSE
        </h1>

        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mt-3 leading-relaxed">
          В деле есть неизвестная переменная: один из игроков не знает локацию. Задавайте вопросы, сопоставляйте показания и вычислите шпиона до конца раунда.
        </p>
      </div>

      {/* Main Choice Panels */}
      {mode === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* 1. Host Network Room */}
          <div className="case-surface bg-slate-900 border border-slate-700 hover:border-emerald-400/60 rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="case-index">01 / СЕТЕВАЯ ОПЕРАЦИЯ</span>
                <div className="w-10 h-10 rounded-lg bg-emerald-950/70 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <Wifi className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
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
              className="mt-6 w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Создать игру</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Join Network Room */}
          <div className="case-surface bg-slate-900 border border-slate-700 hover:border-cyan-400/60 rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="case-index">02 / ПОДКЛЮЧЕНИЕ</span>
                <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                <Users className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
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
              className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-slate-100 font-semibold rounded-lg text-xs uppercase tracking-wider transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
            >
              <span>Ввести код</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3. Pass & Play Offline */}
          <div className="case-surface bg-slate-900 border border-slate-700 hover:border-teal-400/60 rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="case-index">03 / ОДНО УСТРОЙСТВО</span>
                <div className="w-10 h-10 rounded-lg bg-teal-950/70 border border-teal-400/30 flex items-center justify-center text-teal-300">
                <Play className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100 group-hover:text-teal-300 transition-colors">
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
              className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-slate-100 font-semibold rounded-lg text-xs uppercase tracking-wider transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
            >
              <span>Играть локально</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mode: Create Room Form */}
      {mode === 'create' && (
        <div className="case-surface max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-300">
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
        <div className="case-surface max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-300">
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
