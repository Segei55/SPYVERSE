import {
  GameModifier,
  GameSettings,
  GameState,
  LocationPack,
  Player,
  PlayerSecret,
  WinReason,
} from '../../shared/src/index';
import { AVAILABLE_MODIFIERS } from './modifiers';

export { AVAILABLE_MODIFIERS };

/**
 * Cryptographically secure random integer in range [min, max] inclusive
 */
export function cryptoRandomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error(`min (${min}) cannot be greater than max (${max})`);
  }
  const range = max - min + 1;
  if (range === 1) return min;

  const uint32Array = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(uint32Array);
  } else {
    // Fallback for environments where global crypto might be namespaced
    uint32Array[0] = Math.floor(Math.random() * 0xffffffff);
  }
  return min + (uint32Array[0] % range);
}

/**
 * Fisher-Yates shuffle using cryptographically secure PRNG
 */
export function secureShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(0, i);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export interface RoleAssignmentResult {
  secretLocationName: string;
  secrets: Record<string, PlayerSecret>;
  modifier: GameModifier | null;
}

/**
 * Assign roles and generate safe player secrets
 */
export function assignRoles(
  players: Player[],
  pack: LocationPack,
  settings: GameSettings
): RoleAssignmentResult {
  if (players.length < 3) {
    throw new Error('Для начала игры требуется минимум 3 игрока.');
  }

  const maxSpies = Math.max(1, Math.floor((players.length - 1) / 2));
  if (settings.spyCount < 1 || settings.spyCount > maxSpies) {
    throw new Error(`Недопустимое количество шпионов: ${settings.spyCount}. Допустимо от 1 до ${maxSpies}`);
  }

  if (!pack.locations || pack.locations.length === 0) {
    throw new Error('Игровой набор не содержит локаций.');
  }

  const secretLocation = pack.locations[cryptoRandomInt(0, pack.locations.length - 1)];
  if (!secretLocation?.roles || secretLocation.roles.length === 0) {
    throw new Error(`Локация «${secretLocation?.name ?? 'Неизвестно'}» не содержит ролей.`);
  }
  const allLocationNames = pack.locations.map((l) => l.name);

  // 2. Shuffle players to select spies
  const shuffledPlayerIndices = secureShuffle(players.map((_, i) => i));
  const spyIndices = new Set(shuffledPlayerIndices.slice(0, settings.spyCount));

  // 3. Shuffle roles for non-spies
  const availableRoles = secureShuffle([...secretLocation.roles]);

  const secrets: Record<string, PlayerSecret> = {};
  let civilianRoleIndex = 0;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const isSpy = spyIndices.has(i);

    if (isSpy) {
      secrets[player.id] = {
        playerId: player.id,
        isSpy: true,
        locationName: null,
        roleName: 'Шпион',
        allPossibleLocations: allLocationNames,
        spyTip: 'Слушайте вопросы других игроков, делайте вид, что знаете локацию, и вычислите её!',
      };
    } else {
      // If there are fewer roles than civilians, recycle or wrap
      const role = availableRoles[civilianRoleIndex % availableRoles.length];
      civilianRoleIndex++;

      secrets[player.id] = {
        playerId: player.id,
        isSpy: false,
        locationName: secretLocation.name,
        roleName: role,
        allPossibleLocations: allLocationNames,
        locationHint: secretLocation.hint,
      };
    }
  }

  // 4. Modifier selection if enabled
  let selectedModifier: GameModifier | null = null;
  const allowedModifiers = settings.modifierIds
    ? AVAILABLE_MODIFIERS.filter((modifier) => settings.modifierIds?.includes(modifier.id))
    : AVAILABLE_MODIFIERS;
  if (settings.enableModifiers && allowedModifiers.length > 0) {
    const modIdx = cryptoRandomInt(0, allowedModifiers.length - 1);
    selectedModifier = { ...allowedModifiers[modIdx], active: true };
  }

  return {
    secretLocationName: secretLocation.name,
    secrets,
    modifier: selectedModifier,
  };
}

export type VoteOutcome =
  | { outcome: 'no_votes' }
  | { outcome: 'tie_revote'; tiedPlayerIds: string[] }
  | { outcome: 'tie_no_elimination'; tiedPlayerIds: string[] }
  | { outcome: 'player_eliminated'; accusedPlayerId: string; voteCount: number; totalVotes: number };

/**
 * Tally player votes and determine the outcome
 */
export function calculateVoteResults(
  players: Player[],
  revoteCount: number,
  revoteOnTie: boolean
): VoteOutcome {
  const validPlayerIds = new Set(players.map((player) => player.id));
  const voteCounts: Record<string, number> = {};
  let totalVotes = 0;

  for (const player of players) {
    const voteTargetId = player.voteTargetId;
    if (typeof voteTargetId === 'string' && voteTargetId.trim() && validPlayerIds.has(voteTargetId)) {
      voteCounts[voteTargetId] = (voteCounts[voteTargetId] || 0) + 1;
      totalVotes++;
    }
  }

  if (totalVotes === 0) {
    return { outcome: 'no_votes' };
  }

  let maxVotes = 0;
  for (const count of Object.values(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
    }
  }

  const topPlayerIds = Object.keys(voteCounts).filter((id) => voteCounts[id] === maxVotes);

  if (topPlayerIds.length > 1) {
    if (revoteOnTie && revoteCount < 1) {
      return { outcome: 'tie_revote', tiedPlayerIds: topPlayerIds };
    }
    return { outcome: 'tie_no_elimination', tiedPlayerIds: topPlayerIds };
  }

  return {
    outcome: 'player_eliminated',
    accusedPlayerId: topPlayerIds[0],
    voteCount: maxVotes,
    totalVotes,
  };
}

/**
 * Check if the spy correctly guessed the secret location
 */
export function checkSpyGuess(guess: string, actualLocation: string): boolean {
  if (typeof guess !== 'string' || typeof actualLocation !== 'string' || !guess.trim() || !actualLocation.trim()) {
    return false;
  }

  const normalize = (value: string): string =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]/gu, '')
      .trim();

  return normalize(guess) === normalize(actualLocation);
}

/**
 * Generate public GameState with hidden secrets
 */
export function createInitialGameState(settings: GameSettings, modifier: GameModifier | null): GameState {
  let initialDuration = settings.roundDurationSeconds;
  if (modifier && modifier.type === 'time_reduced' && initialDuration > 0) {
    initialDuration = Math.round(initialDuration * 0.6); // 40% reduction
  }

  return {
    phase: 'lobby',
    roundTimeRemaining: initialDuration,
    isTimerPaused: false,
    currentModifier: modifier,
    votedOutPlayerId: null,
    winner: null,
    winReason: null,
    accusationsAllowed: settings.allowEarlyAccusations,
    revoteCount: 0,
  };
}
