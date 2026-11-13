/* Padel Americano - schedule, scoring and storage logic.
 * No DOM access here, so it can be tested with plain Node (see tests.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PadelLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'padelAmericano.v1';
  var STORAGE_VERSION = 1;
  var TOTAL_POINTS = 8;

  var PLAYERS = ['Hannu', 'Jouni', 'Juha', 'Marko', 'Simo'];

  function game(id, a1, a2, b1, b2, rest) {
    return { id: id, block: id.charAt(0), a: [a1, a2], b: [b1, b2], rest: rest };
  }

  // The single source of truth for the session. Order matters.
  var SCHEDULE = [
    // Block A
    game('A1', 'Hannu', 'Marko', 'Simo', 'Jouni', 'Juha'),
    game('A2', 'Marko', 'Simo', 'Jouni', 'Juha', 'Hannu'),
    game('A3', 'Juha', 'Hannu', 'Marko', 'Jouni', 'Simo'),
    game('A4', 'Jouni', 'Hannu', 'Simo', 'Juha', 'Marko'),
    game('A5', 'Hannu', 'Simo', 'Marko', 'Juha', 'Jouni'),
    // Block B
    game('B1', 'Marko', 'Jouni', 'Juha', 'Simo', 'Hannu'),
    game('B2', 'Hannu', 'Simo', 'Marko', 'Jouni', 'Juha'),
    game('B3', 'Hannu', 'Juha', 'Simo', 'Jouni', 'Marko'),
    game('B4', 'Hannu', 'Marko', 'Simo', 'Juha', 'Jouni'),
    game('B5', 'Hannu', 'Jouni', 'Marko', 'Juha', 'Simo'),
    // Block C
    game('C1', 'Hannu', 'Jouni', 'Simo', 'Marko', 'Juha'),
    game('C2', 'Marko', 'Juha', 'Jouni', 'Simo', 'Hannu'),
    game('C3', 'Hannu', 'Juha', 'Simo', 'Marko', 'Jouni'),
    game('C4', 'Hannu', 'Marko', 'Jouni', 'Juha', 'Simo'),
    game('C5', 'Simo', 'Hannu', 'Juha', 'Jouni', 'Marko')
  ];

  function isValidScore(n) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= TOTAL_POINTS;
  }

  // results: { "A1": 6, "A2": 3, ... }  (value = Pair A's score)
  // Standings are ALWAYS rebuilt from zero from the schedule + results.
  function computeStandings(results) {
    var stats = {};
    PLAYERS.forEach(function (p) {
      stats[p] = { player: p, points: 0, wins: 0, played: 0 };
    });
    var completed = 0;

    SCHEDULE.forEach(function (g) {
      var scoreA = results ? results[g.id] : undefined;
      if (!isValidScore(scoreA)) return;
      var scoreB = TOTAL_POINTS - scoreA;
      completed++;

      g.a.forEach(function (p) {
        stats[p].points += scoreA;
        stats[p].played += 1;
        if (scoreA > scoreB) stats[p].wins += 1;
      });
      g.b.forEach(function (p) {
        stats[p].points += scoreB;
        stats[p].played += 1;
        if (scoreB > scoreA) stats[p].wins += 1;
      });
    });

    var rows = PLAYERS.map(function (p) { return stats[p]; });

    // Sort by points, then wins. The final name-order step only makes the
    // display order stable; it never affects ranking position.
    rows.sort(function (x, y) {
      if (y.points !== x.points) return y.points - x.points;
      if (y.wins !== x.wins) return y.wins - x.wins;
      return PLAYERS.indexOf(x.player) - PLAYERS.indexOf(y.player);
    });

    // Standard competition ranking: tied players share a position (1,1,3...).
    rows.forEach(function (r) {
      var better = 0;
      var same = 0;
      rows.forEach(function (o) {
        if (o.points > r.points || (o.points === r.points && o.wins > r.wins)) better++;
        else if (o !== r && o.points === r.points && o.wins === r.wins) same++;
      });
      r.rank = better + 1;
      r.tied = same > 0;
    });

    return { rows: rows, completed: completed };
  }

  // Index of the first game without a saved result, or -1 if all are done.
  function nextGameIndex(results) {
    for (var i = 0; i < SCHEDULE.length; i++) {
      if (!results || !isValidScore(results[SCHEDULE[i].id])) return i;
    }
    return -1;
  }

  function sanitizeResults(raw) {
    var clean = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
    SCHEDULE.forEach(function (g) {
      if (Object.prototype.hasOwnProperty.call(raw, g.id) && isValidScore(raw[g.id])) {
        clean[g.id] = raw[g.id];
      }
    });
    return clean;
  }

  // Storage helpers take a storage object (window.localStorage or a fake).
  function loadResults(storage) {
    try {
      if (!storage) return {};
      var text = storage.getItem(STORAGE_KEY);
      if (!text) return {};
      var data = JSON.parse(text);
      if (!data || typeof data !== 'object' || data.version !== STORAGE_VERSION) return {};
      return sanitizeResults(data.results);
    } catch (e) {
      return {};
    }
  }

  function saveResults(storage, results) {
    try {
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        results: sanitizeResults(results)
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    TOTAL_POINTS: TOTAL_POINTS,
    PLAYERS: PLAYERS,
    SCHEDULE: SCHEDULE,
    isValidScore: isValidScore,
    computeStandings: computeStandings,
    nextGameIndex: nextGameIndex,
    sanitizeResults: sanitizeResults,
    loadResults: loadResults,
    saveResults: saveResults
  };
});
