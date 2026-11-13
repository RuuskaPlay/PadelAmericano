/* Padel Americano - user interface. Depends on logic.js (window.PadelLogic). */
(function () {
  'use strict';

  var L = window.PadelLogic;
  var SCHEDULE = L.SCHEDULE;
  var TOTAL = L.TOTAL_POINTS;
  var N = SCHEDULE.length;

  // ---------- Storage (falls back to memory if localStorage is blocked) ----------
  var storageOk = true;
  var storage = (function () {
    try {
      var s = window.localStorage;
      s.setItem('__padel_test', '1');
      s.removeItem('__padel_test');
      return s;
    } catch (e) {
      storageOk = false;
      var mem = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();

  // ---------- State ----------
  var results = L.loadResults(storage);       // { gameId: pairAScore }
  var state = {
    view: 'current',     // 'current' | 'standings' | 'games'
    editingId: null,     // game id being edited, or null
    selected: null       // unsaved Pair A score, or null
  };

  var main = document.getElementById('main');
  var announcer = document.getElementById('announcer');
  var modalRoot = document.getElementById('modal-root');
  var resetBtn = document.getElementById('reset-btn');
  var navButtons = Array.prototype.slice.call(document.querySelectorAll('.nav-btn'));

  // ---------- Helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pairText(p) { return p[0] + ' + ' + p[1]; }
  function scoreText(a) { return a + '\u2013' + (TOTAL - a); }
  function gameById(id) {
    for (var i = 0; i < N; i++) if (SCHEDULE[i].id === id) return SCHEDULE[i];
    return null;
  }
  function indexOfGame(id) {
    for (var i = 0; i < N; i++) if (SCHEDULE[i].id === id) return i;
    return -1;
  }
  function hasResult(id) { return L.isValidScore(results[id]); }
  function savedCount() {
    var c = 0;
    SCHEDULE.forEach(function (g) { if (hasResult(g.id)) c++; });
    return c;
  }
  function announce(msg) {
    announcer.textContent = '';
    setTimeout(function () { announcer.textContent = msg; }, 50);
  }
  function toTop() {
    window.scrollTo(0, 0);
    try { main.focus({ preventScroll: true }); } catch (e) { main.focus(); }
  }
  function persist() { L.saveResults(storage, results); }

  // ---------- Rendering ----------
  function render() {
    var complete = L.nextGameIndex(results) === -1;
    var html;

    if (state.editingId) {
      html = inputScreen(gameById(state.editingId), true);
    } else if (state.view === 'standings') {
      html = standingsScreen();
    } else if (state.view === 'games') {
      html = gamesScreen();
    } else if (complete) {
      html = summaryScreen();
    } else {
      html = inputScreen(SCHEDULE[L.nextGameIndex(results)], false);
    }

    main.innerHTML = html;
    document.getElementById('nav-current-label').textContent = complete ? 'Summary' : 'Current Game';
    navButtons.forEach(function (b) {
      if (b.getAttribute('data-view') === state.view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (document.getElementById('score-grid')) updateSelection();
  }

  function inputScreen(g, editing) {
    var idx = indexOfGame(g.id);
    var html = '<section>';

    if (!storageOk) {
      html += '<p class="warn">Browser storage is unavailable. Results will be lost if you refresh.</p>';
    }

    html += '<div class="progress"><span class="chip">Game ' + (idx + 1) + ' of ' + N + '</span>' +
            '<span class="game-id" aria-label="Game ' + g.id + '">' + g.id + '</span></div>';

    if (editing) {
      html += '<div class="edit-banner" role="status">Editing a saved result \u2013 Game ' + g.id +
              ' (currently ' + scoreText(results[g.id]) + ')</div>';
    }

    html += '<div class="card match">' +
      '<div class="pair pair-a"><div><div class="pair-label">Pair A</div>' +
        '<div class="names"><span>' + esc(g.a[0]) + '</span><span>' + esc(g.a[1]) + '</span></div></div>' +
        '<div class="pair-score" id="score-a" aria-hidden="true">\u2013</div></div>' +
      '<div class="vs" aria-hidden="true">VS</div>' +
      '<div class="pair pair-b"><div><div class="pair-label">Pair B</div>' +
        '<div class="names"><span>' + esc(g.b[0]) + '</span><span>' + esc(g.b[1]) + '</span></div></div>' +
        '<div class="pair-score" id="score-b" aria-hidden="true">\u2013</div></div>' +
      '<div class="rest">Resting: <strong>' + esc(g.rest) + '</strong></div>' +
    '</div>';

    html += '<h2 class="section-label" id="score-label">Pair A score \u2013 ' + esc(pairText(g.a)) + '</h2>';
    html += '<div class="score-grid" id="score-grid" role="group" aria-labelledby="score-label">';
    for (var s = 0; s <= TOTAL; s++) {
      html += '<button type="button" class="score-btn" data-action="select" data-score="' + s +
              '" aria-pressed="false" aria-label="Pair A scores ' + s + '">' + s + '</button>';
    }
    html += '</div>';

    html += '<p class="preview" id="preview" aria-live="polite"></p>';

    html += '<div class="actions">' +
      '<button type="button" class="btn-primary" id="save-btn" data-action="save" disabled>' +
        (editing ? 'Save Changes' : 'Save &amp; Next') + '</button>';
    if (editing) {
      html += '<button type="button" class="btn-secondary" data-action="cancel-edit">Cancel</button>';
    }
    html += '</div></section>';
    return html;
  }

  // Updates the score buttons, preview and Save button in place (no full re-render).
  function updateSelection() {
    var g = state.editingId ? gameById(state.editingId) : SCHEDULE[L.nextGameIndex(results)];
    if (!g) return;
    var sel = state.selected;
    var has = sel !== null;

    Array.prototype.forEach.call(main.querySelectorAll('.score-btn'), function (b) {
      b.setAttribute('aria-pressed', String(has && Number(b.getAttribute('data-score')) === sel));
    });

    document.getElementById('score-a').textContent = has ? sel : '\u2013';
    document.getElementById('score-b').textContent = has ? (TOTAL - sel) : '\u2013';

    var preview = document.getElementById('preview');
    if (has) {
      preview.className = 'preview ready';
      preview.innerHTML = esc(pairText(g.a)) + ' <span class="big">' + scoreText(sel) + '</span> ' + esc(pairText(g.b));
    } else {
      preview.className = 'preview';
      preview.textContent = 'Tap Pair A\u2019s score (0\u20138)';
    }
    document.getElementById('save-btn').disabled = !has;
  }

  function standingsTable(st) {
    var any = st.completed > 0;
    var anyTie = false;
    var h = '<table class="standings"><caption class="sr-only">Player standings</caption>' +
      '<thead><tr><th scope="col">Pos</th><th scope="col">Player</th>' +
      '<th scope="col" class="num">Points</th><th scope="col" class="num">Wins</th>' +
      '<th scope="col" class="num">Played</th></tr></thead><tbody>';
    st.rows.forEach(function (r) {
      var cls = any && r.rank <= 3 ? ' class="rank-' + r.rank + '"' : '';
      var tie = any && r.tied;
      if (tie) anyTie = true;
      h += '<tr' + cls + '><td><span class="pos">' + (any ? r.rank : '\u2013') + '</span></td>' +
        '<td class="pname">' + esc(r.player) + (any && r.rank === 1 ? ' \uD83C\uDFC6' : '') +
        (tie ? '<span class="tie-badge">tied</span>' : '') + '</td>' +
        '<td class="num pts">' + r.points + '</td><td class="num">' + r.wins + '</td>' +
        '<td class="num">' + r.played + '</td></tr>';
    });
    h += '</tbody></table>';
    if (anyTie) {
      h += '<p class="note">Players marked \u201Ctied\u201D have the same points and wins and share a position. ' +
           'Decide ties outside the app.</p>';
    }
    return h;
  }

  function standingsScreen() {
    var st = L.computeStandings(results);
    return '<section><h2>Live standings</h2>' +
      '<p class="note">' + st.completed + ' of ' + N + ' games completed. Ranked by points, then wins.</p>' +
      standingsTable(st) + '</section>';
  }

  function gameRow(g, curIdx, summaryMode) {
    var idx = indexOfGame(g.id);
    var done = hasResult(g.id);
    var isCurrent = !summaryMode && !done && idx === curIdx;
    var cls = done ? 'done' : (isCurrent ? 'current' : 'future');
    var a = results[g.id];
    var winA = done && a > TOTAL - a;
    var winB = done && TOTAL - a > a;

    var h = '<li class="card game-row ' + cls + '"><div class="game-head"><span class="gid">' + g.id + '</span>';
    if (done) h += '<span class="result" aria-label="Result ' + a + ' to ' + (TOTAL - a) + '">' + scoreText(a) + '</span>';
    else if (isCurrent) h += '<span class="tag now">Current</span>';
    else h += '<span class="tag later">Upcoming</span>';
    h += '</div><div class="game-pairs">' +
      '<span class="p1' + (winA ? ' winner' : '') + '">' + esc(pairText(g.a)) + '</span>' +
      '<span class="vs" aria-hidden="true">vs</span>' +
      '<span class="p2' + (winB ? ' winner' : '') + '">' + esc(pairText(g.b)) + '</span></div>' +
      '<div class="game-foot"><span>Resting: ' + esc(g.rest) + '</span>';
    if (done) {
      h += '<button type="button" class="btn-small" data-action="edit" data-id="' + g.id +
           '" aria-label="Edit game ' + g.id + '">Edit</button>';
    } else if (isCurrent) {
      h += '<button type="button" class="btn-small" data-action="goto-current">Play</button>';
    }
    h += '</div></li>';
    return h;
  }

  function gameList(summaryMode) {
    var curIdx = L.nextGameIndex(results);
    var h = '';
    ['A', 'B', 'C'].forEach(function (block) {
      h += '<h3 class="block-title">Block ' + block + '</h3><ul class="game-list">';
      SCHEDULE.forEach(function (g) { if (g.block === block) h += gameRow(g, curIdx, summaryMode); });
      h += '</ul>';
    });
    return h;
  }

  function gamesScreen() {
    return '<section><h2>All games</h2><p class="note">' + savedCount() + ' of ' + N +
      ' games completed.</p>' + gameList(false) + '</section>';
  }

  function summaryScreen() {
    var st = L.computeStandings(results);
    var leaders = st.rows.filter(function (r) { return r.rank === 1; });
    var banner;
    if (leaders.length === 1) {
      banner = '\uD83C\uDFC6 ' + esc(leaders[0].player) + ' wins the session' +
               '<small>' + leaders[0].points + ' points, ' + leaders[0].wins + ' wins</small>';
    } else {
      banner = 'Tied for 1st: ' + leaders.map(function (r) { return esc(r.player); }).join(', ') +
               '<small>Same points and wins \u2013 decide outside the app</small>';
    }
    return '<section><h2>Session complete</h2><div class="winner-banner">' + banner + '</div>' +
      '<h2>Final standings</h2>' + standingsTable(st) +
      '<h2>All game results</h2>' + gameList(true) + '</section>';
  }

  // ---------- Actions ----------
  function setView(view) {
    state.view = view;
    state.editingId = null;
    state.selected = null;
    render();
    toTop();
  }

  function startEdit(id) {
    state.editingId = id;
    state.selected = results[id];
    render();
    toTop();
  }

  function save() {
    if (state.selected === null) return;
    var editing = !!state.editingId;
    var g = editing ? gameById(state.editingId) : SCHEDULE[L.nextGameIndex(results)];
    if (!g) return;

    results[g.id] = state.selected;   // replaces any old value
    persist();
    state.selected = null;
    state.editingId = null;
    render();
    toTop();

    var next = L.nextGameIndex(results);
    if (editing) {
      announce('Game ' + g.id + ' updated. Standings recalculated.');
    } else if (next === -1) {
      announce('Game ' + g.id + ' saved. Session complete.');
    } else {
      announce('Game ' + g.id + ' saved. Now game ' + SCHEDULE[next].id + '.');
    }
  }

  function openResetDialog() {
    var n = savedCount();
    modalRoot.innerHTML =
      '<div class="overlay"><div class="modal" role="alertdialog" aria-modal="true" ' +
      'aria-labelledby="rm-title" aria-describedby="rm-text">' +
      '<h2 id="rm-title">Reset session?</h2>' +
      '<p id="rm-text">This removes all ' + n + ' entered game result' + (n === 1 ? '' : 's') +
      ' and returns to Game A1. This cannot be undone.</p>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn-cancel" id="rm-cancel" data-action="cancel-reset">Cancel</button>' +
      '<button type="button" class="btn-danger" id="rm-confirm" data-action="confirm-reset">Reset</button>' +
      '</div></div></div>';
    document.getElementById('rm-cancel').focus();
  }

  function closeResetDialog() {
    modalRoot.innerHTML = '';
    resetBtn.focus();
  }

  function confirmReset() {
    results = {};
    persist();
    state.view = 'current';
    state.editingId = null;
    state.selected = null;
    modalRoot.innerHTML = '';
    render();
    toTop();
    announce('Session reset. Game A1.');
  }

  // ---------- Events ----------
  main.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el || !main.contains(el)) return;
    var action = el.getAttribute('data-action');

    if (action === 'select') {
      state.selected = Number(el.getAttribute('data-score'));
      updateSelection();
    } else if (action === 'save') {
      save();
    } else if (action === 'cancel-edit') {
      state.editingId = null;
      state.selected = null;
      render();
      toTop();
    } else if (action === 'edit') {
      startEdit(el.getAttribute('data-id'));
    } else if (action === 'goto-current') {
      setView('current');
    }
  });

  navButtons.forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });

  resetBtn.addEventListener('click', openResetDialog);

  modalRoot.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    var action = el.getAttribute('data-action');
    if (action === 'cancel-reset') closeResetDialog();
    else if (action === 'confirm-reset') confirmReset();
  });

  document.addEventListener('keydown', function (e) {
    if (!modalRoot.firstChild) return;
    if (e.key === 'Escape') {
      closeResetDialog();
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog (two buttons).
      var cancel = document.getElementById('rm-cancel');
      var confirm = document.getElementById('rm-confirm');
      var active = document.activeElement;
      if (e.shiftKey && active === cancel) { e.preventDefault(); confirm.focus(); }
      else if (!e.shiftKey && active === confirm) { e.preventDefault(); cancel.focus(); }
      else if (active !== cancel && active !== confirm) { e.preventDefault(); cancel.focus(); }
    }
  });

  // ---------- Start ----------
  render();
})();
