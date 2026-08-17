/* Ugevisning: syv dagkolonner med hurtig oprettelse og træk-og-slip. */
(function (global) {
  'use strict';

  var U = global.U;

  function range() {
    var from = U.startOfWeek(global.App.cursor);
    return { from: from, to: U.addDays(from, 6) };
  }

  function title() {
    var r = range();
    var sameMonth = r.from.getMonth() === r.to.getMonth();
    var left = sameMonth ? r.from.getDate() + '.' : U.formatDateShort(r.from);
    return 'Uge ' + U.isoWeek(r.from) + ' · ' + left + '–' + r.to.getDate() + '. ' +
      U.MONTHS[r.to.getMonth()] + ' ' + r.to.getFullYear();
  }

  /* Aftensmaden vises i sit eget felt, ikke som et kort blandt opgaverne.
     Klikker man på den, bliver feltet til et skrivefelt. */
  function mealSlot(iso) {
    if (global.App.editingMeal === iso) {
      var current = global.Store.mealOn(iso);
      return '<input class="meal meal--edit" type="text" data-meal-input="' + iso + '"' +
        ' value="' + U.escapeHtml(current ? current.title : '') + '"' +
        ' placeholder="Hvad spiser vi?" aria-label="Aftensmad" maxlength="80">';
    }
    var meal = global.Store.mealOn(iso);
    return '<button class="meal' + (meal ? '' : ' is-empty') + '" type="button" data-meal-date="' + iso + '">' +
      '<span class="meal__icon" aria-hidden="true">🍽</span>' +
      '<span class="meal__text">' + U.escapeHtml(meal ? meal.title : 'Aftensmad') + '</span>' +
      '</button>';
  }

  function dayColumn(date) {
    var iso = U.toISO(date);
    var occ = global.Store.withoutMeals(global.App.applyFilter(global.Store.occurrencesOn(date)));
    var isToday = U.sameDay(date, U.today());
    var isWeekend = date.getDay() === 0 || date.getDay() === 6;
    var open = occ.filter(function (o) { return !o.done; }).length;

    var cls = ['day'];
    if (isToday) cls.push('is-today');
    if (isWeekend) cls.push('is-weekend');

    return '' +
      '<section class="' + cls.join(' ') + '" data-drop-date="' + iso + '">' +
        '<header class="day__head">' +
          '<div>' +
            '<span class="day__name">' + U.WEEKDAYS[(date.getDay() + 6) % 7] + '</span>' +
            '<span class="day__date">' + date.getDate() + '. ' + U.MONTHS[date.getMonth()].slice(0, 3) + '.</span>' +
          '</div>' +
          (open ? '<span class="day__count" title="Åbne punkter">' + open + '</span>' : '') +
        '</header>' +
        mealSlot(iso) +
        '<div class="day__list">' +
          (occ.length ? global.Render.cards(occ) : '<p class="day__empty">Ingen planer</p>') +
        '</div>' +
        '<input class="day__add" type="text" placeholder="+ Tilføj" data-quickadd="' + iso + '" aria-label="Tilføj punkt til ' + U.formatDate(date) + '">' +
      '</section>';
  }

  function summary() {
    var r = range();
    var all = global.Store.withoutMeals(global.Store.occurrencesInRange(r.from, r.to));
    var keys = ['a', 'b', 'shared'];
    var html = keys.map(function (k) {
      var mine = all.filter(function (o) { return o.item.assignee === k; });
      var open = mine.filter(function (o) { return !o.done; }).length;
      var p = global.Store.person(k);
      return '<div class="stat" style="--person:' + U.escapeHtml(p.color) + '">' +
        '<span class="stat__name">' + U.escapeHtml(p.name) + '</span>' +
        '<span class="stat__value">' + open + ' åbne</span>' +
        '<span class="stat__sub">' + mine.length + ' i alt</span>' +
        '</div>';
    }).join('');
    return '<div class="stats">' + html + '</div>';
  }

  function render() {
    var r = range();
    var days = '';
    for (var i = 0; i < 7; i++) days += dayColumn(U.addDays(r.from, i));

    return '' +
      global.App.toolbar(title()) +
      summary() +
      '<div class="week">' + days + '</div>';
  }

  global.ViewWeek = {
    id: 'week',
    step: function (dir) { global.App.cursor = U.addDays(global.App.cursor, dir * 7); },
    render: render
  };
})(window);
