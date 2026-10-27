import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Radio, ShieldAlert } from 'lucide-react';
import { voiceManager } from '../utils/webrtc';
import { sound } from '../utils/sound';
import { Player } from '../../packages/shared/src/index';

interface VoiceChatBarProps {
  players: Player[];
  localPlayerId: string;
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({ players, localPlayerId }) => {
  const [isMuted, setIsMuted] = useState(voiceManager.getIsMuted());
  const [isPtt, setIsPtt] = useState(voiceManager.getIsPushToTalk());
  const [isPttPressed, setIsPttPressed] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Микрофон запускаем один раз при монтировании: раньше каждое нажатие PTT его останавливало
  useEffect(() => {
    let isMounted = true;

    voiceManager.startMicrophone().then((success) => {
      if (isMounted) {
        if (!success) {
          setMicError('Микрофон не подключён или доступ заблокирован браузером.');
        }
      }
    });

    return () => {
      isMounted = false;
      voiceManager.stopMicrophone();
    };
  }, []);

  useEffect(() => {
    // Global keyboard listener for Push-to-Talk (Spacebar)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPtt && !isPttPressed) {
        // Prevent scrolling if not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsPttPressed(true);
          voiceManager.setPttActive(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPtt) {
        setIsPttPressed(false);
        voiceManager.setPttActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPtt, isPttPressed]);

  const toggleMute = () => {
    sound.playClick();
    const next = !isMuted;
    setIsMuted(next);
    voiceManager.setMuted(next);
  };

  const togglePtt = () => {
    sound.playClick();
    const next = !isPtt;
    setIsPtt(next);
    voiceManager.setPushToTalk(next);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMute}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isMuted
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25 shadow-lg shadow-emerald-500/10'
          }`}
          aria-label={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
        >
          {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
          <span>{isMuted ? 'Микрофон выкл' : 'Микрофон вкл'}</span>
        </button>

        <button
          onClick={togglePtt}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isPtt
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
          }`}
          title="Push-To-Talk: говорить при удержании Пробела"
          aria-label="Режим Push-to-Talk"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>PTT {isPtt ? '(Пробел)' : 'Выкл'}</span>
        </button>

        {isPtt && (
          <button
            onMouseDown={() => {
              setIsPttPressed(true);
              voiceManager.setPttActive(true);
            }}
            onMouseUp={() => {
              setIsPttPressed(false);
              voiceManager.setPttActive(false);
            }}
            onTouchStart={() => {
              setIsPttPressed(true);
              voiceManager.setPttActive(true);
            }}
            onTouchEnd={() => {
              setIsPttPressed(false);
              voiceManager.setPttActive(false);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all select-none cursor-pointer ${
              isPttPressed
                ? 'bg-cyan-500 text-slate-950 scale-95 shadow-lg shadow-cyan-500/30'
                : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            {isPttPressed ? 'Говорите...' : 'Удерживайте'}
          </button>
        )}
      </div>

      {/* Speaking Indicator & Voice Peer Badges */}
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {micError ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-lg">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{micError}</span>
          </div>
        ) : (
          players.map((p) => {
            const isSelf = p.id === localPlayerId;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  p.isSpeaking
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400 ring-1 ring-emerald-500/40'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/50'
                }`}
                title={p.isSpeaking ? `${p.name} говорит` : p.name}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    p.isSpeaking
                      ? 'bg-emerald-400'
                      : p.isMuted
                      ? 'bg-rose-500'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="truncate max-w-[90px]">{isSelf ? `${p.name} (Вы)` : p.name}</span>
                {p.isMuted && <MicOff className="w-3 h-3 text-rose-400 ml-0.5" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
