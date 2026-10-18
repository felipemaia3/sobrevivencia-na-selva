/*
 * inventory.js — inventário com pilhas, ferramentas com durabilidade e
 * hotbar de 6 espaços (os seis primeiros slots).
 */
(function (SV) {
  'use strict';

  function Inventory(size) {
    this.size = size || 24;
    this.hotbar = 6;
    this.slots = new Array(this.size).fill(null);
  }
  SV.Inventory = Inventory;

  Inventory.prototype.def = function (slot) {
    return slot ? SV.Items.get(slot.id) : null;
  };

  Inventory.prototype.count = function (id) {
    var n = 0;
    for (var i = 0; i < this.size; i++) if (this.slots[i] && this.slots[i].id === id) n += this.slots[i].n;
    return n;
  };

  Inventory.prototype.totalItems = function () {
    var n = 0;
    for (var i = 0; i < this.size; i++) if (this.slots[i]) n += this.slots[i].n;
    return n;
  };

  /** Adiciona itens respeitando pilhas e capacidade. Retorna quantos entraram. */
  Inventory.prototype.add = function (id, n, dur) {
    var def = SV.Items.get(id);
    if (!def) return 0;
    n = n === undefined ? 1 : n;
    var left = n, stack = def.stack || 1;
    if (stack > 1) {
      for (var i = 0; i < this.size && left > 0; i++) {
        var s = this.slots[i];
        if (s && s.id === id && s.n < stack && !s.dur) {
          var add = Math.min(stack - s.n, left);
          s.n += add; left -= add;
        }
      }
    }
    for (var j = 0; j < this.size && left > 0; j++) {
      if (!this.slots[j]) {
        var take = Math.min(stack, left);
        this.slots[j] = { id: id, n: take };
        if (def.dur) this.slots[j].dur = dur === undefined ? def.dur : dur;
        left -= take;
      }
    }
    return n - left;
  };

  Inventory.prototype.remove = function (id, n) {
    n = n === undefined ? 1 : n;
    if (this.count(id) < n) return false;
    for (var i = this.size - 1; i >= 0 && n > 0; i--) {
      var s = this.slots[i];
      if (s && s.id === id) {
        var take = Math.min(s.n, n);
        s.n -= take; n -= take;
        if (s.n <= 0) this.slots[i] = null;
      }
    }
    return true;
  };

  Inventory.prototype.findFirst = function (id) {
    for (var i = 0; i < this.size; i++) if (this.slots[i] && this.slots[i].id === id) return i;
    return -1;
  };

  Inventory.prototype.slot = function (i) { return this.slots[i] || null; };

  /** Índice do slot que contém a ferramenta do tipo dado (axe/spear/...). */
  Inventory.prototype.findTool = function (toolKind) {
    for (var i = 0; i < this.size; i++) {
      var s = this.slots[i];
      if (s) { var d = SV.Items.get(s.id); if (d && d.tool === toolKind) return i; }
    }
    return -1;
  };

  Inventory.prototype.damageTool = function (i, amount) {
    var s = this.slots[i];
    if (!s) return null;
    var d = SV.Items.get(s.id);
    if (!d || !d.dur || d.dur >= 999) return s;
    s.dur = Math.max(0, (s.dur === undefined ? d.dur : s.dur) - amount);
    if (s.dur <= 0) { this.slots[i] = null; return 'broken'; }
    return s;
  };

  Inventory.prototype.repair = function (id, ratio) {
    var i = this.findFirst(id);
    if (i < 0) return false;
    var s = this.slots[i], d = SV.Items.get(id);
    s.dur = Math.min(d.dur, Math.round((s.dur || 0) + d.dur * (ratio || 0.4)));
    return true;
  };

  Inventory.prototype.move = function (a, b) {
    if (a === b || a < 0 || b < 0 || a >= this.size || b >= this.size) return;
    var ta = this.slots[a], tb = this.slots[b];
    if (ta && tb && ta.id === tb.id) {
      var def = SV.Items.get(ta.id), cap = def.stack || 1;
      if (!ta.dur && !tb.dur && tb.n < cap) {
        var move = Math.min(cap - tb.n, ta.n);
        tb.n += move; ta.n -= move;
        if (ta.n <= 0) this.slots[a] = null;
        return;
      }
    }
    this.slots[a] = tb; this.slots[b] = ta;
  };

  Inventory.prototype.serialize = function () { return this.slots.map(function (s) { return s ? { id: s.id, n: s.n, dur: s.dur } : null; }); };
  Inventory.prototype.load = function (arr) {
    this.slots = new Array(this.size).fill(null);
    if (!arr) return;
    for (var i = 0; i < Math.min(arr.length, this.size); i++) this.slots[i] = arr[i] || null;
  };
})(window.SV);
