import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Smile, X } from 'lucide-react';
import { ChatMessage } from '../../packages/shared/src/index';
import { sound } from '../utils/sound';

interface ChatDrawerProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_EMOJIS = ['🕵️‍♂️', '🤫', '👀', '🚨', '💣', '❓', '😱', '👍', '🔥', '🦊'];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  onSendMessage,
  isOpen,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
    sound.playClick();
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    sound.playClick();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-950/95 border-l border-slate-800 backdrop-blur-xl z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-400" />
          <h2 className="font-bold text-white text-sm tracking-wide">ЧАТ КОМНАТЫ</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-400 font-mono">
            {messages.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Закрыть чат"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-emerald-400" />
            <p className="text-sm">Сообщений пока нет</p>
            <p className="text-xs text-slate-600 mt-1">Отправьте сообщение или эмодзи, чтобы начать общение с командой.</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div
                  key={msg.id}
                  className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center text-xs text-emerald-400/90 font-mono my-2"
                >
                  {msg.text}
                </div>
              );
            }

            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id} className="flex flex-col space-y-1">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="font-semibold text-emerald-400">{msg.senderName}</span>
                  <span className="text-slate-500 font-mono">{timeStr}</span>
                </div>
                <div className="p-2.5 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800/80 text-slate-200 text-sm break-words leading-relaxed">
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emojis */}
      <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto">
        <Smile className="w-4 h-4 text-slate-500 shrink-0" />
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleEmojiClick(emoji)}
            className="p-1 hover:bg-slate-800 rounded text-base transition-transform active:scale-125 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Напишите сообщение..."
          maxLength={500}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
          aria-label="Отправить"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
