import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  RotateCcw,
  Eye,
  EyeOff,
  Clock,
  HelpCircle,
  Vote,
  Target,
  Trophy,
  ArrowRight,
  ShieldAlert,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  GameSettings,
  GameModifier,
  LocationPack,
  Player,
  PlayerSecret,
  WinReason,
} from '../../packages/shared/src/index';
import { OFFICIAL_PACKS } from '../../packages/content/src/index';
import {
  assignRoles,
  AVAILABLE_MODIFIERS,
  calculateVoteResults,
  checkSpyGuess,
} from '../../packages/game-engine/src/index';
import { sound } from '../utils/sound';

interface PassAndPlayProps {
  customPacks: LocationPack[];
  onBackToMenu: () => void;
}

const QUESTION_PROMPTS = [
  'Что самое странное вы видели в этом месте за последний час?',
  'Какая здесь сейчас температура и чем здесь пахнет?',
  'Сколько денег вам нужно заплатить, чтобы вы остались здесь на ночь?',
  'Как вы сюда добрались: пешком, на транспорте или телепортом?',
  'Какая форма одежды или экипировка требуется на этом объекте?',
  'Если бы здесь начался пожар, куда бы вы побежали в первую очередь?',
  'Кто из присутствующих здесь выглядит наименее подозрительно?',
  'Что самое дорогое можно купить или украсть в этом месте?',
];

