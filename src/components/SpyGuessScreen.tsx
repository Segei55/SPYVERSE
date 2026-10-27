import React, { useState } from 'react';
import { Target, Search, ShieldAlert, Clock } from 'lucide-react';
import { PlayerSecret } from '../../packages/shared/src/index';
import { sound } from '../utils/sound';

interface SpyGuessScreenProps {
  isLocalSpy: boolean;
  secret?: PlayerSecret | null;
  onGuessLocation: (locationName: string) => void;
  onCancel?: () => void;
}

export const SpyGuessScreen: React.FC<SpyGuessScreenProps> = ({
  isLocalSpy,
  secret,
  onGuessLocation,
  onCancel,
}) => {
  const [search, setSearch] = useState('');
  const locations = secret?.allPossibleLocations || [];

  const filtered = locations.filter((l) => l.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (locName: string) => {
    sound.playClick();
    onGuessLocation(locName);
  };

  if (!isLocalSpy) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 text-center select-none animate-in fade-in duration-300">
        <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <Target className="w-8 h-8 text-rose-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-rose-400">
            Решающий момент
          </span>
          <h2 className="text-xl font-black text-white">Шпион раскрыт!</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            По правилам игры у шпиона есть одна попытка угадать секретную локацию. Если он назовёт её верно — победа достанется шпиону!
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono pt-2">
            <Clock className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Ожидание решения шпиона...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 select-none animate-in fade-in duration-300">
      <div className="case-surface bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-5 text-center">
        <div className="w-14 h-14 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-rose-400" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-rose-400">
            ПОСЛЕДНИЙ ШАНС ШПИОНА
          </span>
          <h2 className="text-2xl font-black text-white mt-1">Назовите локацию!</h2>
          <p className="text-xs text-slate-400 mt-1">
            Выберите объект из списка. Если угадаете верно — вы победили!
          </p>
        </div>

        <div className="relative text-left">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Быстрый поиск локации..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 text-left">
          {filtered.map((loc) => (
            <button
              key={loc}
              onClick={() => handleSelect(loc)}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500 rounded-xl text-xs font-bold text-slate-200 transition-all cursor-pointer"
            >
              {loc}
            </button>
          ))}
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onCancel();
            }}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
          >
            Отмена (вернуться к обсуждению)
          </button>
        )}
      </div>
    </div>
  );
};
