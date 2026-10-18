/*
 * save.js — persistência local (localStorage) do estado do jogo.
 */
(function (SV) {
  'use strict';
  var KEY = 'sobrevivencia_floresta_v1';

  SV.Save = {
    version: 1,
    write: function (obj) {
      try {
        obj.__v = SV.Save.version;
        localStorage.setItem(KEY, JSON.stringify(obj));
        return true;
      } catch (e) { return false; }
    },
    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (!o || o.__v !== SV.Save.version) return null;   // save antigo: descarta
        return o;
      } catch (e) { return null; }
    },
    has: function () { return !!SV.Save.read(); },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) { } }
  };
})(window.SV);
