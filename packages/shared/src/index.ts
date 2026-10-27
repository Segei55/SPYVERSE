import { z } from 'zod';

export type GamePhase =
  | 'setup'
  | 'lobby'
  | 'revealing'
  | 'discussion'
  | 'voting'
  | 'spy_guess'
  | 'ended';

export type WinReason =
  | 'spies_unanimous_vote'      // Civilians voted out a spy
  | 'civilians_wrong_vote'      // Civilians voted out an innocent
  | 'spy_guessed_location'      // Spy correctly guessed location
  | 'spy_wrong_guess'          // Spy guessed location incorrectly
  | 'time_expired_spy_wins'    // Time ran out without voting out spy
  | 'civilians_majority_vote'   // Majority caught spy
  | 'host_terminated';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isConnected: boolean;
  isReady: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  voteTargetId?: string | null;
  hasAccused?: boolean;
}

export interface PlayerSecret {
  playerId: string;
  isSpy: boolean;
  locationName: string | null;
  roleName: string;
  allPossibleLocations: string[];
  spyTip?: string;
  locationHint?: string;
}

export interface GameModifier {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'time_reduced' | 'whisper_mode' | 'blind_vote' | 'double_agent' | 'radio_static';
  active: boolean;
}

export interface LocationItem {
  id: string;
  name: string;
  roles: string[];
  hint?: string;
}

export interface LocationPack {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  locations: LocationItem[];
  isCustom?: boolean;
}

export interface GameSettings {
  roundDurationSeconds: number; // 180, 300, 480, 600, or 0 (unlimited)
  spyCount: number;
  packIds: string[];
  modifierIds?: string[];
  customPacks?: LocationPack[];
  enableModifiers: boolean;
  allowEarlyAccusations: boolean;
  revoteOnTie: boolean;
}

export interface GameState {
  phase: GamePhase;
  roundTimeRemaining: number;
  isTimerPaused: boolean;
  currentModifier?: GameModifier | null;
  votedOutPlayerId?: string | null;
  winner?: 'civilians' | 'spies' | null;
  winReason?: WinReason | string | null;
  accusationsAllowed: boolean;
  revoteCount: number;
  secretLocationName?: string; // Only revealed to all when phase === 'ended'
  revealedRoles?: Record<string, { roleName: string; isSpy: boolean; locationName: string }>;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  settings: GameSettings;
  players: Player[];
  gameState: GameState;
  selectedPackName: string;
}

export interface ServerNetworkInterface {
  name: string;
  address: string;
  family: string;
  type: 'lan' | 'vpn' | 'loopback' | 'other';
}

export interface ServerInfo {
  version: string;
  port: number;
  activeRoomsCount: number;
  totalConnectedClients: number;
  uptimeSeconds: number;
  interfaces: ServerNetworkInterface[];
}

// ==================== ZOD SCHEMAS FOR VALIDATION ====================

export const LocationItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  roles: z.array(z.string().min(1).max(100)).min(3, 'Локация должна содержать минимум 3 роли'),
  hint: z.string().max(300).optional(),
});

export const LocationPackSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  category: z.string().min(1).max(50),
  version: z.string().default('1.0.0'),
  author: z.string().default('Пользователь'),
  locations: z.array(LocationItemSchema).min(4, 'Набор должен содержать минимум 4 локации'),
  isCustom: z.boolean().optional(),
});

export const GameSettingsSchema = z.object({
  roundDurationSeconds: z.number().int().min(0).max(3600),
  spyCount: z.number().int().min(1).max(5),
  packIds: z.array(z.string()).min(1, 'Выберите хотя бы один набор'),
  modifierIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  enableModifiers: z.boolean(),
  allowEarlyAccusations: z.boolean(),
  revoteOnTie: z.boolean(),
  customPacks: z.array(LocationPackSchema).max(50).optional(),
});

export const SetModifierSelectionSchema = z.object({
  modifierId: z.string().min(1).max(64),
  isSelected: z.boolean(),
});

export const CreateRoomPayloadSchema = z.object({
  hostName: z.string().trim().min(1).max(24),
  avatar: z.string().default('agent-1'),
  settings: GameSettingsSchema.optional(),
});

export const JoinRoomPayloadSchema = z.object({
  roomId: z.string().trim().toUpperCase().min(3).max(12),
  playerName: z.string().trim().min(1).max(24),
  avatar: z.string().default('agent-2'),
  sessionToken: z.string().optional(),
});

export const ChatSendPayloadSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const VoiceSignalPayloadSchema = z.object({
  targetPeerId: z.string().min(1),
  signalData: z.any(),
});

export const CastVotePayloadSchema = z.object({
  targetPlayerId: z.string().min(1),
});

export const SpyGuessPayloadSchema = z.object({
  guessedLocationName: z.string().trim().min(1).max(100),
});
