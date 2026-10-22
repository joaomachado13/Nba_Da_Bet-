const assert = require('node:assert/strict');
require('../assets/js/rules.js');
const { computeLockAt, isRoundLocked, progress, localDateKey, roundDateKey } = globalThis.BolaoRules;

const games = [
  { id: 'a', start_at: '2026-10-23T01:30:00Z' }, // 22:30 do dia 22 em SP
  { id: 'b', start_at: '2026-10-22T23:00:00Z' }, // 20:00 do dia 22 em SP
  { id: 'c', start_at: '2026-10-23T02:30:00Z' }  // 23:30 do dia 22 em SP
];

assert.equal(computeLockAt(games).toISOString(), '2026-10-22T23:00:00.000Z');
assert.equal(isRoundLocked(new Date('2026-10-22T23:00:00Z'), new Date('2026-10-22T22:59:59Z')), false);
assert.equal(isRoundLocked(new Date('2026-10-22T23:00:00Z'), new Date('2026-10-22T23:00:00Z')), true);
assert.deepEqual(progress(games, { a: 'DEN', c: 'GSW' }), { total: 3, done: 2, percent: 67 });
assert.equal(localDateKey('2026-10-23T02:30:00Z', 'America/Sao_Paulo'), '2026-10-22');
assert.equal(roundDateKey('2026-10-23T04:30:00Z', 'America/Sao_Paulo', 6), '2026-10-22'); // 01:30 em SP
assert.equal(roundDateKey('2026-10-23T10:00:00Z', 'America/Sao_Paulo', 6), '2026-10-23'); // 07:00 em SP
console.log('rules.test.js: OK');
