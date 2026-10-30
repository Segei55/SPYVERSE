import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Monitor, Smartphone, X } from 'lucide-react';
import { sound } from '../utils/sound';
import { fetchLatestRelease, getReleaseDownloads, type LatestRelease } from '../utils/releases';

const SERVER_URL = 'https://spyverse.onrender.com/';

interface DownloadsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadsModal: React.FC<DownloadsModalProps> = ({ isOpen, onClose }) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [isLoadingRelease, setIsLoadingRelease] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setRelease(null);
    setReleaseError(null);
    setIsLoadingRelease(true);
    void fetchLatestRelease()
      .then((latest) => {
        if (active) setRelease(latest);
      })
      .catch((error: unknown) => {
        if (active) {
          setReleaseError(error instanceof Error ? error.message : 'Не удалось загрузить ссылки релиза.');
        }
      })
      .finally(() => {
        if (active) setIsLoadingRelease(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const downloads = release ? getReleaseDownloads(release) : null;
  const copyServerUrl = async () => {
    sound.playClick();
    try {
      await navigator.clipboard.writeText(SERVER_URL);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  };

  const platforms = [
    { key: 'windows', name: 'Windows', detail: 'Установщик или portable-версия', icon: Monitor },
    { key: 'linux', name: 'Linux', detail: 'AppImage или DEB', icon: Monitor },
    { key: 'android', name: 'Android', detail: 'Установка APK', icon: Smartphone },
  ] as const;

  return (
    <div className="safe-area-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Скачать SPYVERSE</h2>
              <p className="text-xs text-slate-400">Выберите версию для своего устройства</p>
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

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          <div className="space-y-3">
            {isLoadingRelease && <p className="text-xs text-slate-400">Загружаем ссылки последнего релиза…</p>}
            {releaseError && <p className="text-xs text-rose-300">{releaseError}</p>}
            {release && (
              <>
                <p className="text-xs text-slate-400">
                  Последний релиз: <span className="font-semibold text-emerald-300">{release.version}</span>
                </p>
                {platforms.map(({ key, name, detail, icon: Icon }) => {
                  const urls = key === 'windows'
                    ? [
                        { label: 'Установщик', url: downloads?.windows.installer },
                        { label: 'Portable', url: downloads?.windows.portable },
                      ]
                    : key === 'linux'
                      ? [
                          { label: 'AppImage', url: downloads?.linux.appImage },
                          { label: 'DEB', url: downloads?.linux.deb },
                        ]
                      : [{ label: 'Скачать APK', url: downloads?.android }];
                  const availableLinks = urls.filter(
                    (item): item is { label: string; url: string } => Boolean(item.url)
                  );
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 shrink-0 text-emerald-400" />
                        <div>
                          <h3 className="font-semibold text-white">{name}</h3>
                          <p className="text-xs text-slate-400">{detail}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {availableLinks.length > 0 ? availableLinks.map(({ label, url }) => (
                          <a
                            key={label}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {label}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )) : (
                          <span className="text-xs text-slate-500">Нет сборки в релизе</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {!isLoadingRelease && !release && (
              <a
                href="https://github.com/Segei55/SPYVERSE/releases"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200"
              >
                Открыть страницу релизов GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-900/60 space-y-3">
            <h3 className="font-semibold text-white">Игра на сервере SPYVERSE</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Чтобы играть онлайн через общий сервер, откройте настройки игры и укажите адрес сервера:
            </p>
            <button
              type="button"
              onClick={copyServerUrl}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-cyan-300 border border-cyan-900/60 transition-colors cursor-pointer"
            >
              <code className="text-xs sm:text-sm break-all text-left">{SERVER_URL}</code>
              <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold">
                {copyState === 'copied' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Скопировано
                  </>
                ) : copyState === 'error' ? (
                  'Не удалось скопировать'
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Копировать
                  </>
                )}
              </span>
            </button>
          </div>
        </div>

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
