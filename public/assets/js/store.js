/* Datalag: state, lagring i browseren (localStorage) og gentagelses-logik. */
(function (global) {
  'use strict';

  var U = global.U;
  var KEY = 'familieplan.v1';
  var DIRTY_KEY = 'familieplan.dirty';
  var listeners = [];

  var state = null;

  /* Nøgler ("item:abc") på rækker der er ændret her, men endnu ikke sendt til serveren.
     Listen ligger i localStorage, så ændringer lavet offline ikke går tabt. */
  var dirty = {};

  function defaultState() {
    var monday = U.startOfWeek(U.today());
    return {
      version: 1,
      people: {
        a: { name: 'Mig', color: '#3b6ea5' },
        b: { name: 'Min kone', color: '#b8577a' },
        shared: { name: 'Fælles', color: '#4f9a71' }
      },
      /* Eksempler ved allerførste besøg. De har faste id'er med vilje: åbner den
         anden enhed siden for første gang, laver den de samme rækker frem for
         dubletter, og en redigering eller sletning et sted slår igennem begge steder. */
      items: [
        {
          id: 'seed-uge', title: 'Ugeplanlægning sammen', notes: 'Gennemgå kalender, opgaver og indkøb for den kommende uge.',
          type: 'event', assignee: 'shared', date: U.toISO(U.addDays(monday, 6)), time: '19:00',
          repeat: 'weekly', priority: 'normal', done: false, completed: {}, createdAt: Date.now()
        },
        {
          id: 'seed-skrald', title: 'Tømme skraldespand', notes: '',
          type: 'task', assignee: 'a', date: U.toISO(U.addDays(monday, 1)), time: '',
          repeat: 'weekly', priority: 'normal', done: false, completed: {}, createdAt: Date.now()
        },
        {
          id: 'seed-tandlaege', title: 'Bestille tid til tandlæge', notes: '',
          type: 'task', assignee: 'b', date: '', time: '',
          repeat: 'none', priority: 'high', done: false, completed: {}, createdAt: Date.now()
        }
      ],
      shopping: [
        { id: 'seed-maelk', title: 'Mælk', done: false, createdAt: Date.now() },
        { id: 'seed-kaffe', title: 'Kaffe', done: false, createdAt: Date.now() }
      ]
    };
  }

  /* ---------- Ændringer der venter på at blive sendt ---------- */

  function loadDirty() {
    try {
      dirty = JSON.parse(global.localStorage.getItem(DIRTY_KEY)) || {};
    } catch (e) {
      dirty = {};
    }
  }

  function saveDirty() {
    try {
      global.localStorage.setItem(DIRTY_KEY, JSON.stringify(dirty));
    } catch (e) { /* ignoreres */ }
  }

  function touch(kind, id) {
    dirty[kind + ':' + id] = true;
    saveDirty();
  }

  function isDirty(kind, id) {
    return !!dirty[kind + ':' + id];
  }

  /* Alle ventende ændringer som de skal sendes. Findes rækken ikke længere
     lokalt, er den slettet her — så sendes en gravsten i stedet for data. */
  function pendingChanges() {
    return Object.keys(dirty).map(function (key) {
      var sep = key.indexOf(':');
      var kind = key.slice(0, sep);
      var id = key.slice(sep + 1);
      var data = findRecord(kind, id);
      return data
        ? { kind: kind, id: id, data: data, deleted: false }
        : { kind: kind, id: id, data: null, deleted: true };
    });
  }

  /* Rydder kun de nøgler der rent faktisk blev sendt — nye ændringer lavet
     imens kaldet var undervejs skal stadig med næste gang. */
  function clearPending(changes) {
    changes.forEach(function (c) { delete dirty[c.kind + ':' + c.id]; });
    saveDirty();
  }

  function markAllDirty(extraIds) {
    (extraIds || []).forEach(function (key) { dirty[key] = true; });
    state.items.forEach(function (it) { dirty['item:' + it.id] = true; });
    state.shopping.forEach(function (s) { dirty['shopping:' + s.id] = true; });
    dirty['meta:people'] = true;
    saveDirty();
  }

  function recordKeys() {
    return state.items.map(function (it) { return 'item:' + it.id; })
      .concat(state.shopping.map(function (s) { return 'shopping:' + s.id; }));
  }

  function findRecord(kind, id) {
    if (kind === 'meta') return id === 'people' ? state.people : null;
    var list = kind === 'item' ? state.items : kind === 'shopping' ? state.shopping : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /* Skriver serverens rækker ind lokalt. Rækker vi selv har ændret og endnu ikke
     har sendt, springes over — ellers ville vores egen ændring blive spist. */
  function applyRemote(changes) {
    var applied = 0;
    changes.forEach(function (c) {
      if (isDirty(c.kind, c.id)) return;
      if (c.kind === 'meta') {
        if (c.id === 'people' && c.data && !c.deleted) {
          state.people = normalizePeople(c.data);
          applied++;
        }
        return;
      }
      var list = c.kind === 'item' ? state.items : c.kind === 'shopping' ? state.shopping : null;
      if (!list) return;

      var index = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === c.id) { index = i; break; }
      }

      if (c.deleted) {
        if (index >= 0) { list.splice(index, 1); applied++; }
        return;
      }
      if (!c.data) return;

      var row = c.kind === 'item' ? normalizeItem(c.data) : normalizeShopping(c.data);
      row.id = c.id;
      if (index >= 0) list[index] = row; else list.push(row);
      applied++;
    });
    if (applied) {
      save();
      listeners.forEach(function (fn) { fn(); });
    }
    return applied;
  }

  /* ---------- Indlæsning og lagring ---------- */

  function load() {
    loadDirty();
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) {
      state = defaultState();
      save();
      return state;
    }
    try {
      state = migrate(JSON.parse(raw));
    } catch (e) {
      console.warn('Kunne ikke læse gemte data, starter forfra.', e);
      state = defaultState();
    }
    return state;
  }

  /* Feltvis oprydning. Bruges både på gemte data og på rækker fra serveren,
     så en enhed aldrig kan sende noget ind der vælter visningen. */
  function normalizeItem(it) {
    it = it || {};
    return {
      id: it.id || U.uid(),
      title: String(it.title || '(uden titel)').slice(0, 200),
      type: ['event', 'meal'].indexOf(it.type) >= 0 ? it.type : 'task',
      assignee: ['a', 'b', 'shared'].indexOf(it.assignee) >= 0 ? it.assignee : 'shared',
      date: it.date || '',
      time: it.time || '',
      repeat: it.repeat || 'none',
      priority: it.priority || 'normal',
      done: !!it.done,
      completed: it.completed && typeof it.completed === 'object' ? it.completed : {},
      notes: String(it.notes || ''),
      createdAt: it.createdAt || Date.now()
    };
  }

  function normalizeShopping(s) {
    s = s || {};
    return {
      id: s.id || U.uid(),
      title: String(s.title || '').slice(0, 200),
      done: !!s.done,
      createdAt: s.createdAt || Date.now()
    };
  }

  function normalizePeople(people) {
    var base = defaultState().people;
    var out = {};
    ['a', 'b', 'shared'].forEach(function (k) {
      var p = (people && people[k]) || base[k];
      out[k] = { name: String(p.name || base[k].name).slice(0, 40), color: p.color || base[k].color };
    });
    return out;
  }

  /* Gør indlæste data robuste mod manglende felter (fx fra en ældre version). */
  function migrate(data) {
    var base = defaultState();
    if (!data || typeof data !== 'object') return base;
    return {
      version: 1,
      people: normalizePeople(data.people),
      items: (Array.isArray(data.items) ? data.items : []).map(normalizeItem),
      shopping: (Array.isArray(data.shopping) ? data.shopping : []).map(normalizeShopping)
    };
  }

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Kunne ikke gemme data.', e);
    }
  }

  function subscribe(fn) { listeners.push(fn); }

  function notify() {
    save();
    listeners.forEach(function (fn) { fn(); });
  }

  /* ---------- Punkter ---------- */

  function newItem(patch) {
    var item = {
      id: U.uid(),
      title: '',
      notes: '',
      type: 'task',
      assignee: 'shared',
      date: '',
      time: '',
      repeat: 'none',
      priority: 'normal',
      done: false,
      completed: {},
      createdAt: Date.now()
    };
    Object.keys(patch || {}).forEach(function (k) { item[k] = patch[k]; });
    state.items.push(item);
    touch('item', item.id);
    notify();
    return item;
  }

  function getItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function updateItem(id, patch) {
    var item = getItem(id);
    if (!item) return null;
    Object.keys(patch).forEach(function (k) { item[k] = patch[k]; });
    if (item.repeat === 'none') item.completed = {};
    touch('item', id);
    notify();
    return item;
  }

  function deleteItem(id) {
    state.items = state.items.filter(function (it) { return it.id !== id; });
    touch('item', id);
    notify();
  }

  /* Markér udført. For gentagne punkter gemmes status pr. dato. */
  function toggleDone(id, dateISO) {
    var item = getItem(id);
    if (!item) return;
    if (item.repeat === 'none' || !dateISO) {
      item.done = !item.done;
    } else if (item.completed[dateISO]) {
      delete item.completed[dateISO];
    } else {
      item.completed[dateISO] = true;
    }
    touch('item', id);
    notify();
  }

  function isDone(item, dateISO) {
    if (item.repeat === 'none' || !dateISO) return !!item.done;
    return !!item.completed[dateISO];
  }

  /* ---------- Gentagelser ---------- */

  function occursOn(item, date) {
    if (!item.date) return false;
    var anchor = U.parseISO(item.date);
    if (!anchor) return false;
    if (date < anchor) return false;

    switch (item.repeat) {
      case 'daily':
        return true;
      case 'weekly':
        return date.getDay() === anchor.getDay();
      case 'biweekly':
        return U.diffDays(anchor, date) % 14 === 0;
      case 'monthly':
        return matchesDayOfMonth(anchor.getDate(), date);
      case 'yearly':
        return date.getMonth() === anchor.getMonth() && matchesDayOfMonth(anchor.getDate(), date);
      default:
        return U.sameDay(anchor, date);
    }
  }

  /* Den 31. i en måned med færre dage lander på månedens sidste dag. */
  function matchesDayOfMonth(day, date) {
    var last = U.daysInMonth(date.getFullYear(), date.getMonth());
    var target = Math.min(day, last);
    return date.getDate() === target;
  }

  function occurrence(item, date) {
    var iso = date ? U.toISO(date) : '';
    return {
      key: item.id + '@' + iso,
      id: item.id,
      item: item,
      date: iso,
      done: isDone(item, iso),
      recurring: item.repeat !== 'none'
    };
  }

  /* ---------- Madplan ---------- */

  /* Aftensmaden for en dag. Der er højst én pr. dag. */
  function mealOn(dateISO) {
    for (var i = 0; i < state.items.length; i++) {
      var it = state.items[i];
      if (it.type === 'meal' && it.date === dateISO) return it;
    }
    return null;
  }

  /* Tom titel sletter dagens ret igen. */
  function setMeal(dateISO, title) {
    var existing = mealOn(dateISO);
    title = (title || '').trim();

    if (!title) {
      if (existing) deleteItem(existing.id);
      return null;
    }
    if (existing) return updateItem(existing.id, { title: title });
    return newItem({ title: title, type: 'meal', assignee: 'shared', date: dateISO });
  }

  function isMeal(occurrence) {
    return occurrence.item.type === 'meal';
  }

  function withoutMeals(list) {
    return list.filter(function (o) { return o.item.type !== 'meal'; });
  }

  function occurrencesOn(date) {
    var out = [];
    state.items.forEach(function (it) {
      if (occursOn(it, date)) out.push(occurrence(it, date));
    });
    return sortOccurrences(out);
  }

  function occurrencesInRange(from, to) {
    var out = [];
    for (var d = new Date(from.getTime()); d <= to; d = U.addDays(d, 1)) {
      out = out.concat(occurrencesOn(d));
    }
    return out;
  }

  /* Punkter uden dato — “indbakken” i to-do-visningen. */
  function undatedItems() {
    return state.items.filter(function (it) { return !it.date; }).map(function (it) {
      return occurrence(it, null);
    });
  }

  function sortOccurrences(list) {
    return list.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      var ta = a.item.time || '99:99';
      var tb = b.item.time || '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      var pr = { high: 0, normal: 1, low: 2 };
      if (pr[a.item.priority] !== pr[b.item.priority]) return pr[a.item.priority] - pr[b.item.priority];
      return a.item.createdAt - b.item.createdAt;
    });
  }

  /* ---------- Indkøbsliste ---------- */

  function addShopping(title) {
    var row = { id: U.uid(), title: title, done: false, createdAt: Date.now() };
    state.shopping.push(row);
    touch('shopping', row.id);
    notify();
  }

  function toggleShopping(id) {
    state.shopping.forEach(function (s) { if (s.id === id) s.done = !s.done; });
    touch('shopping', id);
    notify();
  }

  function deleteShopping(id) {
    state.shopping = state.shopping.filter(function (s) { return s.id !== id; });
    touch('shopping', id);
    notify();
  }

  function clearDoneShopping() {
    state.shopping.forEach(function (s) { if (s.done) touch('shopping', s.id); });
    state.shopping = state.shopping.filter(function (s) { return !s.done; });
    notify();
  }

  /* ---------- Personer og data ---------- */

  function person(key) {
    return state.people[key] || state.people.shared;
  }

  function setPeople(people) {
    state.people = normalizePeople(people);
    touch('meta', 'people');
    notify();
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var data = JSON.parse(text);
    var previous = recordKeys();
    state = migrate(data);
    markAllDirty(previous);
    notify();
  }

  function reset() {
    var previous = recordKeys();
    state = defaultState();
    markAllDirty(previous);
    notify();
  }

  global.Store = {
    load: load,
    save: save,
    subscribe: subscribe,
    notify: notify,
    get state() { return state; },
    newItem: newItem,
    getItem: getItem,
    updateItem: updateItem,
    deleteItem: deleteItem,
    toggleDone: toggleDone,
    isDone: isDone,
    occursOn: occursOn,
    occurrencesOn: occurrencesOn,
    occurrencesInRange: occurrencesInRange,
    undatedItems: undatedItems,
    sortOccurrences: sortOccurrences,
    addShopping: addShopping,
    toggleShopping: toggleShopping,
    deleteShopping: deleteShopping,
    clearDoneShopping: clearDoneShopping,
    person: person,
    setPeople: setPeople,
    mealOn: mealOn,
    setMeal: setMeal,
    isMeal: isMeal,
    withoutMeals: withoutMeals,
    isDirty: isDirty,
    hasPending: function () { return Object.keys(dirty).length > 0; },
    pendingChanges: pendingChanges,
    clearPending: clearPending,
    applyRemote: applyRemote,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset
  };
})(window);
