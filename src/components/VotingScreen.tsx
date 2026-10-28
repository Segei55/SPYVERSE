import React from 'react';
import { Vote, CheckCircle2, MessageSquare } from 'lucide-react';
import { GameState, Player } from '../../packages/shared/src/index';
import { sound } from '../utils/sound';

interface VotingScreenProps {
  gameState: GameState;
  players: Player[];
  localPlayer: Player;
  onCastVote: (targetId: string) => void;
  onOpenChat: () => void;
  unreadChatCount?: number;
}

export const VotingScreen: React.FC<VotingScreenProps> = ({
  gameState,
  players,
  localPlayer,
  onCastVote,
  onOpenChat,
  unreadChatCount = 0,
}) => {
  const isBlindVote = gameState.currentModifier?.type === 'blind_vote';
  const myVoteTargetId = localPlayer.voteTargetId;

  // Calculate vote counts for display (if not blind)
  const voteCounts: Record<string, number> = {};
  let totalCast = 0;
  for (const p of players) {
    if (p.voteTargetId) {
      voteCounts[p.voteTargetId] = (voteCounts[p.voteTargetId] || 0) + 1;
      totalCast++;
    }
  }

  const handleVote = (targetId: string) => {
    sound.playClick();
    onCastVote(targetId);
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-4 select-none animate-in fade-in duration-300">
      <button
        onClick={() => {
          sound.playClick();
          onOpenChat();
        }}
        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700 relative"
      >
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span>Чат комнаты</span>
        {unreadChatCount > 0 && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-2 right-3" />
        )}
      </button>
      <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 text-center">
        {/* Header */}
        <div className="space-y-1">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Vote className="w-7 h-7 text-emerald-400" />
          </div>
          <span className="case-kicker">
            {gameState.revoteCount > 0 ? 'ПОВТОРНОЕ ГОЛОСОВАНИЕ (НИЧЬЯ)' : 'ОБЩЕЕ ГОЛОСОВАНИЕ'}
          </span>
          <h2 className="text-2xl font-black text-white">Кто шпион?</h2>
          <p className="text-xs text-slate-400">
            Отдайте свой голос за игрока, которого считаете шпионом. Нельзя голосовать за себя.
          </p>
        </div>

        {/* Voting Progress */}
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Проголосовало:</span>
          <span className="text-emerald-400 font-bold">
            {totalCast} из {players.length}
          </span>
        </div>

        {/* Player Roster for Voting */}
        <div className="space-y-2.5 text-left">
          {players.map((p) => {
            const isSelf = p.id === localPlayer.id;
            const isSelected = myVoteTargetId === p.id;
            const count = voteCounts[p.id] || 0;

            return (
              <button
                key={p.id}
                disabled={isSelf}
                onClick={() => handleVote(p.id)}
                className={`w-full p-4 rounded-2xl border font-bold text-xs transition-all flex items-center justify-between cursor-pointer ${
                  isSelf
                    ? 'opacity-40 border-slate-800 bg-slate-950 text-slate-600'
                    : isSelected
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs font-mono font-semibold text-slate-300">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm text-white font-bold block">{p.name}</span>
                    {isSelf && (
                      <span className="text-[10px] text-slate-500 font-normal">Нельзя за себя</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isBlindVote && count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                      {count} {count === 1 ? 'голос' : 'голоса'}
                    </span>
                  )}

                  {isSelected ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ваш выбор</span>
                    </span>
                  ) : !isSelf ? (
                    <span className="text-xs text-slate-500 font-normal">Выбрать</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {myVoteTargetId && (
          <p className="text-xs text-emerald-400/90 italic">
            Голос отправлен! Ожидание остальных игроков...
          </p>
        )}
      </div>
    </div>
  );
};
