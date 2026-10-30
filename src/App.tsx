import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  ChatMessage,
  GameSettings,
  LocationPack,
  Player,
  PlayerSecret,
  RoomState,
} from '../packages/shared/src/index';
import { OFFICIAL_PACKS } from '../packages/content/src/index';
import { AVAILABLE_MODIFIERS } from '../packages/game-engine/src/index';
import { getSocket, disconnectSocket } from './utils/socket';
import { voiceManager } from './utils/webrtc';
import { sound } from './utils/sound';

import { Navbar } from './components/Navbar';
import { MainMenu } from './components/MainMenu';
import { PassAndPlay } from './components/PassAndPlay';
import { OnlineLobby } from './components/OnlineLobby';
import { RoleReveal } from './components/RoleReveal';
import { DiscussionScreen } from './components/DiscussionScreen';
import { VotingScreen } from './components/VotingScreen';
import { SpyGuessScreen } from './components/SpyGuessScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { VoiceChatBar } from './components/VoiceChatBar';
import { ChatDrawer } from './components/ChatDrawer';
import { SettingsModal } from './components/SettingsModal';
import { ServerGuideModal } from './components/ServerGuideModal';
import { PacksManagerModal } from './components/PacksManagerModal';
import { DownloadsModal } from './components/DownloadsModal';
import type { UpdateStatus } from './utils/electron';
import { fetchLatestRelease, isNewerVersion, type LatestRelease } from './utils/releases';

