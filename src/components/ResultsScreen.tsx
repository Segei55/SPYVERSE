import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, MapPin, Users, MessageSquare } from 'lucide-react';
import { GameState, Player } from '../../packages/shared/src/index';
import { sound } from '../utils/sound';

interface ResultsScreenProps {
  gameState: GameState;
  players: Player[];
  localPlayer: Player;
  onRematch: () => void;
  onOpenChat: () => void;
  unreadChatCount?: number;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  gameState,
  players,
  localPlayer,
  onRematch,
  onOpenChat,
  unreadChatCount = 0,
}) => {
  const winner = gameState.winner || 'civilians';
  const isCiviliansWin = winner === 'civilians';
  const revealedRoles = gameState.revealedRoles || {};

  useEffect(() => {
    if (isCiviliansWin) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      sound.playVictory();
    } else {
      sound.playAlarm();
    }
  }, [isCiviliansWin]);

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 select-none animate-in fade-in duration-300 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        {/* Trophy / Result Icon */}
        <div
          className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-xl ${
            isCiviliansWin
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          <Trophy className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Итоги раунда
          </span>
          <h2
            className={`text-3xl sm:text-4xl font-black mt-1 ${
              isCiviliansWin ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isCiviliansWin ? 'ПОБЕДА МИРНЫХ ЖИТЕЛЕЙ!' : 'ПОБЕДА ШПИОНОВ!'}
          </h2>
          <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto">
            {gameState.winReason === 'spy_guessed_location'
              ? 'Шпион раскрыл секретную локацию объекта!'
              : gameState.winReason === 'spy_wrong_guess'
              ? 'Шпион назвал неверную локацию и был обезврежен!'
              : gameState.winReason === 'civilians_wrong_vote'
              ? 'Игроки ошиблись и исключили невиновного мирного жителя.'
              : gameState.winReason === 'time_expired_spy_wins'
              ? 'Время раунда истекло, шпион остался нераскрытым.'
              : 'Шпион был успешно вычислен и арестован большинством голосов!'}
          </p>
        </div>

        {/* Secret Location Card */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-left flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5" />
              Секретная локация раунда:
            </span>
            <div className="text-xl sm:text-2xl font-black text-white">
              {gameState.secretLocationName || 'Засекречено'}
            </div>
          </div>
          <div className="text-2xl">📍</div>
        </div>

        {/* Roles of all players */}
        <div className="space-y-3 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Роли всех участников:</span>
          </h3>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {players.map((p) => {
              const roleInfo = revealedRoles[p.id];
              const isSpy = roleInfo?.isSpy;

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                    isSpy
                      ? 'bg-rose-950/40 border-rose-500/40'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{isSpy ? '🕵️‍♂️' : '👤'}</span>
                    <div>
                      <span className="font-bold text-white block">{p.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {roleInfo ? roleInfo.roleName : 'Роль не раскрыта'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-semibold px-2.5 py-1 rounded-lg text-[11px] ${
                      isSpy
                        ? 'bg-rose-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isSpy ? 'ШПИОН' : 'МИРНЫЙ'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {localPlayer.isHost ? (
            <button
              onClick={() => {
                sound.playClick();
                onRematch();
              }}
              className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-emerald-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Сыграть реванш (Новый раунд)</span>
            </button>
          ) : (
            <div className="flex-1 py-3 bg-slate-800/80 rounded-2xl text-xs text-slate-400 flex items-center justify-center">
              Ожидание решения хоста о новом раунде...
            </div>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onOpenChat();
            }}
            className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700 relative"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Чат</span>
            {unreadChatCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-1 -right-1" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
