/* Run with:  node tests.js
 * Checks the schedule, scoring, ranking and storage logic (acceptance tests 1-6).
 */
'use strict';
var assert = require('assert');
var L = require('./logic.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { console.log('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
function fakeStorage(initial) {
  var data = initial || {};
  return {
    getItem: function (k) { return k in data ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
    _data: data
  };
}
function row(st, name) { return st.rows.filter(function (r) { return r.player === name; })[0]; }
function sum(r) { return [r.points, r.wins, r.played]; }

test('Schedule: 15 games, 12 played + 3 rests per player, valid pairs', function () {
  assert.strictEqual(L.SCHEDULE.length, 15);
  var played = {}, rested = {};
  L.PLAYERS.forEach(function (p) { played[p] = 0; rested[p] = 0; });
  L.SCHEDULE.forEach(function (g) {
    var all = g.a.concat(g.b, [g.rest]);
    assert.strictEqual(new Set(all).size, 5, g.id + ' must use five distinct players');
    g.a.concat(g.b).forEach(function (p) { played[p]++; });
    rested[g.rest]++;
  });
  L.PLAYERS.forEach(function (p) { assert.strictEqual(played[p], 12); assert.strictEqual(rested[p], 3); });
  assert.deepStrictEqual(L.SCHEDULE.map(function (g) { return g.id; }),
    ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5']);
});

test('Test 1: first game 6-2', function () {
  var r = { A1: 6 };
  var st = L.computeStandings(r);
  assert.deepStrictEqual(sum(row(st, 'Hannu')), [6, 1, 1]);
  assert.deepStrictEqual(sum(row(st, 'Marko')), [6, 1, 1]);
  assert.deepStrictEqual(sum(row(st, 'Simo')), [2, 0, 1]);
  assert.deepStrictEqual(sum(row(st, 'Jouni')), [2, 0, 1]);
  assert.deepStrictEqual(sum(row(st, 'Juha')), [0, 0, 0]);
  assert.strictEqual(L.SCHEDULE[L.nextGameIndex(r)].id, 'A2');
});

test('Test 2: 4-4 draw gives points and games played but no wins', function () {
  var st = L.computeStandings({ A1: 4 });
  ['Hannu', 'Marko', 'Simo', 'Jouni'].forEach(function (p) {
    assert.deepStrictEqual(sum(row(st, p)), [4, 0, 1]);
  });
  assert.deepStrictEqual(sum(row(st, 'Juha')), [0, 0, 0]);
});

test('Test 3: editing A1 from 6-2 to 3-5 leaves no old values', function () {
  var r = { A1: 6 };
  r.A1 = 3;
  var st = L.computeStandings(r);
  assert.deepStrictEqual(sum(row(st, 'Hannu')), [3, 0, 1]);
  assert.deepStrictEqual(sum(row(st, 'Marko')), [3, 0, 1]);
  assert.deepStrictEqual(sum(row(st, 'Simo')), [5, 1, 1]);
  assert.deepStrictEqual(sum(row(st, 'Jouni')), [5, 1, 1]);
});

test('Test 3b: editing an early game after later games keeps later games', function () {
  var r = { A1: 6, A2: 5, A3: 2 };
  r.A1 = 0;
  assert.strictEqual(L.computeStandings(r).completed, 3);
  assert.strictEqual(L.nextGameIndex(r), 3);
});

test('Test 4: persistence round-trip and resume at first unanswered game', function () {
  var s = fakeStorage();
  var r = { A1: 6, A2: 3, A3: 4 };
  assert.ok(L.saveResults(s, r));
  var loaded = L.loadResults(s);   // simulates page reload
  assert.deepStrictEqual(loaded, r);
  assert.deepStrictEqual(L.computeStandings(loaded), L.computeStandings(r));
  assert.strictEqual(L.SCHEDULE[L.nextGameIndex(loaded)].id, 'A4');
});

test('Test 5: reset clears results, totals and returns to A1; schedule unchanged', function () {
  var before = JSON.stringify(L.SCHEDULE) + JSON.stringify(L.PLAYERS);
  var s = fakeStorage();
  L.saveResults(s, { A1: 6, A2: 1 });
  L.saveResults(s, {});            // what the app does on confirmed reset
  var loaded = L.loadResults(s);
  assert.deepStrictEqual(loaded, {});
  var st = L.computeStandings(loaded);
  st.rows.forEach(function (r) { assert.deepStrictEqual(sum(r), [0, 0, 0]); });
  assert.strictEqual(L.SCHEDULE[L.nextGameIndex(loaded)].id, 'A1');
  assert.strictEqual(JSON.stringify(L.SCHEDULE) + JSON.stringify(L.PLAYERS), before);
});

test('Test 6: finished session - 12 games each, final view, edit updates standings', function () {
  var r = {};
  L.SCHEDULE.forEach(function (g, i) { r[g.id] = i % 9; });   // valid 0..8 scores
  assert.strictEqual(L.nextGameIndex(r), -1);
  var st = L.computeStandings(r);
  assert.strictEqual(st.completed, 15);
  st.rows.forEach(function (p) { assert.strictEqual(p.played, 12); });
  var total = st.rows.reduce(function (a, p) { return a + p.points; }, 0);
  assert.strictEqual(total, 15 * 8 * 2);   // 8 points x 2 pairs x ... each game gives 8 points to each side's 2 players = 16
  var before = JSON.stringify(st.rows);
  r.C5 = 8 - r.C5 === r.C5 ? 7 : 8 - r.C5;
  assert.notStrictEqual(JSON.stringify(L.computeStandings(r).rows), before);
  assert.strictEqual(L.nextGameIndex(r), -1);
});

test('Ranking: points first, then wins, ties share position', function () {
  // Craft: after A1 6-2, Hannu & Marko tied on points and wins -> rank 1,1
  var st = L.computeStandings({ A1: 6 });
  assert.strictEqual(row(st, 'Hannu').rank, 1);
  assert.strictEqual(row(st, 'Marko').rank, 1);
  assert.ok(row(st, 'Hannu').tied && row(st, 'Marko').tied);
  assert.strictEqual(row(st, 'Simo').rank, 3);
  assert.strictEqual(row(st, 'Juha').rank, 5);
  assert.ok(!row(st, 'Juha').tied);
});

test('Ranking: equal points but different wins -> wins break the tie', function () {
  // A1: Hannu+Marko 4-4 Simo+Jouni (4 pts each, 0 wins)
  // A2: Marko+Simo vs Jouni+Juha 4-4 too -> everyone equal; use a different construction:
  // Hannu: A1 (A) 5 pts, win;  need another player with 5 pts but 0 wins.
  // A1 5-3: Hannu 5W, Marko 5W, Simo 3, Jouni 3.  A5 (Hannu+Simo vs Marko+Juha) 3-5 -> Hannu 3, Simo 3, Marko 5W, Juha 5W
  // Totals: Hannu 8 (1W), Marko 10 (2W), Simo 6 (1W)?? Simo: A1 3(lost),A5 3(lost)=6,0W
  var st = L.computeStandings({ A1: 5, A5: 3 });
  assert.deepStrictEqual(sum(row(st, 'Marko')), [10, 2, 2]);
  assert.strictEqual(row(st, 'Marko').rank, 1);
  // Direct equal-points/different-wins check: 4-4 draws vs a narrow win
  // Player X: 4+4 = 8 points with 0 wins; Player Y: 5+3 = 8 points with 1 win.
  var r = { A1: 4, A2: 4, A3: 5 };
  var s2 = L.computeStandings(r);
  var hannu = row(s2, 'Hannu');   // A1:4, A3(A with Juha):5 win -> 9, 1 win
  var marko = row(s2, 'Marko');   // A1:4, A2:4, A3(B):3 -> 11, 0 wins
  assert.ok(marko.points > hannu.points);
  // Build exact points-equal case via search
  var found = false;
  for (var a = 0; a <= 8 && !found; a++) for (var b = 0; b <= 8 && !found; b++) for (var c = 0; c <= 8 && !found; c++) {
    var st3 = L.computeStandings({ A1: a, A2: b, A3: c });
    for (var i = 0; i < 5 && !found; i++) for (var j = i + 1; j < 5 && !found; j++) {
      var p = st3.rows[i], q = st3.rows[j];
      if (p.points === q.points && p.wins !== q.wins) {
        found = true;
        assert.ok(p.wins > q.wins, 'more wins must sort first');
        assert.ok(p.rank < q.rank);
        assert.ok(!p.tied || p.rank < q.rank);
      }
    }
  }
  assert.ok(found, 'expected to find an equal-points / different-wins case');
});

test('Storage: missing, corrupted, wrong-version and invalid data are handled', function () {
  assert.deepStrictEqual(L.loadResults(null), {});
  assert.deepStrictEqual(L.loadResults(fakeStorage()), {});
  var k = L.STORAGE_KEY;
  var bad = [
    'not json{{{', 'null', '123', '[]',
    JSON.stringify({ version: 99, results: { A1: 5 } }),
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, results: 'x' })
  ];
  bad.forEach(function (text) {
    var o = {}; o[k] = text;
    assert.deepStrictEqual(L.loadResults(fakeStorage(o)), {}, text);
  });
  var o2 = {}; o2[k] = JSON.stringify({ version: 1, results: { A1: 6, A2: 9, A3: -1, A4: 2.5, A5: '3', Z9: 4, B1: 0 } });
  assert.deepStrictEqual(L.loadResults(fakeStorage(o2)), { A1: 6, B1: 0 });
  var throwing = { getItem: function () { throw new Error('blocked'); }, setItem: function () { throw new Error('blocked'); } };
  assert.deepStrictEqual(L.loadResults(throwing), {});
  assert.strictEqual(L.saveResults(throwing, { A1: 1 }), false);
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));
