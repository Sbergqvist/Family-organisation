/* Månedsvisning: kalendergitter på store skærme, dagsliste på små. */
(function (global) {
  'use strict';

  var U = global.U;

  function gridRange() {
    var first = U.startOfMonth(global.App.cursor);
    var last = U.endOfMonth(global.App.cursor);
    var start = U.startOfWeek(first);
    var end = U.addDays(U.startOfWeek(last), 6);
    return { start: start, end: end, first: first, last: last };
  }

  function cell(date, monthIndex) {
    var iso = U.toISO(date);
    var occ = global.App.applyFilter(global.Store.occurrencesOn(date));
    var cls = ['mcell'];
    if (date.getMonth() !== monthIndex) cls.push('is-outside');
    if (U.sameDay(date, U.today())) cls.push('is-today');
    if (date.getDay() === 0 || date.getDay() === 6) cls.push('is-weekend');

    return '' +
      '<div class="' + cls.join(' ') + '" data-drop-date="' + iso + '">' +
        '<div class="mcell__head">' +
          '<span class="mcell__num">' + date.getDate() + '</span>' +
          '<button class="mcell__add" type="button" data-addday="' + iso + '" aria-label="Tilføj punkt den ' + U.formatDate(date) + '">+</button>' +
        '</div>' +
        '<div class="mcell__list">' + global.Render.cards(occ, { showPerson: false }) + '</div>' +
      '</div>';
  }

  function grid() {
    var r = gridRange();
    var monthIndex = global.App.cursor.getMonth();
    var head = U.WEEKDAYS_SHORT.map(function (d) {
      return '<div class="mhead">' + d + '</div>';
    }).join('');

    var cells = '';
    for (var d = new Date(r.start.getTime()); d <= r.end; d = U.addDays(d, 1)) {
      cells += cell(d, monthIndex);
    }
    return '<div class="month-grid">' + head + cells + '</div>';
  }

  function agenda() {
    var r = gridRange();
    var out = '';
    for (var d = new Date(r.first.getTime()); d <= r.last; d = U.addDays(d, 1)) {
      var occ = global.App.applyFilter(global.Store.occurrencesOn(d));
      if (!occ.length) continue;
      var isToday = U.sameDay(d, U.today());
      out += '<section class="agenda__day' + (isToday ? ' is-today' : '') + '" data-drop-date="' + U.toISO(d) + '">' +
        '<h3 class="agenda__title">' + U.WEEKDAYS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + '. ' + U.MONTHS[d.getMonth()] + '</h3>' +
        global.Render.cards(occ) +
        '</section>';
    }
    return '<div class="month-agenda">' + (out || global.Render.empty('Ingen planer i denne måned.')) + '</div>';
  }

  function render() {
    var title = U.monthName(global.App.cursor) + ' ' + global.App.cursor.getFullYear();
    return global.App.toolbar(title) + grid() + agenda();
  }

  global.ViewMonth = {
    id: 'month',
    step: function (dir) { global.App.cursor = U.addMonths(global.App.cursor, dir); },
    render: render
  };
})(window);
