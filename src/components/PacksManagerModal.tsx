import React, { useRef, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  X,
  Plus,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit3,
  Search,
  Check,
  AlertTriangle,
  FolderOpen,
  MapPin,
  Users,
} from 'lucide-react';
import { LocationPack, LocationItem } from '../../packages/shared/src/index';
import {
  OFFICIAL_PACKS,
  exportPackToJSON,
  importPackFromJSON,
  validatePack,
} from '../../packages/content/src/index';
import { sound } from '../utils/sound';

interface PacksManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customPacks: LocationPack[];
  onUpdateCustomPacks: (packs: LocationPack[]) => void;
}

export const PacksManagerModal: React.FC<PacksManagerModalProps> = ({
  isOpen,
  onClose,
  customPacks,
  onUpdateCustomPacks,
}) => {
  const [activeTab, setActiveTab] = useState<'official' | 'custom'>('official');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPack, setSelectedPack] = useState<LocationPack>(OFFICIAL_PACKS[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPack, setEditingPack] = useState<LocationPack | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [fileAccessGranted, setFileAccessGranted] = useState(false);
  const [fileAccessRequest, setFileAccessRequest] = useState<
    { type: 'import' } | { type: 'export'; pack: LocationPack } | null
  >(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const saveExportedPack = async (pack: LocationPack) => {
    sound.playClick();
    const jsonStr = exportPackToJSON(pack);
    if (isAndroidNative) {
      try {
        const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: `SPYVERSE/spyverse_pack_${pack.id}.json`,
          data: jsonStr,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        showNotice(`Набор «${pack.name}» сохранён в Documents/SPYVERSE.`);
      } catch (error) {
        showNotice(`Не удалось сохранить файл: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spyverse_pack_${pack.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotice(`Набор «${pack.name}» успешно экспортирован!`);
  };

  const requestFileAccess = async () => {
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      const permission = await Filesystem.requestPermissions();
      if (permission.publicStorage !== 'granted') {
        throw new Error('Доступ к файлам не разрешён. Его можно включить в настройках Android.');
      }

      setFileAccessGranted(true);
      const request = fileAccessRequest;
      setFileAccessRequest(null);
      if (request?.type === 'export') {
        await saveExportedPack(request.pack);
      } else {
        showNotice('Доступ разрешён. Нажмите «Импорт JSON» ещё раз, чтобы выбрать файл.');
      }
    } catch (error) {
      setFileAccessRequest(null);
      showNotice(`Не удалось получить доступ к файлам: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImportClick = () => {
    sound.playClick();
    if (isAndroidNative && !fileAccessGranted) {
      setFileAccessRequest({ type: 'import' });
      return;
    }
    importInputRef.current?.click();
  };

  const handleExport = (pack: LocationPack) => {
    if (isAndroidNative && !fileAccessGranted) {
      setFileAccessRequest({ type: 'export', pack });
      return;
    }
    void saveExportedPack(pack);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importPackFromJSON(content);
      if (res.success && res.pack) {
        sound.playVictory();
        const importedPack: LocationPack = {
          ...res.pack,
          id: `custom_${Date.now()}`,
          isCustom: true,
        };
        const updated = [...customPacks, importedPack];
        onUpdateCustomPacks(updated);
        setSelectedPack(importedPack);
        setActiveTab('custom');
        showNotice(`Набор «${importedPack.name}» успешно импортирован!`);
      } else {
        sound.playAlarm();
        showNotice(`Ошибка валидации набора: ${res.errors?.join(', ')}`);
      }
    };
    reader.onerror = () => showNotice('Не удалось прочитать выбранный JSON-файл.');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDuplicate = (pack: LocationPack) => {
    sound.playClick();
    const cloned: LocationPack = {
      ...pack,
      id: `custom_${Date.now()}`,
      name: `${pack.name} (Копия)`,
      author: 'Пользователь',
      isCustom: true,
    };
    const updated = [...customPacks, cloned];
    onUpdateCustomPacks(updated);
    setSelectedPack(cloned);
    setActiveTab('custom');
    showNotice(`Набор скопирован в пользовательские!`);
  };

  const handleDelete = (packId: string) => {
    if (!confirm('Вы действительно хотите удалить этот пользовательский набор?')) return;
    sound.playClick();
    const updated = customPacks.filter((p) => p.id !== packId);
    onUpdateCustomPacks(updated);
    setSelectedPack(OFFICIAL_PACKS[0]);
    showNotice('Набор удалён.');
  };

  const handleStartCreate = () => {
    sound.playClick();
    const newPack: LocationPack = {
      id: `custom_${Date.now()}`,
      name: 'Новый авторский набор',
      description: 'Описание набора локаций',
      category: 'Пользовательские',
      version: '1.0.0',
      author: 'Игрок',
      isCustom: true,
      locations: [
        {
          id: `loc_${Date.now()}_1`,
          name: 'Первая локация',
          roles: ['Роль 1', 'Роль 2', 'Роль 3', 'Роль 4', 'Роль 5', 'Роль 6'],
          hint: 'Подсказка для игроков',
        },
        {
          id: `loc_${Date.now()}_2`,
          name: 'Вторая локация',
          roles: ['Роль 1', 'Роль 2', 'Роль 3', 'Роль 4', 'Роль 5', 'Роль 6'],
        },
        {
          id: `loc_${Date.now()}_3`,
          name: 'Третья локация',
          roles: ['Роль 1', 'Роль 2', 'Роль 3', 'Роль 4', 'Роль 5', 'Роль 6'],
        },
        {
          id: `loc_${Date.now()}_4`,
          name: 'Четвертая локация',
          roles: ['Роль 1', 'Роль 2', 'Роль 3', 'Роль 4', 'Роль 5', 'Роль 6'],
        },
      ],
    };
    setEditingPack(newPack);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editingPack) return;
    const val = validatePack(editingPack);
    if (!val.success) {
      sound.playAlarm();
      setValidationError(val.errors?.join('\n') || 'Ошибка валидации');
      return;
    }

    sound.playClick();
    setValidationError(null);

    const exists = customPacks.some((p) => p.id === editingPack.id);
    let updated: LocationPack[];
    if (exists) {
      updated = customPacks.map((p) => (p.id === editingPack.id ? editingPack : p));
    } else {
      updated = [...customPacks, editingPack];
    }

    onUpdateCustomPacks(updated);
    setSelectedPack(editingPack);
    setIsEditing(false);
    setEditingPack(null);
    setActiveTab('custom');
    showNotice(`Набор «${editingPack.name}» успешно сохранён!`);
  };

  const packsToShow = (activeTab === 'official' ? OFFICIAL_PACKS : customPacks).filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="safe-area-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-5xl h-[90vh] max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
              <FolderOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Библиотека и редактор наборов</span>
                <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                  19 стандартных
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Создавайте свои тематические миры или используйте готовые наборы
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Импорт JSON</span>
            </button>
            <input ref={importInputRef} type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />

            <button
              onClick={handleStartCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать набор</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-2"
              aria-label="Закрыть библиотеку"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {notification && (
          <div className="bg-emerald-950 border-b border-emerald-500/40 text-emerald-300 text-xs py-2 px-4 flex items-center justify-between">
            <span>{notification}</span>
          </div>
        )}

        {fileAccessRequest && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <h3 className="text-base font-bold text-white">Доступ к файлам</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                SPYVERSE использует доступ только для {fileAccessRequest.type === 'import'
                  ? 'чтения выбранного вами JSON-набора.'
                  : 'сохранения экспортируемого набора в Documents/SPYVERSE.'}
                {' '}Импортируемый файл выбирается вами через системное окно Android.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setFileAccessRequest(null)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Отмена
                </button>
                <button
                  onClick={() => void requestFileAccess()}
                  className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Разрешить доступ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Body Split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar: Pack list */}
          <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-950/40">
            {/* Tabs */}
            <div className="p-3 border-b border-slate-800/80 flex gap-2">
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('official');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'official'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Официальные (19)
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('custom');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'custom'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Мои ({customPacks.length})
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-800/60">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Поиск по названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Pack Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {packsToShow.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {activeTab === 'custom'
                    ? 'Пользовательских наборов пока нет. Создайте свой или импортируйте JSON!'
                    : 'Ничего не найдено'}
                </div>
              ) : (
                packsToShow.map((pack) => {
                  const isSel = selectedPack.id === pack.id;
                  return (
                    <button
                      key={pack.id}
                      onClick={() => {
                        sound.playClick();
                        setSelectedPack(pack);
                        setIsEditing(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1 border ${
                        isSel
                          ? 'bg-slate-800 border-emerald-500/50 shadow-md'
                          : 'bg-slate-900/60 border-slate-800/60 hover:bg-slate-800/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{pack.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-950 text-emerald-400">
                          {pack.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 line-clamp-1">
                        {pack.locations.length} локаций • {pack.description}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Main Pane: Details or Editor */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-900 flex flex-col">
            {isEditing && editingPack ? (
              /* PACK EDITOR VIEW */
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Редактирование набора</h3>
                    <p className="text-xs text-slate-400">Минимум 4 локации, минимум 3 роли в каждой</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-xl cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 rounded-xl cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      Сохранить набор
                    </button>
                  </div>
                </div>

                {validationError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-300 whitespace-pre-line">
                    <AlertTriangle className="w-4 h-4 inline mr-1 text-rose-400" />
                    {validationError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Название набора</label>
                    <input
                      type="text"
                      value={editingPack.name}
                      onChange={(e) => setEditingPack({ ...editingPack, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Категория</label>
                    <input
                      type="text"
                      value={editingPack.category}
                      onChange={(e) => setEditingPack({ ...editingPack, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Описание</label>
                  <textarea
                    rows={2}
                    value={editingPack.description}
                    onChange={(e) => setEditingPack({ ...editingPack, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white resize-none"
                  />
                </div>

                {/* Locations list editor */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Локации ({editingPack.locations.length})
                    </h4>
                    <button
                      onClick={() => {
                        const newLoc: LocationItem = {
                          id: `loc_${Date.now()}`,
                          name: `Локация ${editingPack.locations.length + 1}`,
                          roles: ['Роль 1', 'Роль 2', 'Роль 3', 'Роль 4', 'Роль 5', 'Роль 6'],
                        };
                        setEditingPack({
                          ...editingPack,
                          locations: [...editingPack.locations, newLoc],
                        });
                      }}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить локацию
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingPack.locations.map((loc, idx) => (
                      <div key={loc.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={loc.name}
                            onChange={(e) => {
                              const updated = [...editingPack.locations];
                              updated[idx].name = e.target.value;
                              setEditingPack({ ...editingPack, locations: updated });
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-semibold flex-1 max-w-xs"
                          />
                          <button
                            onClick={() => {
                              if (editingPack.locations.length <= 4) {
                                alert('В наборе должно оставаться минимум 4 локации.');
                                return;
                              }
                              const updated = editingPack.locations.filter((_, i) => i !== idx);
                              setEditingPack({ ...editingPack, locations: updated });
                            }}
                            className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            title="Удалить локацию"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Роли через запятую (минимум 3):
                          </label>
                          <input
                            type="text"
                            value={loc.roles.join(', ')}
                            onChange={(e) => {
                              const rolesArr = e.target.value.split(',').map((r) => r.trim()).filter(Boolean);
                              const updated = [...editingPack.locations];
                              updated[idx].roles = rolesArr;
                              setEditingPack({ ...editingPack, locations: updated });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* PACK DETAILS VIEW */
              <div className="space-y-6">
                {/* Header card */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-black text-white">{selectedPack.name}</h3>
                      <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                        {selectedPack.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-xl">{selectedPack.description}</p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2 font-mono">
                      <span>Автор: {selectedPack.author}</span>
                      <span>Версия: {selectedPack.version}</span>
                      <span>Локаций: {selectedPack.locations.length}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleExport(selectedPack)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Экспорт в JSON файл"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Экспорт</span>
                    </button>

                    <button
                      onClick={() => handleDuplicate(selectedPack)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Дублировать набор для редактирования"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Копировать</span>
                    </button>

                    {selectedPack.isCustom && (
                      <>
                        <button
                          onClick={() => {
                            sound.playClick();
                            setEditingPack(JSON.parse(JSON.stringify(selectedPack)));
                            setIsEditing(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Изменить</span>
                        </button>

                        <button
                          onClick={() => handleDelete(selectedPack.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                          title="Удалить набор"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Locations Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    Список всех локаций и ролей в наборе ({selectedPack.locations.length})
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedPack.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-white">{loc.name}</span>
                          <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-slate-900">
                            {loc.roles.length} ролей
                          </span>
                        </div>
                        {loc.hint && (
                          <p className="text-[11px] text-slate-400 italic mb-2">«{loc.hint}»</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {loc.roles.map((role) => (
                            <span
                              key={role}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
