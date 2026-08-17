/* App: navigation mellem visninger, dialog, træk-og-slip og tastaturgenveje. */
(function (global) {
  'use strict';

  var U = global.U;
  var Store = global.Store;
  var UI_KEY = 'familieplan.ui';

  var root = U.$('#viewRoot');
  var modal = U.$('#modal');
  var form = U.$('#itemForm');
  var toastEl = U.$('#toast');
  var toastTimer = null;

  var VIEWS = {
    week: global.ViewWeek,
    month: global.ViewMonth,
    todo: global.ViewTodo,
    shopping: global.ViewShopping,
    settings: global.ViewSettings
  };

  var App = {
    view: 'week',
    cursor: U.today(),
    filter: 'all',
    showDone: false,
    editingMeal: null,   // datoen hvis madplan-feltet er åbent til skrivning

    /* Personfiltret er inkluderende: vælger man en person, følger fælles punkter med. */
    applyFilter: function (list) {
      if (App.filter === 'all') return list;
      if (App.filter === 'shared') {
        return list.filter(function (o) { return o.item.assignee === 'shared'; });
      }
      return list.filter(function (o) {
        return o.item.assignee === App.filter || o.item.assignee === 'shared';
      });
    },

    toolbar: function (title, opts) {
      opts = opts || {};
      var nav = opts.nav === false ? '' :
        '<button class="icon-btn" type="button" data-nav="-1" aria-label="Forrige">‹</button>' +
        '<button class="icon-btn" type="button" data-nav="1" aria-label="Næste">›</button>' +
        '<button class="btn btn--ghost" type="button" data-nav="0">I dag</button>';

      var chips = [{ key: 'all', name: 'Alle', color: 'var(--muted)' }].concat(
        ['a', 'b', 'shared'].map(function (k) {
          var p = Store.person(k);
          return { key: k, name: p.name, color: p.color };
        })
      ).map(function (c) {
        var active = App.filter === c.key ? ' is-active' : '';
        var hint = (c.key === 'a' || c.key === 'b') ? ' title="Viser også fælles punkter"' : '';
        return '<button class="filter' + active + '" type="button" data-filter="' + c.key + '"' + hint +
          ' style="--person:' + U.escapeHtml(c.color) + '">' + U.escapeHtml(c.name) + '</button>';
      }).join('');

      return '' +
        '<div class="toolbar">' +
          '<div class="toolbar__left">' +
            '<h2 class="toolbar__title">' + U.escapeHtml(title) + '</h2>' +
            (nav ? '<div class="toolbar__nav">' + nav + '</div>' : '') +
          '</div>' +
          '<div class="toolbar__right">' +
            '<div class="filters" role="group" aria-label="Filtrér på person">' + chips + '</div>' +
            (opts.extra || '') +
          '</div>' +
        '</div>';
    },

    go: function (view) {
      if (!VIEWS[view]) return;
      App.view = view;
      saveUI();
      App.render();
    },

    render: function () {
      U.$$('#tabs .tab').forEach(function (t) {
        var active = t.getAttribute('data-view') === App.view;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-current', active ? 'page' : 'false');
      });
      root.innerHTML = VIEWS[App.view].render();
    }
  };
  global.App = App;

  /* ---------- UI-indstillinger huskes mellem besøg ---------- */

  function saveUI() {
    try {
      global.localStorage.setItem(UI_KEY, JSON.stringify({
        view: App.view, filter: App.filter, showDone: App.showDone
      }));
    } catch (e) { /* ignoreres */ }
  }

  function loadUI() {
    try {
      var raw = global.localStorage.getItem(UI_KEY);
      if (!raw) return;
      var ui = JSON.parse(raw);
      if (VIEWS[ui.view]) App.view = ui.view;
      if (ui.filter) App.filter = ui.filter;
      App.showDone = !!ui.showDone;
    } catch (e) { /* ignoreres */ }
  }

  /* ---------- Notifikation ---------- */

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------- Dialog ---------- */

  function fillAssignees() {
    var sel = U.$('#assigneeSelect');
    sel.innerHTML = ['a', 'b', 'shared'].map(function (k) {
      return '<option value="' + k + '">' + U.escapeHtml(Store.person(k).name) + '</option>';
    }).join('');
  }

  function openModal(itemId, prefill) {
    fillAssignees();
    form.reset();
    var item = itemId ? Store.getItem(itemId) : null;

    U.$('#modalTitle').textContent = item ? 'Redigér punkt' : 'Nyt punkt';
    U.$('#deleteItem').hidden = !item;

    var data = item || {
      id: '', title: '', type: 'task',
      assignee: App.filter === 'all' ? 'shared' : App.filter,
      date: (prefill && prefill.date) || '', time: '', repeat: 'none', priority: 'normal', notes: ''
    };

    form.elements.id.value = data.id || '';
    form.elements.title.value = data.title;
    form.elements.type.value = data.type;
    form.elements.assignee.value = data.assignee;
    form.elements.date.value = data.date;
    form.elements.time.value = data.time;
    form.elements.repeat.value = data.repeat;
    form.elements.priority.value = data.priority;
    form.elements.notes.value = data.notes;

    modal.hidden = false;
    document.body.classList.add('is-modal');
    setTimeout(function () { form.elements.title.focus(); }, 20);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('is-modal');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var patch = {
      title: f.title.value.trim(),
      type: f.type.value,
      assignee: f.assignee.value,
      date: f.date.value,
      time: f.time.value,
      repeat: f.date.value ? f.repeat.value : 'none',
      priority: f.priority.value,
      notes: f.notes.value.trim()
    };
    if (!patch.title) return;

    if (f.id.value) {
      Store.updateItem(f.id.value, patch);
    } else {
      Store.newItem(patch);
    }
    closeModal();
  });

  U.$('#deleteItem').addEventListener('click', function () {
    var id = form.elements.id.value;
    var item = Store.getItem(id);
    if (!item) return;
    var msg = item.repeat !== 'none'
      ? 'Slet “' + item.title + '”? Hele den gentagne serie fjernes.'
      : 'Slet “' + item.title + '”?';
    if (!global.confirm(msg)) return;
    Store.deleteItem(id);
    closeModal();
    toast('Punktet blev slettet');
  });

  U.on(modal, 'click', '[data-close]', function () { closeModal(); });

  U.on(modal, 'click', '[data-quickdate]', function (e, el) {
    var value = el.getAttribute('data-quickdate');
    form.elements.date.value = value === 'none' ? '' : U.toISO(U.addDays(U.today(), Number(value)));
  });

  /* ---------- Globale handlinger i visningerne ---------- */

  U.on(root, 'click', '[data-nav]', function (e, el) {
    var dir = Number(el.getAttribute('data-nav'));
    var view = VIEWS[App.view];
    if (dir === 0) App.cursor = U.today();
    else if (view.step) view.step(dir);
    App.render();
  });

  U.on(root, 'click', '[data-filter]', function (e, el) {
    App.filter = el.getAttribute('data-filter');
    saveUI();
    App.render();
  });

  U.on(root, 'click', '[data-action="toggle"]', function (e, el) {
    var card = el.closest('.card');
    Store.toggleDone(card.getAttribute('data-id'), card.getAttribute('data-date'));
  });

  U.on(root, 'click', '[data-action="edit"]', function (e, el) {
    openModal(el.closest('.card').getAttribute('data-id'));
  });

  U.on(root, 'keydown', '[data-action="edit"]', function (e, el) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(el.closest('.card').getAttribute('data-id'));
    }
  });

  U.on(root, 'click', '[data-addday]', function (e, el) {
    openModal(null, { date: el.getAttribute('data-addday') });
  });

  /* ---------- Madplan ---------- */

  U.on(root, 'click', '[data-meal-date]', function (e, el) {
    App.editingMeal = el.getAttribute('data-meal-date');
    App.render();
    var input = U.$('[data-meal-input="' + App.editingMeal + '"]');
    if (input) {
      input.focus();
      input.select();
    }
  });

  U.on(root, 'keydown', '[data-meal-input]', function (e, el) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitMeal(el);
    } else if (e.key === 'Escape') {
      App.editingMeal = null;
      App.render();
    }
  });

  /* Klikker man ved siden af, gemmes det skrevne frem for at kaste det væk.
     Det skal være focusout og ikke blur — blur bobler ikke op til delegeringen. */
  U.on(root, 'focusout', '[data-meal-input]', function (e, el) {
    if (App.editingMeal) commitMeal(el);
  });

  function commitMeal(el) {
    var date = el.getAttribute('data-meal-input');
    App.editingMeal = null;
    Store.setMeal(date, el.value);
    App.render();
  }

  /* Hurtig oprettelse direkte i en dagkolonne. */
  U.on(root, 'keydown', '[data-quickadd]', function (e, el) {
    if (e.key !== 'Enter') return;
    var title = el.value.trim();
    if (!title) return;
    var date = el.getAttribute('data-quickadd');
    Store.newItem({
      title: title,
      date: date,
      assignee: App.filter === 'all' ? 'shared' : App.filter
    });
    el.value = '';
    var again = U.$('[data-quickadd="' + date + '"]');
    if (again) again.focus();
  });

  U.on(root, 'keydown', '#todoQuickAdd', function (e, el) {
    if (e.key !== 'Enter') return;
    var title = el.value.trim();
    if (!title) return;
    Store.newItem({ title: title, assignee: App.filter === 'all' ? 'shared' : App.filter });
    el.value = '';
    var again = U.$('#todoQuickAdd');
    if (again) again.focus();
  });

  U.on(root, 'change', '#toggleDone', function (e, el) {
    App.showDone = el.checked;
    saveUI();
    App.render();
  });

  /* ---------- Indkøbsliste ---------- */

  U.on(root, 'keydown', '#shopQuickAdd', function (e, el) {
    if (e.key !== 'Enter') return;
    var title = el.value.trim();
    if (!title) return;
    Store.addShopping(title);
    el.value = '';
    var again = U.$('#shopQuickAdd');
    if (again) again.focus();
  });

  U.on(root, 'change', '[data-action="shop-toggle"]', function (e, el) {
    Store.toggleShopping(el.closest('.srow').getAttribute('data-shop-id'));
  });

  U.on(root, 'click', '[data-action="shop-delete"]', function (e, el) {
    Store.deleteShopping(el.closest('.srow').getAttribute('data-shop-id'));
  });

  U.on(root, 'click', '#clearShopping', function () {
    Store.clearDoneShopping();
  });

  /* ---------- Indstillinger ---------- */

  U.on(root, 'click', '#savePeople', function () {
    var people = {};
    ['a', 'b', 'shared'].forEach(function (k) {
      var name = U.$('[data-person-name="' + k + '"]').value.trim();
      var color = U.$('[data-person-color="' + k + '"]').value;
      people[k] = { name: name || Store.person(k).name, color: color };
    });
    Store.setPeople(people);
    toast('Navne og farver er gemt');
  });

  U.on(root, 'click', '#exportData', function () {
    var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'familieplan-' + U.toISO(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  U.on(root, 'change', '#importData', function (e, el) {
    var file = el.files && el.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        Store.importJSON(String(reader.result));
        toast('Data blev importeret');
      } catch (err) {
        global.alert('Filen kunne ikke læses som en gyldig familieplan-fil.');
      }
    };
    reader.readAsText(file);
  });

  U.on(root, 'click', '#resetData', function () {
    if (!global.confirm('Nulstil alt? Alle punkter og indkøb slettes i denne browser.')) return;
    Store.reset();
    toast('Alt er nulstillet');
  });

  /* ---------- Træk og slip ---------- */

  var dragId = null;

  root.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    dragId = card.getAttribute('data-id');
    card.classList.add('is-dragging');
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* ignoreres */ }
    e.dataTransfer.effectAllowed = 'move';
  });

  root.addEventListener('dragend', function (e) {
    var card = e.target.closest('.card');
    if (card) card.classList.remove('is-dragging');
    U.$$('.is-dropzone').forEach(function (el) { el.classList.remove('is-dropzone'); });
    dragId = null;
  });

  root.addEventListener('dragover', function (e) {
    var zone = e.target.closest('[data-drop-date]');
    if (!zone || !dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('is-dropzone');
  });

  root.addEventListener('dragleave', function (e) {
    var zone = e.target.closest('[data-drop-date]');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('is-dropzone');
  });

  root.addEventListener('drop', function (e) {
    var zone = e.target.closest('[data-drop-date]');
    if (!zone) return;
    e.preventDefault();
    var id = dragId || e.dataTransfer.getData('text/plain');
    var item = Store.getItem(id);
    zone.classList.remove('is-dropzone');
    if (!item) return;

    var date = zone.getAttribute('data-drop-date');
    if (item.date === date) return;
    Store.updateItem(id, { date: date });
    if (item.repeat !== 'none') toast('Hele serien blev flyttet til ' + U.relativeDay(date).toLowerCase());
  });

  /* ---------- Faneblade, knapper og tastatur ---------- */

  U.on(U.$('#tabs'), 'click', '.tab', function (e, el) {
    App.go(el.getAttribute('data-view'));
  });

  U.$('#globalAdd').addEventListener('click', function () {
    var prefill = {};
    if (App.view === 'week' || App.view === 'month') prefill.date = U.toISO(U.today());
    openModal(null, prefill);
  });

  document.addEventListener('keydown', function (e) {
    if (!modal.hidden) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

    var view = VIEWS[App.view];
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openModal(null, App.view === 'week' || App.view === 'month' ? { date: U.toISO(U.today()) } : {});
    } else if (e.key === 't' || e.key === 'T') {
      App.cursor = U.today();
      App.render();
    } else if (e.key === 'ArrowLeft' && view.step) {
      view.step(-1);
      App.render();
    } else if (e.key === 'ArrowRight' && view.step) {
      view.step(1);
      App.render();
    }
  });

  /* ---------- Synkroniseringsstatus i topbaren ---------- */

  var syncBadge = U.$('#syncStatus');

  function paintSync() {
    var s = global.Sync.state();
    syncBadge.textContent = global.Sync.label();
    syncBadge.className = 'sync is-' + s.status;
    syncBadge.hidden = s.status === 'disabled';
  }

  U.on(root, 'click', '#syncNow', function () {
    if (global.Sync.state().status === 'auth') {
      global.location.reload();
      return;
    }
    global.Sync.sync({ force: true }).then(function (ok) {
      toast(ok ? 'Synkroniseret' : 'Kunne ikke få forbindelse — ændringerne er gemt lokalt');
      App.render();
    });
  });

  /* ---------- Start ---------- */

  Store.load();
  loadUI();
  Store.subscribe(function () { App.render(); paintSync(); });
  global.Sync.onStatusChange(function () {
    paintSync();
    if (App.view === 'settings') App.render();
  });
  App.render();
  global.Sync.start();
  paintSync();
  setInterval(paintSync, 60000);

  /* Gør siden installérbar og brugbar uden net. Fejler den, kører appen videre. */
  if ('serviceWorker' in navigator && global.location.protocol !== 'file:') {
    global.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (err) {
        console.warn('Kunne ikke registrere service worker:', err.message);
      });
    });
  }
})(window);
