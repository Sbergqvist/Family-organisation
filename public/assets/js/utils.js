/* Hjælpefunktioner: datoer, DOM og små utilities. */
(function (global) {
  'use strict';

  var WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
  var WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
  var MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* Lokal ISO-dato (YYYY-MM-DD) — undgår UTC-forskydning fra toISOString(). */
  function toISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseISO(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function today() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  /* Lægger måneder til og klipper til sidste dag i måneden (31. jan + 1 md = 28./29. feb). */
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    var last = daysInMonth(d.getFullYear(), d.getMonth());
    d.setDate(Math.min(day, last));
    return d;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  /* Ugen starter mandag (dansk standard). */
  function startOfWeek(date) {
    var d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    var wd = (d.getDay() + 6) % 7; // 0 = mandag
    return addDays(d, -wd);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function diffDays(a, b) {
    var ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate());
    return Math.round(ms / 86400000);
  }

  /* ISO-8601 ugenummer. */
  function isoWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var firstThursday = new Date(d.getFullYear(), 0, 4);
    firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
    return 1 + Math.round((d - firstThursday) / (7 * 86400000));
  }

  function formatDate(date) {
    return date.getDate() + '. ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear();
  }

  function formatDateShort(date) {
    return date.getDate() + '. ' + MONTHS[date.getMonth()].slice(0, 3) + '.';
  }

  function monthName(date) {
    var n = MONTHS[date.getMonth()];
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  function relativeDay(iso) {
    var d = parseISO(iso);
    if (!d) return 'Ingen dato';
    var delta = diffDays(today(), d);
    if (delta === 0) return 'I dag';
    if (delta === 1) return 'I morgen';
    if (delta === -1) return 'I går';
    if (delta > 1 && delta < 7) return WEEKDAYS[(d.getDay() + 6) % 7];
    return formatDateShort(d);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* Event-delegering: kald handler når et klik rammer noget der matcher sel. */
  function on(root, type, sel, handler) {
    root.addEventListener(type, function (e) {
      var el = e.target.closest(sel);
      if (el && root.contains(el)) handler(e, el);
    });
  }

  global.U = {
    WEEKDAYS: WEEKDAYS,
    WEEKDAYS_SHORT: WEEKDAYS_SHORT,
    MONTHS: MONTHS,
    pad: pad,
    toISO: toISO,
    parseISO: parseISO,
    today: today,
    addDays: addDays,
    addMonths: addMonths,
    daysInMonth: daysInMonth,
    startOfWeek: startOfWeek,
    startOfMonth: startOfMonth,
    endOfMonth: endOfMonth,
    sameDay: sameDay,
    diffDays: diffDays,
    isoWeek: isoWeek,
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    monthName: monthName,
    relativeDay: relativeDay,
    uid: uid,
    escapeHtml: escapeHtml,
    $: $,
    $$: $$,
    on: on
  };
})(window);
