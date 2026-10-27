import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_PACKS,
  validatePack,
  importPackFromJSON,
  exportPackToJSON,
} from '../../../content/src/index';

test('all 19 official packs are loaded and valid', () => {
  assert.equal(OFFICIAL_PACKS.length, 19, 'Must have exactly 19 requested packs');

  const requiredPackIds = [
    'classic_locations',
    'minecraft',
    'clash_royale',
    'dota_2',
    'counter_strike_2',
    'roblox',
    'terraria',
    'stardew_valley',
    'among_us',
    'genshin_impact',
    'school',
    'professions',
    'travel',
    'space',
    'fantasy',
    'horror',
    'history',
    'food',
    'internet_culture',
  ];

  for (const id of requiredPackIds) {
    const pack = OFFICIAL_PACKS.find((p) => p.id === id);
    assert.ok(pack, `Official pack ${id} must exist`);
    const validation = validatePack(pack);
    assert.ok(validation.success, `Pack ${id} failed validation: ${validation.errors?.join(', ')}`);
    assert.ok(pack.locations.length >= 4, `Pack ${id} must have at least 4 locations`);
    for (const loc of pack.locations) {
      assert.ok(loc.roles.length >= 3, `Location ${loc.name} must have at least 3 roles`);
    }
  }
});

test('validatePack catches duplicate locations', () => {
  const badPack = {
    id: 'dup_pack',
    name: 'Дубликаты',
    description: 'Тест',
    category: 'Тест',
    version: '1.0.0',
    author: 'Tester',
    locations: [
      { id: '1', name: 'Офис', roles: ['Босс', 'Сотрудник', 'Курьер'] },
      { id: '2', name: 'Офис', roles: ['Менеджер', 'Охранник', 'Клиент'] },
      { id: '3', name: 'Склад', roles: ['Грузчик', 'Кладовщик', 'Водитель'] },
      { id: '4', name: 'Завод', roles: ['Токарь', 'Инженер', 'Мастер'] },
    ],
  };

  const res = validatePack(badPack);
  assert.equal(res.success, false);
  assert.ok(res.errors?.some((e) => e.includes('Повторяющееся название локации')));
});

test('importPackFromJSON and exportPackToJSON work symmetrically', () => {
  const originalPack = OFFICIAL_PACKS[0];
  const exported = exportPackToJSON(originalPack);
  assert.ok(typeof exported === 'string');

  const imported = importPackFromJSON(exported);
  assert.ok(imported.success);
  assert.equal(imported.pack?.id, originalPack.id);
  assert.equal(imported.pack?.locations.length, originalPack.locations.length);
});

test('importPackFromJSON rejects malformed JSON and schemas', () => {
  const malformed = importPackFromJSON('{ bad json string ');
  assert.equal(malformed.success, false);
  assert.ok(malformed.errors?.[0].includes('Ошибка парсинга'));

  const invalidSchema = importPackFromJSON('{"id": "test", "name": "Тест"}');
  assert.equal(invalidSchema.success, false);
});