export const PassAndPlay: React.FC<PassAndPlayProps> = ({ customPacks, onBackToMenu }) => {
  // Game setup state
  const [phase, setPhase] = useState<
    'setup' | 'handover' | 'revealed' | 'discussion' | 'voting' | 'spy_guess' | 'results'
  >('setup');

  const allPacks = [...OFFICIAL_PACKS, ...customPacks];
  const [selectedPackId, setSelectedPackId] = useState<string>(OFFICIAL_PACKS[0].id);
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [playerNames, setPlayerNames] = useState<string[]>([
    'Агент 1',
    'Агент 2',
    'Агент 3',
    'Агент 4',
  ]);
  const [roundDuration, setRoundDuration] = useState<number>(300); // 5 min
  const [customDurationMinutes, setCustomDurationMinutes] = useState('5');
  const [spyCount, setSpyCount] = useState<number>(1);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>(
    () => AVAILABLE_MODIFIERS.map((modifier) => modifier.id)
  );
  const [currentModifier, setCurrentModifier] = useState<GameModifier | null>(null);

  // Runtime state
  const [currentHandoverIndex, setCurrentHandoverIndex] = useState<number>(0);
  const [secrets, setSecrets] = useState<Record<string, PlayerSecret>>({});
  const [secretLocation, setSecretLocation] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const isTimerHidden = currentModifier?.type === 'radio_static' && timeLeft > 0 && timeLeft <= 30;
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [votes, setVotes] = useState<Record<string, string>>({}); // voterId -> targetId
  const [currentVoterIndex, setCurrentVoterIndex] = useState<number>(0);
  const [accusedSpyId, setAccusedSpyId] = useState<string | null>(null);
  const [spySearch, setSpySearch] = useState<string>('');
  const [winner, setWinner] = useState<'civilians' | 'spies' | null>(null);
  const [winReasonText, setWinReasonText] = useState<string>('');

  useEffect(() => {
    setCustomDurationMinutes(roundDuration > 0 ? String(roundDuration / 60) : '');
  }, [roundDuration]);

  // Handle player count change
  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    const newNames = Array.from({ length: count }, (_, i) => playerNames[i] || `Агент ${i + 1}`);
    setPlayerNames(newNames);
    const maxSpies = Math.max(1, Math.floor((count - 1) / 2));
    if (spyCount > maxSpies) setSpyCount(maxSpies);
  };

  // Timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'discussion' && !isPaused && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            sound.playAlarm();
            setPhase('voting');
            return 0;
          }
          if (prev <= 10) sound.playTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase, isPaused, timeLeft]);

  // Start Offline Game
  const handleStartGame = () => {
    sound.playClick();
    const pack = allPacks.find((p) => p.id === selectedPackId) || OFFICIAL_PACKS[0];
    const players: Player[] = playerNames.map((name, i) => ({
      id: `offline_p_${i}`,
      name,
      avatar: `agent-${(i % 6) + 1}`,
      isHost: i === 0,
      isConnected: true,
      isReady: true,
      isMuted: false,
      isSpeaking: false,
    }));

    const settings: GameSettings = {
      roundDurationSeconds: roundDuration,
      spyCount,
      packIds: [pack.id],
      modifierIds: selectedModifierIds,
      enableModifiers: selectedModifierIds.length > 0,
      allowEarlyAccusations: true,
      revoteOnTie: true,
    };

    const res = assignRoles(players, pack, settings);
    setSecrets(res.secrets);
    setSecretLocation(res.secretLocationName);
    setCurrentModifier(res.modifier);

    let initialTime = roundDuration;
    if (res.modifier?.type === 'time_reduced') {
      initialTime = Math.round(initialTime * 0.6);
    }
    setTimeLeft(initialTime);
    setCurrentHandoverIndex(0);
    setVotes({});
    setWinner(null);
    setAccusedSpyId(null);
    setPhase('handover');
  };

  // Next player reveal
  const handleNextPlayerSecret = () => {
    sound.playClick();
    if (currentHandoverIndex + 1 < playerCount) {
      setCurrentHandoverIndex((prev) => prev + 1);
      setPhase('handover');
    } else {
      // All players acknowledged their role!
      sound.playReveal();
      setPhase('discussion');
    }
  };

  // Voting complete
  const handleCastVote = (targetPlayerId: string) => {
    sound.playClick();
    const voterId = `offline_p_${currentVoterIndex}`;
    const nextVotes = { ...votes, [voterId]: targetPlayerId };
    setVotes(nextVotes);

    if (currentVoterIndex + 1 < playerCount) {
      setCurrentVoterIndex((prev) => prev + 1);
    } else {
      // Calculate vote outcome
      const mockPlayerList: Player[] = playerNames.map((name, i) => ({
        id: `offline_p_${i}`,
        name,
        avatar: '',
        isHost: false,
        isConnected: true,
        isReady: true,
        isMuted: false,
        isSpeaking: false,
        voteTargetId: nextVotes[`offline_p_${i}`],
      }));

      const voteRes = calculateVoteResults(mockPlayerList, 0, false);
      if (voteRes.outcome === 'player_eliminated') {
        const accusedId = voteRes.accusedPlayerId;
        const secret = secrets[accusedId];
        const accusedName = playerNames[parseInt(accusedId.replace('offline_p_', ''), 10)];

        if (secret && secret.isSpy) {
          // Civilians caught spy! Spy gets 1 chance to guess
          setAccusedSpyId(accusedId);
          setPhase('spy_guess');
        } else {
          // Civilians eliminated innocent! Spies win
          setWinner('spies');
          setWinReasonText(`Большинство проголосовало против мирного жителя: ${accusedName}. Шпионы победили!`);
          sound.playAlarm();
          setPhase('results');
        }
      } else {
        // Tie or no majority -> Spies win
        setWinner('spies');
        setWinReasonText('Голоса разделились, шпиона не удалось разоблачить. Победа шпионов!');
        sound.playAlarm();
        setPhase('results');
      }
    }
  };

  // Spy Guess
  const handleSpyGuess = (guessedLoc: string) => {
    sound.playClick();
    const isCorrect = checkSpyGuess(guessedLoc, secretLocation);
    if (isCorrect) {
      setWinner('spies');
      setWinReasonText(`Шпион правильно угадал секретную локацию: «${secretLocation}»!`);
      sound.playAlarm();
    } else {
      setWinner('civilians');
      setWinReasonText(`Шпион ошибся (назвал «${guessedLoc}»). Секретная локация: «${secretLocation}». Победа мирных жителей!`);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      sound.playVictory();
    }
    setPhase('results');
  };

  const currentSecret = secrets[`offline_p_${currentHandoverIndex}`];
  const selectedPack = allPacks.find((p) => p.id === selectedPackId) || OFFICIAL_PACKS[0];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 select-none">
      {/* PHASE 1: SETUP */}
      {phase === 'setup' && (
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Офлайн-режим (Один экран)</h2>
                <p className="text-xs text-slate-400">
                  Играйте в компании друзей, передавая устройство по кругу
                </p>
              </div>
            </div>
            <button
              onClick={onBackToMenu}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              В главное меню
            </button>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player Count & Names */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                  <span>Количество игроков</span>
                  <span className="text-emerald-400 font-mono text-sm">{playerCount} чел.</span>
                </label>
                <div className="flex gap-2">
                  {[3, 4, 5, 6, 7, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePlayerCountChange(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        playerCount === num
                          ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Player names list */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 block">
                  Имена участников
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {playerNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 w-6">#{i + 1}</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          const updated = [...playerNames];
                          updated[i] = e.target.value;
                          setPlayerNames(updated);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pack, Timer, Spies */}
            <div className="space-y-4">
              {/* Pack Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 block">
                  Игровой набор ({allPacks.length} доступно)
                </label>
                <select
                  value={selectedPackId}
                  onChange={(e) => setSelectedPackId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {allPacks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category}) — {p.locations.length} локаций
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1 italic">{selectedPack.description}</p>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 block">
                  Длительность раунда
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '3 мин', sec: 180 },
                    { label: '5 мин', sec: 300 },
                    { label: '8 мин', sec: 480 },
                    { label: 'Без лимита', sec: 0 },
                  ].map((item) => (
                    <button
                      key={item.sec}
                      type="button"
                      onClick={() => setRoundDuration(item.sec)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        roundDuration === item.sec
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  Или введите минуты (1–60)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={customDurationMinutes}
                    onChange={(event) => {
                      setCustomDurationMinutes(event.target.value);
                    }}
                    onBlur={() => {
                      const minutes = Number(customDurationMinutes);
                      if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 60) {
                        setRoundDuration(minutes * 60);
                      }
                    }}
                    className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center text-xs text-white"
                    aria-label="Таймер раунда в минутах"
                  />
                </label>
              </div>

              {/* Spies count */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                  <span>Количество шпионов</span>
                  <span className="text-rose-400 font-mono text-sm">{spyCount}</span>
                </label>
                <div className="flex gap-2">
                  {Array.from(
                    { length: Math.max(1, Math.floor((playerCount - 1) / 2)) },
                    (_, index) => index + 1
                  ).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSpyCount(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        spyCount === num
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {num} {num === 1 ? 'шпион' : 'шпиона'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modifier selection */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200">Модификаторы раунда</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedModifierIds.length > 0}
                    aria-label="Включить модификаторы раунда"
                    onClick={() =>
                      setSelectedModifierIds((current) =>
                        current.length > 0
                          ? []
                          : AVAILABLE_MODIFIERS.map((modifier) => modifier.id)
                      )
                    }
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      selectedModifierIds.length > 0 ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        selectedModifierIds.length > 0 ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                <div className="space-y-1">
                  {AVAILABLE_MODIFIERS.map((modifier) => {
                    const isSelected = selectedModifierIds.includes(modifier.id);
                    return (
                      <label
                        key={modifier.id}
                        title={modifier.description}
                        className={`group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                          isSelected ? 'bg-amber-500/10 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedModifierIds((current) =>
                              current.includes(modifier.id)
                                ? current.filter((id) => id !== modifier.id)
                                : [...current, modifier.id]
                            );
                          }}
                          className="accent-amber-400"
                        />
                        <span>{modifier.name}</span>
                        <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden w-56 rounded-lg border border-slate-700 bg-slate-950 p-2 text-[10px] leading-relaxed text-slate-200 shadow-xl group-hover:block group-focus-within:block">
                          {modifier.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleStartGame}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>РАСПРЕДЕЛИТЬ РОЛИ И НАЧАТЬ</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: HANDOVER SCREEN */}
      {phase === 'handover' && (
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-8 sm:p-12 text-center space-y-6 max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <EyeOff className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Шаг {currentHandoverIndex + 1} из {playerCount}
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              Передайте устройство игроку:
            </h2>
            <div className="mt-3 text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              {playerNames[currentHandoverIndex]}
            </div>
          </div>

          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Убедитесь, что остальные игроки не смотрят в экран, перед нажатием кнопки просмотра роли.
          </p>

          <button
            onClick={() => {
              sound.playReveal();
              setPhase('revealed');
            }}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Eye className="w-5 h-5" />
            <span>ПОСМОТРЕТЬ МОЮ СЕКРЕТНУЮ РОЛЬ</span>
          </button>
        </div>
      )}

      {/* PHASE 3: SECRET REVEALED */}
      {phase === 'revealed' && currentSecret && (
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 max-w-xl mx-auto">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Секретное досье: {playerNames[currentHandoverIndex]}
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              {currentSecret.isSpy ? 'ВЫ ШПИОН!' : 'ВЫ МИРНЫЙ ЖИТЕЛЬ'}
            </h2>
          </div>

          {currentSecret.isSpy ? (
            /* Spy View */
            <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-4">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>ОРИЕНТИРОВКА ДЛЯ ШПИОНА:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Вы не знаете секретную локацию! Слушайте вопросы других игроков, делайте вид, что знаете место, и постарайтесь вычислить его до конца партии.
              </p>
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2">
                  Возможные локации в этом наборе:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {currentSecret.allPossibleLocations.map((loc) => (
                    <span
                      key={loc}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                    >
                      {loc}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Civilian View */
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block mb-1">
                  Секретная локация:
                </span>
                <div className="text-2xl font-black text-white">{currentSecret.locationName}</div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block mb-1">
                  Ваша роль:
                </span>
                <div className="text-lg font-bold text-cyan-300">{currentSecret.roleName}</div>
              </div>

              {currentSecret.locationHint && (
                <p className="text-xs text-slate-400 italic">
                  Подсказка: «{currentSecret.locationHint}»
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleNextPlayerSecret}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <EyeOff className="w-4 h-4" />
            <span>
              {currentHandoverIndex + 1 < playerCount
                ? 'СКРЫТЬ И ПЕРЕДАТЬ СЛЕДУЮЩЕМУ'
                : 'ВСЕ РОЛИ ВЫДАНЫ — НАЧАТЬ ОБСУЖДЕНИЕ'}
            </span>
          </button>
        </div>
      )}

      {/* PHASE 4: DISCUSSION & COUNTDOWN */}
      {phase === 'discussion' && (
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
          {currentModifier && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-3.5">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-300">
                Модификатор раунда: {currentModifier.name}
              </span>
              <p className="mt-1 text-[11px] text-amber-200/80">{currentModifier.description}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Фаза обсуждения
              </span>
              <h2 className="text-xl font-black text-white">Задавайте вопросы и ищите шпиона!</h2>
            </div>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
            >
              {isPaused ? 'Возобновить таймер' : 'Пауза'}
            </button>
          </div>

          {/* Big Timer */}
          <div className="p-8 rounded-3xl bg-slate-950 border border-slate-800 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>{isTimerHidden ? 'Радиопомехи: таймер скрыт' : 'Оставшееся время'}</span>
            </div>
            <div
              className={`text-6xl sm:text-7xl font-mono font-black tracking-tight ${
                !isTimerHidden && timeLeft <= 30 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {isTimerHidden
                ? '??:??'
                : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
            </div>
          </div>

          {/* Prompt Generator */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{currentPrompt || 'Не знаете, что спросить? Нажмите для генерации темы вопроса!'}</span>
            </div>
            <button
              onClick={() => {
                sound.playClick();
                const rnd = QUESTION_PROMPTS[Math.floor(Math.random() * QUESTION_PROMPTS.length)];
                setCurrentPrompt(rnd);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer"
            >
              Случайный вопрос
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => {
                sound.playAlarm();
                setCurrentVoterIndex(0);
                setPhase('voting');
              }}
              className="py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Vote className="w-5 h-5" />
              <span>ПЕРЕЙТИ К ГОЛОСОВАНИЮ</span>
            </button>

            <button
              onClick={() => {
                sound.playAlarm();
                setPhase('spy_guess');
              }}
              className="py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Target className="w-5 h-5" />
              <span>Я ШПИОН — НАЗВАТЬ ЛОКАЦИЮ</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 5: VOTING */}
      {phase === 'voting' && (
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 max-w-lg mx-auto">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Голосование: {currentVoterIndex + 1} из {playerCount}
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              Кто по мнению <span className="text-emerald-400">{playerNames[currentVoterIndex]}</span> является шпионом?
            </h2>
          </div>

          <div className="space-y-2">
            {playerNames.map((name, i) => {
              const targetId = `offline_p_${i}`;
              const isSelf = i === currentVoterIndex;
              return (
                <button
                  key={targetId}
                  disabled={isSelf}
                  onClick={() => handleCastVote(targetId)}
                  className={`w-full p-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-between border cursor-pointer ${
                    isSelf
                      ? 'opacity-30 border-slate-800 bg-slate-950 text-slate-600'
                      : 'bg-slate-950 border-slate-800 hover:border-emerald-500 hover:bg-slate-800 text-white'
                  }`}
                >
                  <span>{name}</span>
                  <span className="text-xs text-slate-500 font-normal">
                    {isSelf ? '(Вы сами)' : 'Голосовать'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PHASE 6: SPY GUESS */}
      {phase === 'spy_guess' && (
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 max-w-xl mx-auto">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-rose-400">
              Решающий ход шпиона
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              Угадайте секретную локацию
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Если шпион назовёт правильную локацию — шпионы побеждают!
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Поиск по локациям..."
              value={spySearch}
              onChange={(e) => setSpySearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
            {selectedPack.locations
              .filter((l) => l.name.toLowerCase().includes(spySearch.toLowerCase()))
              .map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleSpyGuess(loc.name)}
                  className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-200 transition-all text-left cursor-pointer"
                >
                  {loc.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* PHASE 7: RESULTS */}
      {phase === 'results' && (
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center space-y-6 max-w-xl mx-auto">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Итоги партии
            </span>
            <h2
              className={`text-3xl font-black mt-1 ${
                winner === 'civilians' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {winner === 'civilians' ? 'ПОБЕДА МИРНЫХ ЖИТЕЛЕЙ!' : 'ПОБЕДА ШПИОНОВ!'}
            </h2>
            <p className="text-xs text-slate-300 mt-2">{winReasonText}</p>
          </div>

          {/* Secret Location reveal */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Секретная локация:</span>
            <span className="text-xl font-black text-white">{secretLocation}</span>
          </div>

          {/* Roles Roster */}
          <div className="space-y-1.5 text-left max-h-48 overflow-y-auto">
            {playerNames.map((name, i) => {
              const sec = secrets[`offline_p_${i}`];
              return (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-white">{name}</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded ${
                      sec?.isSpy
                        ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {sec?.roleName || 'Неизвестно'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStartGame}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              Сыграть ещё раз
            </button>
            <button
              onClick={() => setPhase('setup')}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer"
            >
              Изменить настройки
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
