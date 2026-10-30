import React, { useState } from 'react';
import {
  Clock,
  Sparkles,
  Vote,
  Target,
  MessageSquare,
  Mic,
} from 'lucide-react';
import {
  GameState,
  Player,
  PlayerSecret,
} from '../../packages/shared/src/index';
import { sound } from '../utils/sound';
import { ModifierEventCard } from './ModifierEventCard';

interface DiscussionScreenProps {
  gameState: GameState;
  players: Player[];
  localPlayer: Player;
  secret?: PlayerSecret | null;
  onCallAccusation: (accusedId: string) => void;
  onSpyEarlyGuess: () => void;
  onOpenChat: () => void;
  unreadChatCount?: number;
}

const QUESTION_PROMPTS = [
  'Что самое необычное вы видели на этом объекте?',
  'Какая здесь сейчас температура и чем здесь пахнет?',
  'Сколько денег вам нужно заплатить, чтобы вы остались здесь на ночь?',
  'Какая форма одежды или экипировка требуется на этом объекте?',
  'Как вы сюда добрались: пешком, на машине или на спецтранспорте?',
  'Кто из присутствующих здесь выглядит наименее подозрительно?',
  'Что самое опасное может произойти в этой локации?',
  'Если бы здесь отключили свет, что бы вы сделали в первую очередь?',
];

export const DiscussionScreen: React.FC<DiscussionScreenProps> = ({
  gameState,
  players,
  localPlayer,
  secret,
  onCallAccusation,
  onSpyEarlyGuess,
  onOpenChat,
  unreadChatCount = 0,
}) => {
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [isAccusingModalOpen, setIsAccusingModalOpen] = useState(false);
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>('');

  const timeLeft = gameState.roundTimeRemaining;
  const isTimeUnlimited = timeLeft <= 0;
  const modifier = gameState.currentModifier;
  const isTimerHidden = modifier?.type === 'radio_static' && timeLeft > 0 && timeLeft <= 30;

  const handlePromptClick = () => {
    sound.playClick();
    const rnd = QUESTION_PROMPTS[Math.floor(Math.random() * QUESTION_PROMPTS.length)];
    setCurrentPrompt(rnd);
  };

  const handleConfirmAccusation = () => {
    if (!selectedSuspectId) return;
    sound.playAlarm();
    onCallAccusation(selectedSuspectId);
    setIsAccusingModalOpen(false);
  };

  return (
    <div
      className={`max-w-4xl mx-auto p-4 sm:p-6 space-y-6 select-none animate-in fade-in duration-300 ${
        modifier?.type === 'blackout' ? 'brightness-75' : ''
      }`}
    >
      {/* Active Modifier Alert Banner */}
      {modifier && (
        <ModifierEventCard modifier={modifier} players={players} />
      )}

      {/* Big Timer Card */}
      <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 text-center space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>{isTimerHidden ? 'Радиопомехи: таймер скрыт' : 'Оставшееся время раунда'}</span>
        </div>

        <div
          className={`text-6xl sm:text-7xl font-mono font-black tracking-tight transition-colors ${
            !isTimerHidden && !isTimeUnlimited && timeLeft <= 30
              ? 'text-rose-400'
              : 'text-white'
          }`}
        >
          {isTimerHidden
            ? '??:??'
            : isTimeUnlimited
              ? '∞'
              : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
        </div>

        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Задавайте вопросы по очереди. Шпион не знает локацию и пытается подстроиться!
        </p>

        {/* Secret peek summary reminder badge */}
        {secret && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-300">
            <span className="text-slate-500">Ваша роль:</span>
            <span className={secret.isSpy ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {secret.roleName}
            </span>
            {!secret.isSpy && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-bold">{secret.locationName}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Players Speaking Grid */}
      <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>Участники допроса ({players.length})</span>
          </h3>
          <span className="text-[11px] text-slate-500">Зелёный индикатор = говорит</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {players.map((p) => {
            const isSelf = p.id === localPlayer.id;
            return (
              <div
                key={p.id}
                className={`p-3 rounded-2xl border transition-all text-center space-y-1.5 ${
                  p.isSpeaking
                    ? 'bg-emerald-500/15 border-emerald-400 ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="w-9 h-9 mx-auto rounded-md bg-slate-800 border border-slate-600 flex items-center justify-center text-xs font-mono font-semibold text-slate-300">
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="font-bold text-xs text-white truncate">
                  {p.name} {isSelf && <span className="text-emerald-400 font-normal">(Вы)</span>}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {p.isSpeaking ? 'Говорит...' : p.isMuted ? 'Микрофон выкл' : 'Слушает'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prompt Question Generator */}
      <div className="case-surface p-4 rounded-2xl bg-slate-900 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{currentPrompt || 'Нажмите кнопку, чтобы получить подсказку для каверзного вопроса.'}</span>
        </div>
        <button
          onClick={handlePromptClick}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors"
        >
          Подсказать вопрос
        </button>
      </div>

      {/* Main Action Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => {
            sound.playClick();
            setIsAccusingModalOpen(true);
          }}
          className="py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
        >
          <Vote className="w-4 h-4" />
          <span>Выдвинуть обвинение</span>
        </button>

        {secret?.isSpy && (
          <button
            onClick={() => {
              sound.playClick();
              onSpyEarlyGuess();
            }}
            className="py-3.5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-500/20"
          >
            <Target className="w-4 h-4" />
            <span>Я шпион (Назвать локацию)</span>
          </button>
        )}

        <button
          onClick={() => {
            sound.playClick();
            onOpenChat();
          }}
          className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700 relative"
        >
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span>Чат комнаты</span>
          {unreadChatCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-1 -right-1" />
          )}
        </button>
      </div>

      {/* Accusation Suspect Selection Modal */}
      {isAccusingModalOpen && (
        <div className="safe-area-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="text-center">
              <h3 className="text-lg font-black text-white">Выдвижение обвинения</h3>
              <p className="text-xs text-slate-400 mt-1">
                Кого вы подозреваете в шпионаже? Будет запущено всеобщее голосование.
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {players
                .filter((p) => p.id !== localPlayer.id)
                .map((p) => {
                  const isSel = selectedSuspectId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedSuspectId(p.id)}
                      className={`w-full p-3 rounded-2xl font-bold text-xs flex items-center justify-between border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {isSel ? 'Выбран подозреваемым' : 'Выбрать'}
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsAccusingModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Отмена
              </button>
              <button
                disabled={!selectedSuspectId}
                onClick={handleConfirmAccusation}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-rose-500/20"
              >
                Начать голосование
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
