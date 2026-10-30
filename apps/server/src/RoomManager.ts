import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ChatMessage,
  GameSettings,
  GameState,
  LocationPack,
  Player,
  PlayerSecret,
  RoomState,
} from '../../../packages/shared/src/index';
import {
  OFFICIAL_PACKS,
  findPackById,
  mergeLocationPacks,
} from '../../../packages/content/src/index';
import {
  AVAILABLE_MODIFIERS,
  assignRoles,
  calculateVoteResults,
  checkSpyGuess,
  createInitialGameState,
} from '../../../packages/game-engine/src/index';
import { loadRoomChatHistory, saveRoomChatHistory } from './storage';

export interface ServerRoom {
  roomId: string;
  hostId: string;
  players: Map<string, Player>;
  socketToPlayer: Map<string, string>; // socketId -> playerId
  playerToSocket: Map<string, string>; // playerId -> socketId
  sessionTokens: Map<string, string>;  // sessionToken -> playerId
  settings: GameSettings;
  gameState: GameState;
  selectedPack: LocationPack;
  secrets: Record<string, PlayerSecret>;
  chatHistory: ChatMessage[];
  timerInterval: NodeJS.Timeout | null;
  lastActionTimestamps: Map<string, number>; // rate limiting
}

export class RoomManager {
  private io: SocketIOServer;
  private rooms: Map<string, ServerRoom> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public getTotalPlayerCount(): number {
    let total = 0;
    for (const r of this.rooms.values()) {
      total += r.players.size;
    }
    return total;
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(
    socket: Socket,
    hostName: string,
    avatar: string,
    customSettings?: Partial<GameSettings>
  ): { roomId: string; sessionToken: string; player: Player } {
    const roomId = this.generateRoomCode();
    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const sessionToken = `tok_${Math.random().toString(36).substring(2, 15)}`;

    const defaultPack = OFFICIAL_PACKS[0];
    const settings: GameSettings = {
      roundDurationSeconds: 300,
      spyCount: 1,
      packIds: [defaultPack.id],
      modifierIds: customSettings?.modifierIds ?? AVAILABLE_MODIFIERS.map((modifier) => modifier.id),
      enableModifiers: true,
      allowEarlyAccusations: true,
      revoteOnTie: true,
      ...customSettings,
    };

    const hostPlayer: Player = {
      id: playerId,
      name: hostName,
      avatar,
      isHost: true,
      isConnected: true,
      isReady: true,
      isMuted: false,
      isSpeaking: false,
    };

    const room: ServerRoom = {
      roomId,
      hostId: playerId,
      players: new Map([[playerId, hostPlayer]]),
      socketToPlayer: new Map([[socket.id, playerId]]),
      playerToSocket: new Map([[playerId, socket.id]]),
      sessionTokens: new Map([[sessionToken, playerId]]),
      settings,
      gameState: createInitialGameState(settings, null),
      selectedPack: defaultPack,
      secrets: {},
      chatHistory: loadRoomChatHistory(roomId),
      timerInterval: null,
      lastActionTimestamps: new Map(),
    };

    this.rooms.set(roomId, room);
    socket.join(roomId);
    // Рассылаем состояние комнаты сразу, иначе хост не получит экран лобби
    this.broadcastRoomUpdate(room);

    return { roomId, sessionToken, player: hostPlayer };
  }

  public joinRoom(
    socket: Socket,
    roomId: string,
    playerName: string,
    avatar: string,
    sessionToken?: string
  ): { success: boolean; error?: string; sessionToken?: string; player?: Player } {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      return { success: false, error: 'Комната с таким кодом не найдена.' };
    }

    // Check if reconnecting via sessionToken
    if (sessionToken && room.sessionTokens.has(sessionToken)) {
      const existingPlayerId = room.sessionTokens.get(sessionToken)!;
      const existingPlayer = room.players.get(existingPlayerId);
      if (existingPlayer) {
        existingPlayer.isConnected = true;
        room.socketToPlayer.set(socket.id, existingPlayerId);
        room.playerToSocket.set(existingPlayerId, socket.id);
        socket.join(room.roomId);

        this.broadcastRoomUpdate(room);

        // Resend secret if game is active
        if (room.gameState.phase !== 'lobby' && room.secrets[existingPlayerId]) {
          socket.emit('player_secret', room.secrets[existingPlayerId]);
        }

        return { success: true, sessionToken, player: existingPlayer };
      }
    }

    if (room.gameState.phase !== 'lobby') {
      return { success: false, error: 'Игра в этой комнате уже началась.' };
    }

    if (room.players.size >= 16) {
      return { success: false, error: 'В комнате достигнут лимит игроков (максимум 16).' };
    }

    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const newSessionToken = `tok_${Math.random().toString(36).substring(2, 15)}`;

    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      avatar,
      isHost: false,
      isConnected: true,
      isReady: false,
      isMuted: false,
      isSpeaking: false,
    };

