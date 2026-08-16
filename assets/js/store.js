/* Datalag: state, lagring i browseren (localStorage) og gentagelses-logik. */
(function (global) {
  'use strict';

  var U = global.U;
  var KEY = 'familieplan.v1';
  var listeners = [];

  var state = null;

  function defaultState() {
    var monday = U.startOfWeek(U.today());
    return {
      version: 1,
      people: {
        a: { name: 'Mig', color: '#3b6ea5' },
        b: { name: 'Min kone', color: '#b8577a' },
        shared: { name: 'Fælles', color: '#4f9a71' }
      },
      items: [
        {
          id: U.uid(), title: 'Ugeplanlægning sammen', notes: 'Gennemgå kalender, opgaver og indkøb for den kommende uge.',
          type: 'event', assignee: 'shared', date: U.toISO(U.addDays(monday, 6)), time: '19:00',
          repeat: 'weekly', priority: 'normal', done: false, completed: {}, createdAt: Date.now()
        },
        {
          id: U.uid(), title: 'Tømme skraldespand', notes: '',
          type: 'task', assignee: 'a', date: U.toISO(U.addDays(monday, 1)), time: '',
          repeat: 'weekly', priority: 'normal', done: false, completed: {}, createdAt: Date.now()
        },
        {
          id: U.uid(), title: 'Bestille tid til tandlæge', notes: '',
          type: 'task', assignee: 'b', date: '', time: '',
          repeat: 'none', priority: 'high', done: false, completed: {}, createdAt: Date.now()
        }
      ],
      shopping: [
        { id: U.uid(), title: 'Mælk', done: false, createdAt: Date.now() },
        { id: U.uid(), title: 'Kaffe', done: false, createdAt: Date.now() }
      ]
    };
  }

  function load() {
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

  /* Gør indlæste data robuste mod manglende felter (fx fra en ældre version). */
  function migrate(data) {
    var base = defaultState();
    if (!data || typeof data !== 'object') return base;
    data.version = 1;
    data.people = data.people || base.people;
    ['a', 'b', 'shared'].forEach(function (k) {
      data.people[k] = data.people[k] || base.people[k];
      data.people[k].name = data.people[k].name || base.people[k].name;
      data.people[k].color = data.people[k].color || base.people[k].color;
    });
    data.items = Array.isArray(data.items) ? data.items : [];
    data.items.forEach(function (it) {
      it.id = it.id || U.uid();
      it.title = it.title || '(uden titel)';
      it.type = it.type === 'event' ? 'event' : 'task';
      it.assignee = ['a', 'b', 'shared'].indexOf(it.assignee) >= 0 ? it.assignee : 'shared';
      it.date = it.date || '';
      it.time = it.time || '';
      it.repeat = it.repeat || 'none';
      it.priority = it.priority || 'normal';
      it.done = !!it.done;
      it.completed = it.completed && typeof it.completed === 'object' ? it.completed : {};
      it.notes = it.notes || '';
      it.createdAt = it.createdAt || Date.now();
    });
    data.shopping = Array.isArray(data.shopping) ? data.shopping : [];
    data.shopping.forEach(function (s) {
      s.id = s.id || U.uid();
      s.title = s.title || '';
      s.done = !!s.done;
      s.createdAt = s.createdAt || Date.now();
    });
    return data;
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
    notify();
    return item;
  }

  function deleteItem(id) {
    state.items = state.items.filter(function (it) { return it.id !== id; });
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
    state.shopping.push({ id: U.uid(), title: title, done: false, createdAt: Date.now() });
    notify();
  }

  function toggleShopping(id) {
    state.shopping.forEach(function (s) { if (s.id === id) s.done = !s.done; });
    notify();
  }

  function deleteShopping(id) {
    state.shopping = state.shopping.filter(function (s) { return s.id !== id; });
    notify();
  }

  function clearDoneShopping() {
    state.shopping = state.shopping.filter(function (s) { return !s.done; });
    notify();
  }

  /* ---------- Personer og data ---------- */

  function person(key) {
    return state.people[key] || state.people.shared;
  }

  function setPeople(people) {
    state.people = people;
    notify();
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var data = JSON.parse(text);
    state = migrate(data);
    notify();
  }

  function reset() {
    state = defaultState();
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
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset
  };
})(window);
