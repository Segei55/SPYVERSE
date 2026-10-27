import React, { useState } from 'react';
import {
  Users,
  Play,
  Copy,
  Check,
  Crown,
  Settings,
  MessageSquare,
  Shield,
  Layers,
  Clock,
  Zap,
} from 'lucide-react';
import {
  GameSettings,
  LocationPack,
  Player,
  RoomState,
} from '../../packages/shared/src/index';
import { OFFICIAL_PACKS } from '../../packages/content/src/index';
import { sound } from '../utils/sound';

interface OnlineLobbyProps {
  roomState: RoomState;
  localPlayer: Player;
  customPacks: LocationPack[];
  onUpdateSettings: (settings: GameSettings) => void;
  onSetReady: (isReady: boolean) => void;
  onStartGame: () => void;
  onOpenChat: () => void;
  unreadChatCount?: number;
}

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({
  roomState,
  localPlayer,
  customPacks,
  onUpdateSettings,
  onSetReady,
  onStartGame,
  onOpenChat,
  unreadChatCount = 0,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const allPacks = [...OFFICIAL_PACKS, ...customPacks];

  const isHost = localPlayer.isHost;
  const players = roomState.players;
  const settings = roomState.settings;

  const copyRoomCode = () => {
    sound.playClick();
    navigator.clipboard.writeText(roomState.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePackChange = (packId: string) => {
    if (!isHost) return;
    sound.playClick();
    onUpdateSettings({
      ...settings,
      packIds: [packId],
    });
  };

  const handleDurationChange = (sec: number) => {
    if (!isHost) return;
    sound.playClick();
    onUpdateSettings({
      ...settings,
      roundDurationSeconds: sec,
    });
  };

  const handleSpyCountChange = (count: number) => {
    if (!isHost) return;
    sound.playClick();
    onUpdateSettings({
      ...settings,
      spyCount: count,
    });
  };

  const handleToggleModifiers = () => {
    if (!isHost) return;
    sound.playClick();
    onUpdateSettings({
      ...settings,
      enableModifiers: !settings.enableModifiers,
    });
  };

  const canStart = players.length >= 3;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 select-none">
      {/* Top Banner: Room Code & Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Shield className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block">
              КОД СЕКРЕТНОЙ КОМНАТЫ
            </span>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                {roomState.roomId}
              </span>
              <button
                onClick={copyRoomCode}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Скопировать код комнаты"
                aria-label="Скопировать код комнаты"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-300" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              sound.playClick();
              onOpenChat();
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer relative"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Чат комнаты</span>
            {unreadChatCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-1 -right-1" />
            )}
          </button>

          {!isHost && (
            <button
              onClick={() => {
                sound.playClick();
                onSetReady(!localPlayer.isReady);
              }}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                localPlayer.isReady
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              {localPlayer.isReady ? 'ГОТОВ' : 'НАЖМИТЕ: ГОТОВ'}
            </button>
          )}

          {isHost && (
            <button
              disabled={!canStart}
              onClick={() => {
                sound.playReveal();
                onStartGame();
              }}
              className="flex-1 sm:flex-initial px-8 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>НАЧАТЬ ПАРТИЮ</span>
            </button>
          )}
        </div>
      </div>

      {!canStart && isHost && (
        <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-xs text-amber-300 text-center">
          Ожидание участников: для начала партии требуется минимум 3 игрока (сейчас подключено {players.length}).
        </div>
      )}

      {/* Main Grid: Player Roster & Game Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Players Roster */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Участники в комнате ({players.length} из 16)</span>
            </h3>
            <span className="text-xs text-slate-500">Автосинхронизация</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p) => {
              const isSelf = p.id === localPlayer.id;
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    isSelf
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-md'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">
                      🕵️‍♂️
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">{p.name}</span>
                        {p.isHost && (
                          <span title="Хост комнаты">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] text-emerald-400 font-mono">(Вы)</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {p.isConnected ? 'В сети' : 'Не в сети'}
                      </span>
                    </div>
                  </div>

                  <div>
                    {p.isReady ? (
                      <span className="text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40">
                        Готов
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 px-2 py-0.5 rounded-full bg-slate-800">
                        Ожидание
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Параметры партии</span>
            </h3>
            {isHost ? (
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                Хост
              </span>
            ) : (
              <span className="text-[10px] uppercase text-slate-500">Только хост</span>
            )}
          </div>

          {/* Pack Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Набор локаций
            </label>
            <select
              disabled={!isHost}
              value={settings.packIds[0] || OFFICIAL_PACKS[0].id}
              onChange={(e) => handlePackChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-70"
            >
              {allPacks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.locations.length} лок.)
                </option>
              ))}
            </select>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Таймер раунда
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: '3м', sec: 180 },
                { label: '5м', sec: 300 },
                { label: '8м', sec: 480 },
                { label: '∞', sec: 0 },
              ].map((item) => (
                <button
                  key={item.sec}
                  disabled={!isHost}
                  type="button"
                  onClick={() => handleDurationChange(item.sec)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    settings.roundDurationSeconds === item.sec
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spies Count */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Число шпионов</span>
              <span className="text-rose-400 font-mono text-xs">{settings.spyCount}</span>
            </label>
            <div className="flex gap-2">
              {[1, 2].map((num) => (
                <button
                  key={num}
                  disabled={!isHost}
                  type="button"
                  onClick={() => handleSpyCountChange(num)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    settings.spyCount === num
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {num} {num === 1 ? 'шпион' : 'шпиона'}
                </button>
              ))}
            </div>
          </div>

          {/* Modifiers */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300">Модификаторы событий</span>
            </div>
            <button
              disabled={!isHost}
              type="button"
              onClick={handleToggleModifiers}
              className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                settings.enableModifiers ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.enableModifiers ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
