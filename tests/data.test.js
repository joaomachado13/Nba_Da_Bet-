const assert = require('node:assert/strict');
global.window = {};
require('../assets/js/mock-data.js');
assert.equal(window.MOCK_GAMES.length, 2);
assert.deepEqual(window.MOCK_GAMES.map(g => g.round_date), ['2026-10-22', '2026-10-22']);
assert.deepEqual(window.MOCK_GAMES.map(g => g.start_at), ['2026-10-22T23:00:00Z', '2026-10-23T01:30:00Z']);
assert.deepEqual(window.MOCK_GAMES.map(g => [g.away.record, g.home.record]), [['0-0', '1-0'], ['0-0', '1-0']]);
console.log('data.test.js: OK');