    room.players.set(playerId, newPlayer);
    room.socketToPlayer.set(socket.id, playerId);
    room.playerToSocket.set(playerId, socket.id);
    room.sessionTokens.set(newSessionToken, playerId);

    socket.join(room.roomId);
    this.broadcastRoomUpdate(room);

    this.addSystemChatMessage(room, `Игрок ${playerName} присоединился к комнате.`);

    return { success: true, sessionToken: newSessionToken, player: newPlayer };
  }

  public updateSettings(socket: Socket, newSettings: GameSettings): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (playerId !== room.hostId) return; // Only host can update

    // Пользовательские наборы используются только для выбора, в настройках комнаты не храним
    const { customPacks, ...sharedSettings } = newSettings;

    const packIds = [...new Set(sharedSettings.packIds)];
    const selectedPacks: LocationPack[] = [];
    for (const packId of packIds) {
      const pack = findPackById(packId, customPacks);
      if (!pack) {
        socket.emit('error_response', {
          code: 'PACK_NOT_FOUND',
          message: 'Один или несколько выбранных наборов локаций не найдены на сервере.',
        });
        return;
      }
      selectedPacks.push(pack);
    }
    const pack = mergeLocationPacks(selectedPacks);
    if (!pack) {
      socket.emit('error_response', {
        code: 'PACK_NOT_FOUND',
        message: 'Не удалось объединить выбранные наборы локаций.',
      });
      return;
    }

    // Validate spy count
    const maxSpies = Math.max(1, Math.floor((room.players.size - 1) / 2));
    room.settings = {
      ...sharedSettings,
      packIds,
      modifierIds:
        sharedSettings.modifierIds ??
        room.settings.modifierIds ??
        AVAILABLE_MODIFIERS.map((modifier) => modifier.id),
      spyCount: Math.min(sharedSettings.spyCount, maxSpies),
    };
    room.selectedPack = pack;

    this.broadcastRoomUpdate(room);
  }

  public setModifierSelection(socket: Socket, modifierId: string, isSelected: boolean): void {
    const room = this.getRoomBySocket(socket);
    if (!room || room.socketToPlayer.get(socket.id) !== room.hostId) return;
    if (!AVAILABLE_MODIFIERS.some((modifier) => modifier.id === modifierId)) return;

    const selectedIds = new Set(
      room.settings.modifierIds ?? AVAILABLE_MODIFIERS.map((modifier) => modifier.id)
    );
    if (isSelected) {
      selectedIds.add(modifierId);
    } else {
      selectedIds.delete(modifierId);
    }

    room.settings = { ...room.settings, modifierIds: Array.from(selectedIds) };
    this.broadcastRoomUpdate(room);
  }

  public setPlayerReady(socket: Socket, isReady: boolean): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const player = room.players.get(playerId);
    if (player) {
      player.isReady = isReady;
      this.broadcastRoomUpdate(room);
    }
  }

  public startGame(socket: Socket): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (playerId !== room.hostId) return;

    if (room.players.size < 3) {
      socket.emit('error_response', {
        code: 'NOT_ENOUGH_PLAYERS',
        message: 'Для начала игры необходимо минимум 3 игрока.',
      });
      return;
    }

    const maxSpies = Math.max(1, Math.floor((room.players.size - 1) / 2));
    if (room.settings.spyCount > maxSpies) {
      socket.emit('error_response', {
        code: 'INVALID_SPY_COUNT',
        message: 'Количество шпионов превышает допустимое для текущего числа игроков.',
      });
      return;
    }

    // Role assignment
    const playerList = Array.from(room.players.values());
    const pack = room.selectedPack || OFFICIAL_PACKS[0];

    const result = assignRoles(playerList, pack, room.settings);
    room.secrets = result.secrets;

    // Reset votes & state
    for (const p of room.players.values()) {
      p.voteTargetId = null;
      p.hasAccused = false;
    }

    room.gameState = {
      phase: 'revealing',
      roundTimeRemaining: room.settings.roundDurationSeconds,
      isTimerPaused: false,
      currentModifier: result.modifier,
      votedOutPlayerId: null,
      winner: null,
      winReason: null,
      accusationsAllowed: room.settings.allowEarlyAccusations,
      revoteCount: 0,
      secretLocationName: undefined, // Hidden!
      revealedRoles: undefined,
    };

    // Apply modifier if blitz
    if (result.modifier?.type === 'time_reduced' && room.gameState.roundTimeRemaining > 0) {
      room.gameState.roundTimeRemaining = Math.round(room.gameState.roundTimeRemaining * 0.6);
    }

    this.broadcastRoomUpdate(room);

    // Send individual secret to each connected socket
    for (const [pId, secret] of Object.entries(result.secrets)) {
      const sId = room.playerToSocket.get(pId);
      if (sId) {
        this.io.to(sId).emit('player_secret', secret);
      }
    }

    this.addSystemChatMessage(room, 'Раунд начался! Ознакомьтесь с секретными ролями.');

    // Transition to discussion after 10 seconds or when all ready
    setTimeout(() => {
      if (room.gameState.phase === 'revealing') {
        this.startDiscussionPhase(room);
      }
    }, 10000);
  }

  public startDiscussionPhase(room: ServerRoom): void {
    room.gameState.phase = 'discussion';
    this.broadcastRoomUpdate(room);
    this.startTimer(room);
    this.addSystemChatMessage(room, 'Фаза обсуждения! Задавайте вопросы и ищите шпиона.');
  }

  private startTimer(room: ServerRoom): void {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
    }

    if (room.gameState.roundTimeRemaining <= 0) return; // Unlimited mode

    room.timerInterval = setInterval(() => {
      if (room.gameState.isTimerPaused) return;

      room.gameState.roundTimeRemaining--;

      if (room.gameState.roundTimeRemaining <= 0) {
        clearInterval(room.timerInterval!);
        room.timerInterval = null;

        if (room.gameState.phase === 'discussion') {
          // Time expired! Initiate voting
          this.initiateVoting(room, 'Время раунда истекло! Переход к общему голосованию.');
        } else if (room.gameState.phase === 'voting') {
          // Voting time expired! Auto-resolve
          this.resolveVoting(room);
        }
      } else if (room.gameState.roundTimeRemaining % 5 === 0 || room.gameState.roundTimeRemaining <= 10) {
        // Periodic sync
        this.broadcastRoomUpdate(room);
      }
    }, 1000);
  }

  public callAccusation(socket: Socket, accusedId: string): void {
    const room = this.getRoomBySocket(socket);
    if (!room || room.gameState.phase !== 'discussion' || !room.gameState.accusationsAllowed) return;
    const callerId = room.socketToPlayer.get(socket.id);
    if (!callerId) return;

    const caller = room.players.get(callerId);
    const accused = room.players.get(accusedId);
    if (!caller || !accused || callerId === accusedId) return;

    this.initiateVoting(
      room,
      `${caller.name} выдвинул обвинение против ${accused.name}! Начинается голосование.`
    );
  }

  private initiateVoting(room: ServerRoom, reasonText: string): void {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    room.gameState.phase = 'voting';
    for (const p of room.players.values()) {
      p.voteTargetId = null;
    }

    this.addSystemChatMessage(room, reasonText);
    this.broadcastRoomUpdate(room);
  }

  public castVote(socket: Socket, targetPlayerId: string): void {
    const room = this.getRoomBySocket(socket);
    if (!room || room.gameState.phase !== 'voting') return;
    const voterId = room.socketToPlayer.get(socket.id);
    if (!voterId) return;

    const voter = room.players.get(voterId);
    if (!voter) return;
    // Нельзя голосовать за себя и за несуществующего игрока
    if (voterId === targetPlayerId || !room.players.has(targetPlayerId)) return;

    voter.voteTargetId = targetPlayerId;
    this.broadcastRoomUpdate(room);

    // If all active players voted, resolve immediately
    const connectedPlayers = Array.from(room.players.values()).filter((p) => p.isConnected);
    const allVoted = connectedPlayers.every((p) => p.voteTargetId);
    if (allVoted) {
      this.resolveVoting(room);
    }
  }

  private resolveVoting(room: ServerRoom): void {
    const playerList = Array.from(room.players.values());
    const voteResult = calculateVoteResults(
      playerList,
      room.gameState.revoteCount,
      room.settings.revoteOnTie
    );

    if (voteResult.outcome === 'no_votes') {
      this.addSystemChatMessage(room, 'Никто не проголосовал. Возврат к обсуждению.');
      this.startDiscussionPhase(room);
      return;
    }

    if (voteResult.outcome === 'tie_revote') {
      room.gameState.revoteCount++;
      for (const p of room.players.values()) {
        p.voteTargetId = null;
      }
      this.addSystemChatMessage(room, 'Ничья! Объявляется повторное решающее голосование.');
      this.broadcastRoomUpdate(room);
      return;
    }

    if (voteResult.outcome === 'tie_no_elimination') {
      this.addSystemChatMessage(room, 'Голоса разделились поровну. Никто не исключён, возвращаемся к обсуждению.');
      this.startDiscussionPhase(room);
      return;
    }

    // A player is eliminated!
    const accusedId = voteResult.accusedPlayerId;
    const accusedPlayer = room.players.get(accusedId);
    const accusedSecret = room.secrets[accusedId];

    room.gameState.votedOutPlayerId = accusedId;

    if (accusedSecret && accusedSecret.isSpy) {
      // Civilians correctly identified the spy! Give spy a chance to guess the location
      this.addSystemChatMessage(
        room,
        `Игроки раскрыли шпиона: ${accusedPlayer?.name || accusedId}! У шпиона есть 1 попытка угадать локацию.`
      );
      room.gameState.phase = 'spy_guess';
      this.broadcastRoomUpdate(room);
    } else {
      // Civilians voted out an innocent! Spies win!
      this.addSystemChatMessage(
        room,
        `Игроки ошиблись и исключили мирного жителя: ${accusedPlayer?.name || accusedId}! Шпионы побеждают.`
      );
      this.endGame(room, 'spies', 'civilians_wrong_vote');
    }
  }

  public spyGuess(socket: Socket, guessedLocation: string): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const secret = room.secrets[playerId];
    if (!secret || !secret.isSpy) return; // Only spy can guess

    // Spy can guess either during 'spy_guess' phase OR make an early guess in 'discussion' phase
    if (room.gameState.phase !== 'spy_guess' && room.gameState.phase !== 'discussion') {
      return;
    }

    // Find actual secret location name from any civilian secret
    let actualLocationName = '';
    for (const s of Object.values(room.secrets)) {
      if (!s.isSpy && s.locationName) {
        actualLocationName = s.locationName;
        break;
      }
    }

    const isCorrect = checkSpyGuess(guessedLocation, actualLocationName);
    const spyName = room.players.get(playerId)?.name || 'Шпион';

    if (isCorrect) {
      this.addSystemChatMessage(
        room,
        `Шпион (${spyName}) правильно угадал локацию «${actualLocationName}»! Победа шпионов!`
      );
      this.endGame(room, 'spies', 'spy_guessed_location');
    } else {
      this.addSystemChatMessage(
        room,
        `Шпион (${spyName}) назвал неверную локацию «${guessedLocation}»! Секретная локация: «${actualLocationName}». Победа мирных жителей!`
      );
      this.endGame(room, 'civilians', 'spy_wrong_guess');
    }
  }

  private endGame(room: ServerRoom, winner: 'civilians' | 'spies', reason: string): void {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    let actualLocationName = '';
    const revealed: Record<string, { roleName: string; isSpy: boolean; locationName: string }> = {};

    for (const [pId, s] of Object.entries(room.secrets)) {
      if (!s.isSpy && s.locationName) {
        actualLocationName = s.locationName;
      }
      revealed[pId] = {
        roleName: s.roleName,
        isSpy: s.isSpy,
        locationName: s.locationName || actualLocationName,
      };
    }

    room.gameState.phase = 'ended';
    room.gameState.winner = winner;
    room.gameState.winReason = reason;
    room.gameState.secretLocationName = actualLocationName;
    room.gameState.revealedRoles = revealed;

    this.broadcastRoomUpdate(room);
  }

  public rematch(socket: Socket): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (playerId !== room.hostId) return;

    room.gameState = createInitialGameState(room.settings, null);
    room.secrets = {};

    for (const p of room.players.values()) {
      p.isReady = p.isHost;
      p.voteTargetId = null;
      p.hasAccused = false;
    }

    this.addSystemChatMessage(room, 'Хост начал подготовку к новому раунду.');
    this.broadcastRoomUpdate(room);
  }

  public sendChat(socket: Socket, text: string): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const player = room.players.get(playerId);
    if (!player) return;

    // Rate limiting: max 1 message per 300ms
    const now = Date.now();
    const lastTime = room.lastActionTimestamps.get(playerId) || 0;
    if (now - lastTime < 300) return;
    room.lastActionTimestamps.set(playerId, now);

    const message: ChatMessage = {
      id: `msg_${Math.random().toString(36).substring(2, 9)}`,
      roomId: room.roomId,
      senderId: playerId,
      senderName: player.name,
      senderAvatar: player.avatar,
      text: text.slice(0, 500),
      timestamp: now,
      isSystem: false,
    };

    room.chatHistory.push(message);
    if (room.chatHistory.length > 200) {
      room.chatHistory.shift();
    }

    this.io.to(room.roomId).emit('chat_message', message);
    saveRoomChatHistory(room.roomId, room.chatHistory);
  }

  private addSystemChatMessage(room: ServerRoom, text: string): void {
    const message: ChatMessage = {
      id: `sys_${Math.random().toString(36).substring(2, 9)}`,
      roomId: room.roomId,
      senderId: 'system',
      senderName: 'СИСТЕМА',
      senderAvatar: 'system',
      text,
      timestamp: Date.now(),
      isSystem: true,
    };

    room.chatHistory.push(message);
    this.io.to(room.roomId).emit('chat_message', message);
    saveRoomChatHistory(room.roomId, room.chatHistory);
  }

  // ==================== WEBRTC VOICE SIGNALING ====================

  public handleVoiceSignal(socket: Socket, targetPeerId: string, signalData: unknown): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const senderPeerId = room.socketToPlayer.get(socket.id);
    if (!senderPeerId) return;

    const targetSocketId = room.playerToSocket.get(targetPeerId);
    if (targetSocketId) {
      this.io.to(targetSocketId).emit('voice_signal', {
        senderPeerId,
        signalData,
      });
    }
  }

  public updateVoiceState(socket: Socket, isMuted: boolean, isSpeaking: boolean): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const player = room.players.get(playerId);
    if (player) {
      player.isMuted = isMuted;
      player.isSpeaking = isSpeaking;
      this.io.to(room.roomId).emit('voice_state_changed', {
        peerId: playerId,
        isMuted,
        isSpeaking,
      });
    }
  }

  public handleDisconnect(socket: Socket): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const player = room.players.get(playerId);
    if (player) {
      player.isConnected = false;
      this.addSystemChatMessage(room, `Игрок ${player.name} временно отключился.`);
      this.broadcastRoomUpdate(room);

      // If host disconnected and nobody else, or if empty after 5 minutes, clean up
      setTimeout(() => {
        const p = room.players.get(playerId);
        if (p && !p.isConnected && room.gameState.phase === 'lobby') {
          room.players.delete(playerId);
          this.normalizeSpyCount(room);
          this.broadcastRoomUpdate(room);
          if (room.players.size === 0) {
            this.rooms.delete(room.roomId);
          }
        }
      }, 300000);
    }
  }

  /**
   * Игрок добровольно покидает комнату.
   * В лобби место освобождается, в активной партии игрок помечается отключённым и может вернуться по токену.
   */
  public leaveRoom(socket: Socket): void {
    const room = this.getRoomBySocket(socket);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const player = room.players.get(playerId);
    room.socketToPlayer.delete(socket.id);
    room.playerToSocket.delete(playerId);
    socket.leave(room.roomId);

    if (!player) return;

    if (room.gameState.phase === 'lobby') {
      room.players.delete(playerId);
      this.normalizeSpyCount(room);
      for (const [token, ownerId] of room.sessionTokens) {
        if (ownerId === playerId) room.sessionTokens.delete(token);
      }
      this.addSystemChatMessage(room, `Игрок ${player.name} покинул комнату.`);
    } else {
      player.isConnected = false;
      this.addSystemChatMessage(room, `Игрок ${player.name} покинул партию.`);
    }

    if (room.players.size === 0) {
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
      }
      this.rooms.delete(room.roomId);
      return;
    }

    // Если вышел хост из лобби, передаём права первому оставшемуся игроку
    if (playerId === room.hostId && room.gameState.phase === 'lobby') {
      const nextHost = Array.from(room.players.values())[0];
      room.hostId = nextHost.id;
      for (const p of room.players.values()) {
        p.isHost = p.id === nextHost.id;
      }
      this.addSystemChatMessage(room, `Новым хостом назначен ${nextHost.name}.`);
    }

    this.broadcastRoomUpdate(room);
  }

  private getRoomBySocket(socket: Socket): ServerRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.socketToPlayer.has(socket.id)) {
        return room;
      }
    }
    return undefined;
  }

  private normalizeSpyCount(room: ServerRoom): void {
    const maxSpies = Math.max(1, Math.floor((room.players.size - 1) / 2));
    room.settings.spyCount = Math.min(room.settings.spyCount, maxSpies);
  }

  public getPublicRoomState(room: ServerRoom): RoomState {
    return {
      roomId: room.roomId,
      hostId: room.hostId,
      settings: room.settings,
      players: Array.from(room.players.values()),
      gameState: room.gameState,
      selectedPackName: room.selectedPack?.name || 'Стандартный',
    };
  }

  public broadcastRoomUpdate(room: ServerRoom): void {
    this.io.to(room.roomId).emit('room_state_update', this.getPublicRoomState(room));
  }
}
