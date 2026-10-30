import React, { useEffect, useState } from 'react';
import { GameModifier, Player } from '../../packages/shared/src/index';

interface ModifierEventCardProps {
  modifier: GameModifier;
  players: Player[];
}

export const ModifierEventCard: React.FC<ModifierEventCardProps> = ({ modifier, players }) => {
  const [answer, setAnswer] = useState('');
  const [isCipherSolved, setIsCipherSolved] = useState(false);
  const [isCipherAnswerWrong, setIsCipherAnswerWrong] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (modifier.type !== 'silent_round' || !modifier.eventEndsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [modifier.eventEndsAt, modifier.type]);

  const eventTarget = players.find((player) => player.id === modifier.eventTargetId);
  const silentSecondsLeft = modifier.eventEndsAt
    ? Math.max(0, Math.ceil((modifier.eventEndsAt - now) / 1000))
    : 0;
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        modifier.type === 'blackout'
          ? 'border-violet-500/40 bg-violet-950/60'
          : 'border-amber-500/40 bg-amber-950/40'
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wide text-amber-300">
        Модификатор раунда: {modifier.name}
      </span>
      <p className="mt-1 text-[11px] text-amber-200/80">{modifier.description}</p>

      {modifier.type === 'hot_seat' && (
        <p className="mt-2 text-sm font-bold text-white">
          Первый в допросе: {eventTarget?.name ?? 'выбранный игрок'}
        </p>
      )}

      {modifier.type === 'forbidden_word' && modifier.forbiddenWord && (
        <p className="mt-2 text-sm font-black text-rose-300">
          Запрещено произносить: «{modifier.forbiddenWord}»
        </p>
      )}

      {modifier.type === 'silent_round' && silentSecondsLeft > 0 && (
        <p className="mt-2 text-sm font-bold text-cyan-200">
          Тишина! Микрофоны отключены ещё на {silentSecondsLeft} сек.
        </p>
      )}

      {modifier.type === 'whisper_mode' && players.length > 1 && (
        <p className="mt-2 text-[11px] text-white">
          Задавайте вопрос только игроку напротив или через одного.
          {players.map((player, index) => {
            const allowedIndices = [
              (index + Math.floor(players.length / 2)) % players.length,
              (index + 2) % players.length,
              (index - 2 + players.length) % players.length,
            ];
            const targets = [...new Set(allowedIndices)]
              .filter((targetIndex) => targetIndex !== index)
              .map((targetIndex) => players[targetIndex].name);
            return (
              <span key={player.id} className="block">
                {player.name} → {targets.join(' или ')}
              </span>
            );
          })}
        </p>
      )}

      {modifier.type === 'cross_exam' && (
        <p className="mt-2 text-[11px] font-semibold text-white">
          Раунд допроса: задайте игроку один конкретный вопрос и попросите ответить без уклонений.
        </p>
      )}

      {modifier.type === 'two_truths' && (
        <p className="mt-2 text-[11px] font-semibold text-white">
          Мини-игра: каждый называет три утверждения о месте — два правдивых и одно ложное.
          Остальные голосуют, какое из них выдумано.
        </p>
      )}

      {modifier.type === 'reverse_order' && players.length > 0 && (
        <p className="mt-2 text-[11px] text-white">
          Очерёдность вопросов: {[...players].reverse().map((player) => player.name).join(' → ')}
        </p>
      )}

      {modifier.type === 'echo_answer' && (
        <p className="mt-2 text-[11px] font-semibold text-white">
          Перед ответом повторите ключевую мысль предыдущего игрока. Если потеряли нить — это улика!
        </p>
      )}

      {modifier.type === 'rapid_fire' && (
        <p className="mt-2 text-[11px] font-semibold text-white">
          Включите секундомер: у отвечающего пять секунд, долгие паузы считаются подозрительными.
        </p>
      )}

      {modifier.cipherChallenge && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              answer.trim().toLocaleLowerCase() ===
              modifier.cipherChallenge?.solution.toLocaleLowerCase()
            ) {
              setIsCipherSolved(true);
              setIsCipherAnswerWrong(false);
            } else {
              setIsCipherAnswerWrong(true);
            }
          }}
        >
          <span className="w-full text-sm font-bold text-white">
            Мини-игра «Перехваченный шифр»: {modifier.cipherChallenge.clue}
          </span>
          <input
            aria-label="Ответ на числовую загадку"
            inputMode="numeric"
            value={answer}
            onChange={(event) => {
              setAnswer(event.currentTarget.value);
              setIsCipherAnswerWrong(false);
            }}
            placeholder="Ваш ответ"
            disabled={isCipherSolved}
            className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-1.5 text-xs text-white"
          />
          <button
            type="submit"
            disabled={isCipherSolved || answer.trim().length === 0}
            className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {isCipherSolved ? 'Шифр разгадан' : 'Проверить'}
          </button>
          {isCipherAnswerWrong && (
            <span role="status" className="text-xs text-rose-300">
              Неверный ответ. Попробуйте ещё раз.
            </span>
          )}
        </form>
      )}
    </div>
  );
};
