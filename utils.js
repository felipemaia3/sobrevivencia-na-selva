/*
 * utils.js — utilidades puras (sem renderização): matemática, RNG determinístico,
 * ruído de valor e manipulação de cores. Toda a lógica de arte/sistemas depende
 * daqui, o que garante mundos reprodutíveis a partir de uma mesma seed.
 */
window.SV = window.SV || {};

(function (SV) {
  'use strict';

  SV.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  SV.lerp = function (a, b, t) { return a + (b - a) * t; };
  SV.smoothstep = function (t) { t = SV.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  SV.dist = function (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); };
  SV.dist2 = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  SV.round = function (v) { return Math.floor(v + 0.5); };

  /** Gerador pseudoaleatório determinístico (mulberry32). */
  SV.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    function next() {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      range: function (a, b) { return a + next() * (b - a); },
      int: function (a, b) { return Math.floor(a + next() * (b - a + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; }
    };
  };

  /* ---------- Ruído de valor 2D com hash (sem tabela global) ---------- */
  function hash2(x, y, seed) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Ruído de valor suavizado em [0,1]. */
  SV.valueNoise = function (x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = SV.smoothstep(xf), v = SV.smoothstep(yf);
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    var c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return SV.lerp(SV.lerp(a, b, u), SV.lerp(c, d, u), v);
  };

  /** Ruído fractal (várias oitavas) em [0,1]. */
  SV.fbm = function (x, y, octaves, seed) {
    var sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (var i = 0; i < octaves; i++) {
      sum += SV.valueNoise(x * freq, y * freq, seed + i * 977) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };

  /* ---------- Cores ---------- */
  var hexCache = {};
  /** Aceita "#rrggbb", 0xrrggbb ou [r,g,b] e devolve sempre [r,g,b]. */
  SV.hex = function (h) {
    if (Array.isArray(h)) return h;
    if (typeof h === 'number') return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
    var c = hexCache[h];
    if (c) return c;
    var n = parseInt(h.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache[h] = c;
    return c;
  };
  /** Mistura linear de duas cores -> [r,g,b] */
  SV.mix = function (h1, h2, t) {
    var a = SV.hex(h1), b = SV.hex(h2);
    return [SV.round(SV.lerp(a[0], b[0], t)), SV.round(SV.lerp(a[1], b[1], t)), SV.round(SV.lerp(a[2], b[2], t))];
  };
  /** Clareia (+) ou escurece (-) uma cor hex. f em [-1,1]. */
  SV.shade = function (h, f) {
    var a = SV.hex(h);
    if (f >= 0) return [SV.round(SV.lerp(a[0], 255, f)), SV.round(SV.lerp(a[1], 255, f)), SV.round(SV.lerp(a[2], 255, f))];
    var k = 1 + f;
    return [Math.round(a[0] * k), Math.round(a[1] * k), Math.round(a[2] * k)];
  };
  SV.toHex = function (rgb) {
    return '#' + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
  };

  /** Paleta da floresta tropical (base da referência visual). */
  SV.PAL = {
    grassDeep: '#2b4a1e', grassDark: '#375c26', grassMid: '#47762f', grassLight: '#5d9140',
    grassBright: '#79ac52', grassDry: '#7f8a3c',
    mudDark: '#3f2d1d', mud: '#5a4028', mudLight: '#75573a', sand: '#9d8259', sandLight: '#b89b6d',
    waterDeep: '#1f4d5c', waterMid: '#2c6a79', waterShallow: '#4795a0', waterFoam: '#9fd4d4',
    barkDark: '#3a2716', bark: '#54381f', barkMid: '#6d4a29', barkLight: '#8a6238', barkPale: '#a9814f',
    leafDark: '#1d4d22', leaf: '#2a6b2c', leafMid: '#388a38', leafLight: '#4faa48', leafBright: '#6ec459',
    palmDark: '#1f5a35', palm: '#2c7a44', palmLight: '#43a05c',
    stoneDark: '#4e4c48', stone: '#736f68', stoneLight: '#9b968d', stonePale: '#c0bcb2',
    fernDark: '#1c4423', fern: '#2a6a2e', fernLight: '#3f8c3c',
    wood: '#8a5a2b', woodDark: '#5e3c1b', woodLight: '#b07c40',
    fiber: '#c9a86a', fiberDark: '#9c7c45',
    fruitRed: '#c0392b', fruitRedLight: '#e05a45', fruitOrange: '#e08a2c', fruitYellow: '#e8c33c',
    coconut: '#6b4a2b', coconutLight: '#8d6a3f', coconutMilk: '#f0e6d2',
    flesh: '#e0b088', fleshShadow: '#c08a62', hair: '#4a2f1a', hairLight: '#6b452a',
    shirt: '#8a7a5c', shirtDark: '#6a5c44', pants: '#4a5568', pantsDark: '#333c4a',
    pack: '#7a5230', packDark: '#573719', boot: '#3d2b1a',
    metal: '#b9bec6', metalDark: '#7d838c', rock: '#8d939c',
    fire1: '#ffe066', fire2: '#ffb02e', fire3: '#f2601f', fire4: '#a8200d',
    smoke: '#cfd2cc', ember: '#ff8c3a',
    uiPanel: '#16283c', uiPanelEdge: '#0c1725', uiBorder: '#7fc4e8', uiText: '#eaf4fb',
    hp: '#e03a3a', food: '#e08a2c', water: '#3aa8e0', energy: '#e8c81e'
  };
})(window.SV);
