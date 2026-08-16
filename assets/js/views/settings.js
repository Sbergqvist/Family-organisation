/* Indstillinger: navne, farver og sikkerhedskopi af data. */
(function (global) {
  'use strict';

  var U = global.U;

  function personFields(key, label) {
    var p = global.Store.person(key);
    return '' +
      '<div class="field-row">' +
        '<label class="field">' +
          '<span class="field__label">' + U.escapeHtml(label) + '</span>' +
          '<input class="input" type="text" maxlength="30" data-person-name="' + key + '" value="' + U.escapeHtml(p.name) + '">' +
        '</label>' +
        '<label class="field field--color">' +
          '<span class="field__label">Farve</span>' +
          '<input class="input input--color" type="color" data-person-color="' + key + '" value="' + U.escapeHtml(p.color) + '">' +
        '</label>' +
      '</div>';
  }

  function render() {
    var s = global.Store.state;
    return '' +
      global.App.toolbar('Indstillinger', { nav: false }) +
      '<div class="panels">' +
        '<section class="panel">' +
          '<h3 class="panel__title">Hvem planlægger?</h3>' +
          '<p class="panel__hint">Navnene bruges alle steder i planen. Farven gør det let at se hvem der har hvad.</p>' +
          personFields('a', 'Person 1') +
          personFields('b', 'Person 2') +
          personFields('shared', 'Fælles') +
          '<button class="btn btn--primary" type="button" id="savePeople">Gem navne og farver</button>' +
        '</section>' +

        '<section class="panel">' +
          '<h3 class="panel__title">Data</h3>' +
          '<p class="panel__hint">Alt gemmes lokalt i denne browser — der sendes ingenting til en server. ' +
            'Vil I dele planen mellem to enheder, så eksportér filen og importér den på den anden enhed.</p>' +
          '<p class="panel__stats">' + s.items.length + ' punkter · ' + s.shopping.length + ' varer på indkøbslisten</p>' +
          '<div class="btn-row">' +
            '<button class="btn" type="button" id="exportData">Eksportér som fil</button>' +
            '<label class="btn" for="importData">Importér fil</label>' +
            '<input type="file" id="importData" accept="application/json,.json" hidden>' +
            '<button class="btn btn--danger" type="button" id="resetData">Nulstil alt</button>' +
          '</div>' +
        '</section>' +

        '<section class="panel">' +
          '<h3 class="panel__title">Genveje</h3>' +
          '<ul class="panel__list">' +
            '<li><kbd>N</kbd> — nyt punkt</li>' +
            '<li><kbd>←</kbd> / <kbd>→</kbd> — forrige/næste uge eller måned</li>' +
            '<li><kbd>T</kbd> — hop til i dag</li>' +
            '<li>Træk et kort til en anden dag for at flytte det</li>' +
          '</ul>' +
        '</section>' +
      '</div>';
  }

  global.ViewSettings = {
    id: 'settings',
    render: render
  };
})(window);
