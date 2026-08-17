/* To-do-visning: alle punkter samlet og grupperet efter hvornår de skal ske. */
(function (global) {
  'use strict';

  var U = global.U;
  var LOOK_BACK = 30;   // dage tilbage der vises som forfaldne
  var LOOK_AHEAD = 120; // dage frem der vises under “Senere”

  function group(name, list, opts) {
    if (!list.length) return '';
    return '<section class="group">' +
      '<h3 class="group__title">' + U.escapeHtml(name) + ' <span class="group__count">' + list.length + '</span></h3>' +
      '<div class="group__list">' + global.Render.cards(list, opts) + '</div>' +
      '</section>';
  }

  /* Beholder kun den første forekomst pr. punkt (listen er sorteret efter dato). */
  function firstPerItem(list) {
    var seen = {};
    return list.filter(function (o) {
      if (seen[o.id]) return false;
      seen[o.id] = true;
      return true;
    });
  }

  function render() {
    var today = U.today();
    var occ = global.Store.withoutMeals(global.App.applyFilter(
      global.Store.occurrencesInRange(U.addDays(today, -LOOK_BACK), U.addDays(today, LOOK_AHEAD))
    ));
    var undated = global.Store.withoutMeals(global.App.applyFilter(global.Store.undatedItems()));

    if (!global.App.showDone) {
      occ = occ.filter(function (o) { return !o.done; });
      undated = undated.filter(function (o) { return !o.done; });
    }

    var buckets = { overdue: [], today: [], tomorrow: [], week: [], later: [] };
    occ.forEach(function (o) {
      var delta = U.diffDays(today, U.parseISO(o.date));
      if (delta < 0) {
        if (!o.done) buckets.overdue.push(o);
      } else if (delta === 0) buckets.today.push(o);
      else if (delta === 1) buckets.tomorrow.push(o);
      else if (delta <= 7) buckets.week.push(o);
      else buckets.later.push(o);
    });

    /* Længere ude viser vi kun næste forekomst af et gentaget punkt — ellers fylder det hele listen. */
    buckets.later = firstPerItem(buckets.later);

    var body = '' +
      group('Forfaldne', buckets.overdue, { showDate: true }) +
      group('I dag', buckets.today) +
      group('I morgen', buckets.tomorrow) +
      group('Resten af ugen', buckets.week, { showDate: true }) +
      group('Senere', buckets.later, { showDate: true }) +
      group('Uden dato', undated);

    var total = buckets.overdue.length + buckets.today.length + buckets.tomorrow.length +
      buckets.week.length + buckets.later.length + undated.length;

    return '' +
      global.App.toolbar('To-do', { nav: false, extra:
        '<label class="switch"><input type="checkbox" id="toggleDone"' + (global.App.showDone ? ' checked' : '') + '> Vis udførte</label>'
      }) +
      '<div class="quickadd">' +
        '<input class="input" type="text" id="todoQuickAdd" placeholder="Ny opgave — tryk Enter" autocomplete="off" aria-label="Ny opgave uden dato">' +
      '</div>' +
      (total ? '<div class="groups">' + body + '</div>' : global.Render.empty('Ingenting på listen. Godt gået! 🎉'));
  }

  global.ViewTodo = {
    id: 'todo',
    render: render
  };
})(window);