export function App() {
  // Navigation & Screen state
  const [currentMode, setCurrentMode] = useState<'menu' | 'pass_and_play' | 'online'>('menu');

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    try {
      return sessionStorage.getItem('spyverse_reopen_settings') === 'true';
    } catch {
      return false;
    }
  });
  const [isServerGuideOpen, setIsServerGuideOpen] = useState(false);
  const [isPacksOpen, setIsPacksOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [latestRelease, setLatestRelease] = useState<LatestRelease | null>(null);
  const [releaseCheckError, setReleaseCheckError] = useState<string | null>(null);
  const [isAutoUpdateSupported, setIsAutoUpdateSupported] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const androidBackActionRef = useRef<() => void>(() => {});

  useEffect(() => {
    try {
      sessionStorage.removeItem('spyverse_reopen_settings');
    } catch {}
  }, []);

  useEffect(() => {
    const electronAPI = window.electronAPI;
    let active = true;
    const unsubscribe = electronAPI?.onUpdateStatus((status) => {
      if (active) setUpdateStatus(status);
    });

    void fetchLatestRelease()
      .then(async (release) => {
        const currentVersion = electronAPI ? await electronAPI.getVersion() : __APP_VERSION__;
        if (active && isNewerVersion(release.version, currentVersion)) setLatestRelease(release);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Не удалось проверить наличие обновления.';
        if (active && !message.includes('Публичных релизов SPYVERSE пока нет')) {
          setReleaseCheckError(message);
        }
      });

    if (electronAPI) {
      void electronAPI
        .getUpdateSupport()
        .then((supported) => {
          if (!active) return;
          setIsAutoUpdateSupported(supported);
          if (supported) {
            void electronAPI.checkForUpdates().catch((error: unknown) => {
              setUpdateStatus({
                state: 'error',
                message: error instanceof Error ? error.message : 'Не удалось проверить наличие обновления.',
              });
            });
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setUpdateStatus({
              state: 'error',
              message: error instanceof Error ? error.message : 'Не удалось проверить поддержку обновлений.',
            });
          }
        });
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const checkForUpdates = () => {
    setReleaseCheckError(null);
    void fetchLatestRelease()
      .then(async (release) => {
        const currentVersion = window.electronAPI
          ? await window.electronAPI.getVersion()
          : __APP_VERSION__;
        setLatestRelease(isNewerVersion(release.version, currentVersion) ? release : null);
      })
      .catch((error: unknown) => {
        setReleaseCheckError(error instanceof Error ? error.message : 'Не удалось проверить наличие обновления.');
      });
    if (isAutoUpdateSupported) {
      void window.electronAPI?.checkForUpdates().catch((error: unknown) => {
        setUpdateStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Не удалось проверить наличие обновления.',
        });
      });
    }
  };

  // Custom packs persisted in localStorage
  const [customPacks, setCustomPacks] = useState<LocationPack[]>(() => {
    try {
      const saved = localStorage.getItem('spyverse_custom_packs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Online Multiplayer State
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [localSecret, setLocalSecret] = useState<PlayerSecret | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAcknowledgedRole, setHasAcknowledgedRole] = useState(false);
  const [isEarlyGuessOpen, setIsEarlyGuessOpen] = useState(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectingRef = useRef(false);

  // Актуальные значения для обработчиков сокета, чтобы не перевешивать их при каждом обновлении
  const localPlayerRef = useRef<Player | null>(null);
  const isChatOpenRef = useRef(false);
  useEffect(() => {
    localPlayerRef.current = localPlayer;
  }, [localPlayer]);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // Save custom packs on change
  const handleUpdateCustomPacks = (packs: LocationPack[]) => {
    setCustomPacks(packs);
    try {
      localStorage.setItem('spyverse_custom_packs', JSON.stringify(packs));
    } catch {}
  };

  // Socket listener setup
  useEffect(() => {
    const socket = getSocket();

    // Init WebRTC voice manager
    voiceManager.init(
      socket,
      (peerId, isSpeaking) => {
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.map((p) => (p.id === peerId ? { ...p, isSpeaking } : p)),
          };
        });
      },
      () => {}
    );

    socket.on('room_created', (data: { roomId: string; sessionToken: string; player: Player }) => {
      isConnectingRef.current = false;
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      setIsConnecting(false);
      setLocalPlayer(data.player);
      setCurrentMode('online');
      try {
        sessionStorage.setItem('spyverse_session', data.sessionToken);
      } catch {}
    });

    socket.on('room_joined', (data: { roomId: string; sessionToken: string; player: Player }) => {
      isConnectingRef.current = false;
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      setIsConnecting(false);
      setLocalPlayer(data.player);
      setCurrentMode('online');
      try {
        sessionStorage.setItem('spyverse_session', data.sessionToken);
      } catch {}
    });

    socket.on('room_state_update', (state: RoomState) => {
      setRoomState(state);
      // Update local player reference
      const currentPlayer = localPlayerRef.current;
      if (currentPlayer) {
        const updatedSelf = state.players.find((p) => p.id === currentPlayer.id);
        if (updatedSelf) setLocalPlayer(updatedSelf);
      }
      if (state.gameState.phase !== 'discussion') {
        setIsEarlyGuessOpen(false);
      }
      if (state.gameState.phase === 'lobby') {
        setLocalSecret(null);
        setHasAcknowledgedRole(false);
      }
    });

    socket.on('player_secret', (secret: PlayerSecret) => {
      setLocalSecret(secret);
      setHasAcknowledgedRole(false);
      sound.playReveal();
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpenRef.current) {
        setUnreadChatCount((prev) => prev + 1);
        sound.playTick();
      }
    });

    socket.on('voice_state_changed', ({ peerId, isMuted, isSpeaking }: { peerId: string; isMuted: boolean; isSpeaking: boolean }) => {
      setRoomState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((p) => (p.id === peerId ? { ...p, isMuted, isSpeaking } : p)),
        };
      });
    });

    socket.on('error_response', (err: { code: string; message: string }) => {
      isConnectingRef.current = false;
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      setIsConnecting(false);
      setErrorMessage(err.message);
      sound.playAlarm();
      setTimeout(() => setErrorMessage(null), 5000);
    });

    socket.on('connect_error', (error: Error) => {
      if (!isConnectingRef.current) return;
      isConnectingRef.current = false;
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      setIsConnecting(false);
      setErrorMessage(`Не удалось подключиться к серверу: ${error.message}`);
    });

    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('room_state_update');
      socket.off('player_secret');
      socket.off('chat_message');
      socket.off('voice_state_changed');
      socket.off('error_response');
      socket.off('connect_error');
    };
  }, []);

  // Синхронизируем голосовые P2P-соединения с составом комнаты
  useEffect(() => {
    if (currentMode !== 'online' || !roomState || !localPlayer) return;
    voiceManager.syncPeers(
      localPlayer.id,
      roomState.players.filter((p) => p.isConnected).map((p) => p.id)
    );
  }, [roomState, localPlayer, currentMode]);

  // Online actions
  const handleCreateRoom = (hostName: string) => {
    isConnectingRef.current = true;
    setIsConnecting(true);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (!isConnectingRef.current) return;
      isConnectingRef.current = false;
      setIsConnecting(false);
      setErrorMessage('Сервер не ответил. Проверьте его запуск и адрес сервера в настройках.');
    }, 15000);
    const socket = getSocket();
    socket.emit('room_create', {
      hostName,
      avatar: 'agent-1',
      settings: {
        roundDurationSeconds: 300,
        spyCount: 1,
        packIds: [OFFICIAL_PACKS[0].id],
        modifierIds: AVAILABLE_MODIFIERS.map((modifier) => modifier.id),
        enableModifiers: true,
        allowEarlyAccusations: true,
        revoteOnTie: true,
      },
    });
  };

  const handleJoinRoom = (roomId: string, playerName: string) => {
    isConnectingRef.current = true;
    setIsConnecting(true);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (!isConnectingRef.current) return;
      isConnectingRef.current = false;
      setIsConnecting(false);
      setErrorMessage('Сервер не ответил. Проверьте его запуск и адрес сервера в настройках.');
    }, 15000);
    const socket = getSocket();
    const sessionToken = sessionStorage.getItem('spyverse_session') || undefined;
    socket.emit('room_join', {
      roomId,
      playerName,
      avatar: 'agent-2',
      sessionToken,
    });
  };

  const handleUpdateSettings = (settings: GameSettings) => {
    const socket = getSocket();
    // Сервер не хранит пользовательские наборы: передаём выбранный набор вместе с настройками
    const selectedCustomPacks = customPacks.filter((p) => settings.packIds.includes(p.id));
    socket.emit('room_update_settings', { ...settings, customPacks: selectedCustomPacks });
  };

  const handleSetModifier = (modifierId: string, isSelected: boolean) => {
    getSocket().emit('room_set_modifier', { modifierId, isSelected });
  };

  const handleSetReady = (isReady: boolean) => {
    const socket = getSocket();
    socket.emit('player_ready', isReady);
  };

  const handleStartGame = () => {
    const socket = getSocket();
    socket.emit('game_start');
  };

  const handleCallAccusation = (accusedId: string) => {
    const socket = getSocket();
    socket.emit('game_call_accusation', { accusedId });
  };

  const handleCastVote = (targetPlayerId: string) => {
    const socket = getSocket();
    socket.emit('game_cast_vote', { targetPlayerId });
  };

  const handleSpyGuess = (guessedLocationName: string) => {
    const socket = getSocket();
    socket.emit('game_spy_guess', { guessedLocationName });
  };

  const handleRematch = () => {
    const socket = getSocket();
    socket.emit('game_rematch');
  };

  const handleSendMessage = (text: string) => {
    const socket = getSocket();
    socket.emit('chat_send', { text });
  };

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setUnreadChatCount(0);
  };

  const handleLeaveRoom = () => {
    sound.playClick();
    getSocket().emit('room_leave');
    voiceManager.disconnectAllPeers();
    try {
      sessionStorage.removeItem('spyverse_session');
    } catch {}
    setRoomState(null);
    setLocalPlayer(null);
    setLocalSecret(null);
    setChatMessages([]);
    setUnreadChatCount(0);
    setIsChatOpen(false);
    setHasAcknowledgedRole(false);
    setIsEarlyGuessOpen(false);
    setErrorMessage(null);
    setCurrentMode('menu');
  };

  androidBackActionRef.current = () => {
    if (isChatOpen) {
      setIsChatOpen(false);
    } else if (isDownloadsOpen) {
      setIsDownloadsOpen(false);
    } else if (isPacksOpen) {
      setIsPacksOpen(false);
    } else if (isServerGuideOpen) {
      setIsServerGuideOpen(false);
    } else if (isSettingsOpen) {
      setIsSettingsOpen(false);
    } else if (isEarlyGuessOpen) {
      setIsEarlyGuessOpen(false);
    } else if (currentMode === 'pass_and_play') {
      setCurrentMode('menu');
    } else if (currentMode === 'online') {
      handleLeaveRoom();
    } else {
      void CapacitorApp.exitApp();
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let active = true;
    let removeBackButtonListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('backButton', () => androidBackActionRef.current())
      .then((listener) => {
        if (active) {
          removeBackButtonListener = () => listener.remove();
        } else {
          void listener.remove();
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? `Не удалось включить навигацию «Назад»: ${error.message}`
              : 'Не удалось включить навигацию «Назад».'
          );
        }
      });

    return () => {
      active = false;
      if (removeBackButtonListener) void removeBackButtonListener();
    };
  }, []);

  return (
    <div className="case-app min-h-screen bg-[#12130f] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navbar */}
      <Navbar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenServerGuide={() => setIsServerGuideOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        onOpenPacks={() => setIsPacksOpen(true)}
        isOnlineConnected={currentMode === 'online' && Boolean(roomState)}
      />

      {(latestRelease ||
        releaseCheckError ||
        (updateStatus && updateStatus.state !== 'checking' && updateStatus.state !== 'not-available')) && (
        <div className="flex items-center justify-between gap-3 bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-100 text-sm py-2.5 px-4">
          <span>
            {updateStatus?.state === 'downloading'
              ? `Загрузка обновления: ${updateStatus.percent}%.`
              : updateStatus?.state === 'downloaded'
                ? `Обновление ${updateStatus.version} готово к установке.`
                : updateStatus?.state === 'error'
                  ? `Ошибка обновления: ${updateStatus.message}`
                  : latestRelease
                    ? `Доступна новая версия ${latestRelease.version}.`
                    : `Не удалось проверить обновления: ${releaseCheckError}`}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {(latestRelease || releaseCheckError || updateStatus?.state === 'error') && (
              <button
                type="button"
                onClick={() => {
                  if (updateStatus?.state === 'error') {
                    setUpdateStatus(null);
                    checkForUpdates();
                  } else if (latestRelease && isAutoUpdateSupported) {
                    void window.electronAPI?.installUpdate().catch((error: unknown) => {
                      setUpdateStatus({
                        state: 'error',
                        message: error instanceof Error ? error.message : 'Не удалось установить обновление.',
                      });
                    });
                  } else if (latestRelease) {
                    setIsDownloadsOpen(true);
                  } else {
                    checkForUpdates();
                  }
                }}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                {updateStatus?.state === 'error' || releaseCheckError
                  ? 'Повторить проверку'
                  : isAutoUpdateSupported
                    ? 'Установить обновление'
                    : 'Скачать обновление'}
              </button>
            )}
            {updateStatus?.state === 'downloading' && (
              <span className="text-xs font-semibold">Не закрывайте приложение</span>
            )}
            <button
              type="button"
              onClick={() => {
                setLatestRelease(null);
                setReleaseCheckError(null);
                setUpdateStatus(null);
              }}
              className="rounded-lg px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900 transition-colors cursor-pointer"
              aria-label="Скрыть уведомление об обновлении"
            >
              Скрыть
            </button>
          </div>
        </div>
      )}

      {/* Error notification banner */}
      {errorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-500/50 text-rose-200 text-xs py-2.5 px-4 text-center font-semibold animate-in slide-in-from-top-2">
          {errorMessage}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center py-6 px-4">
        {/* 1. MAIN MENU */}
        {currentMode === 'menu' && (
          <MainMenu
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartPassAndPlay={() => {
              sound.playClick();
              setCurrentMode('pass_and_play');
            }}
            onOpenPacks={() => setIsPacksOpen(true)}
            onOpenServerGuide={() => setIsServerGuideOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isConnecting={isConnecting}
          />
        )}

        {/* 2. PASS & PLAY OFFLINE */}
        {currentMode === 'pass_and_play' && (
          <PassAndPlay
            customPacks={customPacks}
            onBackToMenu={() => {
              sound.playClick();
              setCurrentMode('menu');
            }}
          />
        )}

        {/* 3. ONLINE MULTIPLAYER SCREENS */}
        {currentMode === 'online' && roomState && localPlayer && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/50 text-xs font-semibold transition-colors cursor-pointer"
              >
                Выйти из комнаты
              </button>
            </div>

            {/* LOBBY */}
            {roomState.gameState.phase === 'lobby' && (
              <OnlineLobby
                roomState={roomState}
                localPlayer={localPlayer}
                customPacks={customPacks}
                onUpdateSettings={handleUpdateSettings}
                onSetModifier={handleSetModifier}
                onSetReady={handleSetReady}
                onStartGame={handleStartGame}
                onOpenChat={handleOpenChat}
                unreadChatCount={unreadChatCount}
              />
            )}

            {/* ROLE REVEALING */}
            {roomState.gameState.phase === 'revealing' && localSecret && !hasAcknowledgedRole && (
              <RoleReveal
                secret={localSecret}
                playerName={localPlayer.name}
                onAcknowledge={() => setHasAcknowledgedRole(true)}
              />
            )}

            {/* DISCUSSION */}
            {(roomState.gameState.phase === 'discussion' ||
              (roomState.gameState.phase === 'revealing' && hasAcknowledgedRole)) &&
              !isEarlyGuessOpen && (
              <DiscussionScreen
                gameState={roomState.gameState}
                players={roomState.players}
                localPlayer={localPlayer}
                secret={localSecret}
                onCallAccusation={handleCallAccusation}
                onSpyEarlyGuess={() => setIsEarlyGuessOpen(true)}
                onOpenChat={handleOpenChat}
                unreadChatCount={unreadChatCount}
              />
            )}

            {/* VOTING */}
            {roomState.gameState.phase === 'voting' && (
              <VotingScreen
                gameState={roomState.gameState}
                players={roomState.players}
                localPlayer={localPlayer}
                onCastVote={handleCastVote}
                onOpenChat={handleOpenChat}
                unreadChatCount={unreadChatCount}
              />
            )}

            {/* SPY GUESS */}
            {(roomState.gameState.phase === 'spy_guess' || isEarlyGuessOpen) && (
              <SpyGuessScreen
                isLocalSpy={Boolean(localSecret?.isSpy)}
                secret={localSecret}
                onGuessLocation={handleSpyGuess}
                onCancel={isEarlyGuessOpen ? () => setIsEarlyGuessOpen(false) : undefined}
              />
            )}

            {/* RESULTS */}
            {roomState.gameState.phase === 'ended' && (
              <ResultsScreen
                gameState={roomState.gameState}
                players={roomState.players}
                localPlayer={localPlayer}
                onRematch={handleRematch}
                onOpenChat={handleOpenChat}
                unreadChatCount={unreadChatCount}
              />
            )}
          </div>
        )}
      </main>

      {/* Docked WebRTC Voice Chat Bar when in online room */}
      {currentMode === 'online' && roomState && localPlayer && (
        <div className="sticky bottom-0 z-30 p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/80">
          <div className="max-w-5xl mx-auto">
            <VoiceChatBar
              players={roomState.players}
              localPlayerId={localPlayer.id}
              roundMuteEndsAt={
                roomState.gameState.phase === 'discussion' &&
                roomState.gameState.currentModifier?.type === 'silent_round'
                  ? roomState.gameState.currentModifier.eventEndsAt
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Slide-in Text Chat Drawer */}
      <ChatDrawer
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Modals */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ServerGuideModal isOpen={isServerGuideOpen} onClose={() => setIsServerGuideOpen(false)} />
      <DownloadsModal isOpen={isDownloadsOpen} onClose={() => setIsDownloadsOpen(false)} />
      <PacksManagerModal
        isOpen={isPacksOpen}
        onClose={() => setIsPacksOpen(false)}
        customPacks={customPacks}
        onUpdateCustomPacks={handleUpdateCustomPacks}
      />
    </div>
  );
}

export default App;
