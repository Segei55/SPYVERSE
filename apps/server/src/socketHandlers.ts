import { Server as SocketIOServer, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import {
  CastVotePayloadSchema,
  ChatSendPayloadSchema,
  CreateRoomPayloadSchema,
  GameSettingsSchema,
  JoinRoomPayloadSchema,
  SetModifierSelectionSchema,
  SpyGuessPayloadSchema,
  VoiceSignalPayloadSchema,
} from '../../../packages/shared/src/index';

export function setupSocketHandlers(io: SocketIOServer, roomManager: RoomManager): void {
  io.on('connection', (socket: Socket) => {
    // 1. Create Room
    socket.on('room_create', (payload: unknown) => {
      const parsed = CreateRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error_response', {
          code: 'INVALID_CREATE_PAYLOAD',
          message: parsed.error.issues[0]?.message || 'Неверные данные создания комнаты.',
        });
        return;
      }
      const { hostName, avatar, settings } = parsed.data;
      const result = roomManager.createRoom(socket, hostName, avatar, settings);
      socket.emit('room_created', result);
    });

    // 2. Join Room
    socket.on('room_join', (payload: unknown) => {
      const parsed = JoinRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error_response', {
          code: 'INVALID_JOIN_PAYLOAD',
          message: parsed.error.issues[0]?.message || 'Неверные данные подключения.',
        });
        return;
      }
      const { roomId, playerName, avatar, sessionToken } = parsed.data;
      const result = roomManager.joinRoom(socket, roomId, playerName, avatar, sessionToken);
      if (!result.success) {
        socket.emit('error_response', {
          code: 'JOIN_FAILED',
          message: result.error || 'Не удалось подключиться к комнате.',
        });
      } else {
        socket.emit('room_joined', {
          roomId,
          sessionToken: result.sessionToken,
          player: result.player,
        });
      }
    });

    // 3. Update Settings
    socket.on('room_update_settings', (payload: unknown) => {
      const parsed = GameSettingsSchema.safeParse(payload);
      if (parsed.success) {
        roomManager.updateSettings(socket, parsed.data);
      }
    });

    socket.on('room_set_modifier', (payload: unknown) => {
      const parsed = SetModifierSelectionSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error_response', {
          code: 'INVALID_MODIFIER_SELECTION',
          message: parsed.error.issues[0]?.message || 'Неверная настройка модификатора.',
        });
        return;
      }
      roomManager.setModifierSelection(
        socket,
        parsed.data.modifierId,
        parsed.data.isSelected
      );
    });

    // 4. Ready Status
    socket.on('player_ready', (isReady: boolean) => {
      roomManager.setPlayerReady(socket, Boolean(isReady));
    });

    // 5. Game Start
    socket.on('game_start', () => {
      roomManager.startGame(socket);
    });

    // 6. Call Accusation
    socket.on('game_call_accusation', (payload: { accusedId: string }) => {
      if (payload && typeof payload.accusedId === 'string') {
        roomManager.callAccusation(socket, payload.accusedId);
      }
    });

    // 7. Cast Vote
    socket.on('game_cast_vote', (payload: unknown) => {
      const parsed = CastVotePayloadSchema.safeParse(payload);
      if (parsed.success) {
        roomManager.castVote(socket, parsed.data.targetPlayerId);
      }
    });

    // 8. Spy Guess Location
    socket.on('game_spy_guess', (payload: unknown) => {
      const parsed = SpyGuessPayloadSchema.safeParse(payload);
      if (parsed.success) {
        roomManager.spyGuess(socket, parsed.data.guessedLocationName);
      }
    });

    // 9. Rematch
    socket.on('game_rematch', () => {
      roomManager.rematch(socket);
    });

    // 10. Chat Message
    socket.on('chat_send', (payload: unknown) => {
      const parsed = ChatSendPayloadSchema.safeParse(payload);
      if (parsed.success) {
        roomManager.sendChat(socket, parsed.data.text);
      }
    });

    // 11. WebRTC Voice Signaling
    socket.on('voice_signal', (payload: unknown) => {
      const parsed = VoiceSignalPayloadSchema.safeParse(payload);
      if (parsed.success) {
        roomManager.handleVoiceSignal(socket, parsed.data.targetPeerId, parsed.data.signalData);
      }
    });

    // 12. WebRTC Voice State (Mute / Speaking indicator)
    socket.on('voice_state_update', (payload: { isMuted: boolean; isSpeaking: boolean }) => {
      if (payload && typeof payload.isMuted === 'boolean') {
        roomManager.updateVoiceState(socket, payload.isMuted, Boolean(payload.isSpeaking));
      }
    });

    // 13. Leave Room (explicit exit from the UI)
    socket.on('room_leave', () => {
      roomManager.leaveRoom(socket);
    });

    // 14. Disconnect
    socket.on('disconnect', () => {
      roomManager.handleDisconnect(socket);
    });
  });
}
