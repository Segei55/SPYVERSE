import React, { useEffect, useState } from 'react';
import { X, Server, Copy, Check, Wifi, Globe, ShieldCheck } from 'lucide-react';
import { sound } from '../utils/sound';
import { ServerNetworkInterface } from '../../packages/shared/src/index';

interface ServerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerGuideModal: React.FC<ServerGuideModalProps> = ({ isOpen, onClose }) => {
  const [interfaces, setInterfaces] = useState<ServerNetworkInterface[]>([]);
  const [serverPort, setServerPort] = useState<number>(3000);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/server-info')
        .then((res) => res.json())
        .then((data) => {
          if (data.interfaces) setInterfaces(data.interfaces);
          if (data.port) setServerPort(data.port);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    sound.playClick();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="safe-area-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
              <Server className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Свой сервер & Сетевая игра</h2>
              <p className="text-xs text-slate-400">Как пригласить друзей через LAN, Hamachi или Radmin VPN</p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Host IP interfaces box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                Сетевые интерфейсы вашего ПК
              </span>
              <span className="text-xs text-slate-500">Порт: {serverPort}</span>
            </div>

            {interfaces.length > 0 ? (
              <div className="space-y-2">
                {interfaces.map((iface) => {
                  const fullAddress = `http://${iface.address}:${serverPort}`;
                  return (
                    <div
                      key={`${iface.name}-${iface.address}`}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs">{iface.address}</span>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {iface.type}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">{iface.name}</span>
                      </div>

                      <button
                        onClick={() => copyToClipboard(fullAddress)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-all cursor-pointer"
                      >
                        {copiedText === fullAddress ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Копировать адрес</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Запустите сервер файлом <code className="text-emerald-400 font-mono">server.bat</code> (или командой <code className="text-emerald-400 font-mono">npm run start:server</code>), чтобы увидеть все сетевые адаптеры.
              </p>
            )}
          </div>

          {/* Guide Steps */}
          <div className="space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Способы подключения друзей:
            </h3>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <h4 className="font-semibold text-emerald-400 text-xs uppercase tracking-wider">
                1. Локальная сеть (Wi-Fi или роутер)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Если друзья находятся в одной Wi-Fi сети или подключены к одному роутеру, передайте им локальный IP адрес (обычно начинается на <code className="text-cyan-400">192.168.x.x</code>) и 6-значный код комнаты.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <h4 className="font-semibold text-cyan-400 text-xs uppercase tracking-wider">
                2. Виртуальная сеть (Hamachi или Radmin VPN)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Для игры через интернет без открытия портов создайте комнату в Hamachi или Radmin VPN. Друзья подключаются к вашей VPN-сети, а в игре вводят ваш VPN IP (начинается на <code className="text-cyan-400">25.x.x.x</code> или <code className="text-cyan-400">26.x.x.x</code>) в Настройках сервера.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <h4 className="font-semibold text-teal-400 text-xs uppercase tracking-wider">
                3. Автономный выделенный сервер (Windows / Linux)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Вы можете запустить SPYVERSE Dedicated Server на любом домашнем компьютере. Он работает как самостоятельный фоновый процесс, потребляет минимум ресурсов и логирует чат комнат.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
