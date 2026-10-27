import React, { useState } from 'react';
import { ShieldAlert, MapPin, Briefcase, Eye, EyeOff, Search } from 'lucide-react';
import { PlayerSecret } from '../../packages/shared/src/index';
import { sound } from '../utils/sound';

interface RoleRevealProps {
  secret: PlayerSecret;
  playerName: string;
  onAcknowledge: () => void;
}

export const RoleReveal: React.FC<RoleRevealProps> = ({ secret, playerName, onAcknowledge }) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);

  const toggleReveal = () => {
    sound.playClick();
    setIsRevealed(!isRevealed);
  };

  const filteredLocations = secret.allPossibleLocations.filter((l) =>
    l.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 select-none animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 font-mono">
            СЕКРЕТНЫЙ ДОСТУП УРОВНЯ ОМЕГА
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Личное дело: {playerName}
          </h2>
          <p className="text-xs text-slate-400">
            Информация предназначена исключительно для ваших глаз.
          </p>
        </div>

        {/* Biometric Reveal Toggle Card */}
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4">
          <button
            onClick={toggleReveal}
            className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isRevealed
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isRevealed ? 'Скрыть информацию' : 'Открыть секретные данные'}</span>
          </button>

          {isRevealed && (
            <div className="space-y-5 pt-2 animate-in zoom-in-95 duration-200">
              {secret.isSpy ? (
                /* SPY DOSSIER */
                <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-left space-y-4">
                  <div className="flex items-center gap-2 text-rose-400 font-black text-base">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                    <span>ВНИМАНИЕ! ВЫ ШПИОН!</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Вы не знаете секретную локацию! Ваша задача — задавать уклончивые вопросы, не выдать себя и вычислить локацию среди возможных кандидатов.
                  </p>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300">
                        Список возможных локаций в наборе:
                      </span>
                      <span className="text-[10px] font-mono text-rose-400">
                        {secret.allPossibleLocations.length} мест
                      </span>
                    </div>

                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Фильтр локаций..."
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                      {filteredLocations.map((loc) => (
                        <span
                          key={loc}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                        >
                          {loc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* CIVILIAN DOSSIER */
                <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-left space-y-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1">
                      <MapPin className="w-4 h-4" />
                      СЕКРЕТНЫЙ ОБЪЕКТ (ЛОКАЦИЯ):
                    </span>
                    <div className="text-2xl font-black text-white">{secret.locationName}</div>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-1">
                      <Briefcase className="w-4 h-4" />
                      ВАША РОЛЬ НА ОБЪЕКТЕ:
                    </span>
                    <div className="text-lg font-bold text-slate-200">{secret.roleName}</div>
                  </div>

                  {secret.locationHint && (
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 italic">
                      Ориентировка: «{secret.locationHint}»
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ready to discuss button */}
        <button
          onClick={() => {
            sound.playClick();
            onAcknowledge();
          }}
          className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700 shadow-md"
        >
          Я запомнил роль (Перейти к обсуждению)
        </button>
      </div>
    </div>
  );
};
