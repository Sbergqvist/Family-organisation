/* Fælles opmærkning der genbruges på tværs af visningerne. */
(function (global) {
  'use strict';

  var U = global.U;

  var REPEAT_LABEL = {
    none: '',
    daily: 'Hver dag',
    weekly: 'Hver uge',
    biweekly: 'Hver 2. uge',
    monthly: 'Hver måned',
    yearly: 'Hvert år'
  };

  function personBadge(key) {
    var p = global.Store.person(key);
    return '<span class="chip" style="--person:' + U.escapeHtml(p.color) + '">' + U.escapeHtml(p.name) + '</span>';
  }

  /* Ét punkt som kort. opts.showDate viser datoen (bruges i to-do-listen). */
  function card(occ, opts) {
    opts = opts || {};
    var it = occ.item;
    var p = global.Store.person(it.assignee);
    var cls = ['card', 'card--' + it.type];
    if (occ.done) cls.push('is-done');
    if (it.priority === 'high') cls.push('is-high');

    var meta = [];
    if (it.time) meta.push('<span class="card__time">' + U.escapeHtml(it.time) + '</span>');
    if (opts.showDate && occ.date) meta.push('<span class="card__date">' + U.escapeHtml(U.relativeDay(occ.date)) + '</span>');
    if (opts.showPerson !== false) meta.push(personBadge(it.assignee));
    if (occ.recurring) {
      meta.push('<span class="card__repeat" title="' + U.escapeHtml(REPEAT_LABEL[it.repeat] || 'Gentages') + '">↻</span>');
    }
    if (it.notes) meta.push('<span class="card__note-flag" title="Har noter">✎</span>');

    return '' +
      '<article class="' + cls.join(' ') + '" data-id="' + U.escapeHtml(it.id) + '" data-date="' + U.escapeHtml(occ.date) + '" draggable="true" style="--person:' + U.escapeHtml(p.color) + '">' +
        '<button class="card__check" type="button" data-action="toggle" aria-pressed="' + (occ.done ? 'true' : 'false') + '" aria-label="Skift status for ' + U.escapeHtml(it.title) + '"></button>' +
        '<div class="card__body" data-action="edit" role="button" tabindex="0">' +
          '<div class="card__title">' + U.escapeHtml(it.title) + '</div>' +
          (meta.length ? '<div class="card__meta">' + meta.join('') + '</div>' : '') +
        '</div>' +
      '</article>';
  }

  function cards(list, opts) {
    if (!list.length) return '';
    return list.map(function (o) { return card(o, opts); }).join('');
  }

  function empty(text) {
    return '<p class="empty">' + U.escapeHtml(text) + '</p>';
  }

  global.Render = {
    REPEAT_LABEL: REPEAT_LABEL,
    personBadge: personBadge,
    card: card,
    cards: cards,
    empty: empty
  };
})(window);
