/* Indkøbsliste — en simpel fælles liste. */
(function (global) {
  'use strict';

  var U = global.U;

  function row(s) {
    return '' +
      '<li class="srow' + (s.done ? ' is-done' : '') + '" data-shop-id="' + U.escapeHtml(s.id) + '">' +
        '<label class="srow__label">' +
          '<input type="checkbox" data-action="shop-toggle"' + (s.done ? ' checked' : '') + '>' +
          '<span>' + U.escapeHtml(s.title) + '</span>' +
        '</label>' +
        '<button class="icon-btn" type="button" data-action="shop-delete" aria-label="Slet ' + U.escapeHtml(s.title) + '">✕</button>' +
      '</li>';
  }

  function render() {
    var list = global.Store.state.shopping.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.createdAt - b.createdAt;
    });
    var done = list.filter(function (s) { return s.done; }).length;

    return '' +
      global.App.toolbar('Indkøb', { nav: false, extra: done
        ? '<button class="btn" type="button" id="clearShopping">Ryd ' + done + ' afkrydsede</button>' : ''
      }) +
      '<div class="quickadd">' +
        '<input class="input" type="text" id="shopQuickAdd" placeholder="Tilføj vare — tryk Enter" autocomplete="off" aria-label="Tilføj vare">' +
      '</div>' +
      (list.length
        ? '<ul class="slist">' + list.map(row).join('') + '</ul>'
        : global.Render.empty('Indkøbslisten er tom.'));
  }

  global.ViewShopping = {
    id: 'shopping',
    render: render
  };
})(window);
