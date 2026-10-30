import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABLE_MODIFIERS,
  assignRoles,
  calculateVoteResults,
  checkSpyGuess,
  cryptoRandomInt,
  secureShuffle,
} from '../index';
import { Player, GameSettings, LocationPack } from '../../../shared/src/index';

const mockPack: LocationPack = {
  id: 'test_pack',
  name: 'Тестовый набор',
  description: 'Для unit-тестов',
  category: 'Тест',
  version: '1.0.0',
  author: 'Tester',
  locations: [
    {
      id: 'loc_1',
      name: 'Космическая станция',
      roles: ['Командир', 'Инженер', 'Пилот', 'Ученый', 'Врач', 'Турист'],
      hint: 'Невесомость',
    },
    {
      id: 'loc_2',
      name: 'Подводная лодка',
      roles: ['Капитан', 'Акустик', 'Торпедист', 'Кок', 'Штурман', 'Матрос'],
      hint: 'Глубина',
    },
  ],
};

const mockSettings: GameSettings = {
  roundDurationSeconds: 300,
  spyCount: 1,
  packIds: ['test_pack'],
  enableModifiers: false,
  allowEarlyAccusations: true,
  revoteOnTie: true,
};

function createMockPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player_${i + 1}`,
    name: `Игрок ${i + 1}`,
    avatar: `avatar-${(i % 6) + 1}`,
    isHost: i === 0,
    isConnected: true,
    isReady: true,
    isMuted: false,
    isSpeaking: false,
  }));
}

test('cryptoRandomInt generates values within range', () => {
  for (let i = 0; i < 50; i++) {
    const val = cryptoRandomInt(3, 7);
    assert.ok(val >= 3 && val <= 7, `Value ${val} should be between 3 and 7`);
  }
});

test('secureShuffle preserves length and elements', () => {
  const original = [1, 2, 3, 4, 5, 6, 7];
  const shuffled = secureShuffle(original);
  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort(), [...original].sort());
});

test('assignRoles correctly assigns spies and civilians without leaks', () => {
  const players = createMockPlayers(5);
  const result = assignRoles(players, mockPack, mockSettings);

  assert.ok(result.secretLocationName === 'Космическая станция' || result.secretLocationName === 'Подводная лодка');

  const secrets = Object.values(result.secrets);
  assert.equal(secrets.length, 5);

  const spies = secrets.filter((s) => s.isSpy);
  const civilians = secrets.filter((s) => !s.isSpy);

  assert.equal(spies.length, 1, 'Should have exactly 1 spy');
  assert.equal(civilians.length, 4, 'Should have exactly 4 civilians');

  // Spy must NOT know the secret location
  assert.equal(spies[0].locationName, null);
  assert.equal(spies[0].roleName, 'Шпион');
  assert.equal(spies[0].allPossibleLocations.length, 2);

  // Civilians MUST know the secret location and have a valid role
  for (const civilian of civilians) {
    assert.equal(civilian.locationName, result.secretLocationName);
    assert.ok(civilian.roleName.length > 0);
  }
});

test('assignRoles assigns the selected number of spies', () => {
  const players = createMockPlayers(5);
  const result = assignRoles(players, mockPack, { ...mockSettings, spyCount: 2 });
  const spyCount = Object.values(result.secrets).filter((secret) => secret.isSpy).length;

  assert.equal(spyCount, 2);
});

test('assignRoles selects only an enabled modifier from the configured list', () => {
  const players = createMockPlayers(5);
  const result = assignRoles(players, mockPack, {
    ...mockSettings,
    enableModifiers: true,
    modifierIds: ['mod_blind_vote'],
  });

  assert.equal(result.modifier?.id, 'mod_blind_vote');
});

test('assignRoles skips modifiers when none are selected', () => {
  const players = createMockPlayers(5);
  const result = assignRoles(players, mockPack, {
    ...mockSettings,
    enableModifiers: true,
    modifierIds: [],
  });

  assert.equal(result.modifier, null);
});

test('assignRoles skips selected modifiers when modifiers are disabled', () => {
  const players = createMockPlayers(5);
  const result = assignRoles(players, mockPack, {
    ...mockSettings,
    modifierIds: ['mod_blind_vote'],
    enableModifiers: false,
  });

  assert.equal(result.modifier, null);
});

test('assignRoles rejects invalid player count and spy count', () => {
  const players2 = createMockPlayers(2);
  assert.throws(() => {
    assignRoles(players2, mockPack, mockSettings);
  }, /минимум 3 игрока/);

  const players5 = createMockPlayers(5);
  assert.throws(() => {
    assignRoles(players5, mockPack, { ...mockSettings, spyCount: 3 });
  }, /Недопустимое количество шпионов/);
});

test('the game offers fifteen distinct round modifiers', () => {
  assert.equal(AVAILABLE_MODIFIERS.length, 15);
  assert.equal(new Set(AVAILABLE_MODIFIERS.map((modifier) => modifier.id)).size, 15);
});

test('hot seat selects a player in the current game', () => {
  const players = createMockPlayers(5);
  const result = assignRoles(players, mockPack, {
    ...mockSettings,
    enableModifiers: true,
    modifierIds: ['mod_hot_seat'],
  });

  assert.equal(result.modifier?.type, 'hot_seat');
  assert.ok(players.some((player) => player.id === result.modifier?.eventTargetId));
});

test('event modifiers include shared data and false leads do not reveal the location', () => {
  const players = createMockPlayers(5);
  const cipherGame = assignRoles(players, mockPack, {
    ...mockSettings,
    enableModifiers: true,
    modifierIds: ['mod_cipher'],
  });
  assert.equal(cipherGame.modifier?.type, 'cipher_challenge');
  assert.ok(cipherGame.modifier?.cipherChallenge?.clue);
  assert.ok(cipherGame.modifier?.cipherChallenge?.solution);

  const falseLeadGame = assignRoles(players, mockPack, {
    ...mockSettings,
    enableModifiers: true,
    modifierIds: ['mod_false_lead'],
  });
  const spy = Object.values(falseLeadGame.secrets).find((secret) => secret.isSpy);
  assert.ok(spy?.spyTip);
  assert.ok(
    mockPack.locations
      .filter((location) => location.name !== falseLeadGame.secretLocationName)
      .some((location) => spy?.spyTip?.includes(location.name))
  );
});

test('calculateVoteResults detects majority elimination', () => {
  const players = createMockPlayers(4);
  players[0].voteTargetId = 'player_3';
  players[1].voteTargetId = 'player_3';
  players[2].voteTargetId = 'player_3';
  players[3].voteTargetId = 'player_1';

  const result = calculateVoteResults(players, 0, true);
  assert.equal(result.outcome, 'player_eliminated');
  if (result.outcome === 'player_eliminated') {
    assert.equal(result.accusedPlayerId, 'player_3');
    assert.equal(result.voteCount, 3);
  }
});

test('calculateVoteResults handles tie with revote', () => {
  const players = createMockPlayers(4);
  players[0].voteTargetId = 'player_1';
  players[1].voteTargetId = 'player_1';
  players[2].voteTargetId = 'player_2';
  players[3].voteTargetId = 'player_2';

  const result = calculateVoteResults(players, 0, true);
  assert.equal(result.outcome, 'tie_revote');
  if (result.outcome === 'tie_revote') {
    assert.equal(result.tiedPlayerIds.length, 2);
  }

  // After 1 revote, tie becomes no_elimination
  const revoteResult = calculateVoteResults(players, 1, true);
  assert.equal(revoteResult.outcome, 'tie_no_elimination');
});

test('checkSpyGuess correctly matches with punctuation/whitespace normalization', () => {
  assert.ok(checkSpyGuess('Космическая станция', 'Космическая станция'));
  assert.ok(checkSpyGuess('космическая  станция', 'Космическая станция'));
  assert.ok(checkSpyGuess('«Космическая станция»', 'Космическая станция'));
  assert.ok(checkSpyGuess('Подводная-лодка', 'Подводная лодка'));
  assert.ok(checkSpyGuess('Космическая, станция!', 'Космическая станция'));
  assert.ok(checkSpyGuess('   (Космическая станция)? ', 'Космическая станция'));
  assert.ok(!checkSpyGuess('Больница', 'Подводная лодка'));
});

test('calculateVoteResults ignores empty and invalid vote targets', () => {
  const players = createMockPlayers(4);
  players[0].voteTargetId = 'player_3';
  players[1].voteTargetId = '';
  players[2].voteTargetId = 'missing_player';
  players[3].voteTargetId = 'player_3';

  const result = calculateVoteResults(players, 0, true);
  assert.equal(result.outcome, 'player_eliminated');
  if (result.outcome === 'player_eliminated') {
    assert.equal(result.accusedPlayerId, 'player_3');
    assert.equal(result.voteCount, 2);
    assert.equal(result.totalVotes, 2);
  }
});
