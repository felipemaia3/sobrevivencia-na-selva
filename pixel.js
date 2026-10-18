/*
 * pixel.js — superfície de desenho pixel a pixel (ImageData) usada pelo gerador
 * de arte. Nada aqui conhece Phaser: apenas produz canvais, que depois são
 * registrados como texturas. Isso mantém a arte testável e separada da cena.
 */
(function (SV) {
  'use strict';

  /** Buffer de pixels RGBA com operações de desenho orgânico. */
  function P(w, h) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    this.canvas = cv; this.ctx = ctx;
    this.w = w; this.h = h;
    this.img = ctx.createImageData(w, h);
    this.d = this.img.data;
  }
  SV.P = P;

  P.prototype.clear = function () {
    this.d.fill(0);
    return this;
  };

  /** Grava um pixel sem blend (substitui). */
  P.prototype.set = function (x, y, c, a) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    var i = (y * this.w + x) << 2;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2];
    this.d[i + 3] = (a === undefined ? 255 : a);
    return this;
  };

  /** Lê a cor de um pixel como [r,g,b,a]. */
  P.prototype.get = function (x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    var i = (y * this.w + x) << 2;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  };

  /** Composição "por cima" com alpha 0..1. */
  P.prototype.over = function (x, y, c, al) {
    if (al === undefined) al = 1;
    if (al <= 0) return this;
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    var i = (y * this.w + x) << 2;
    var da = this.d[i + 3] / 255;
    var oa = al + da * (1 - al);
    if (oa <= 0) return this;
    for (var k = 0; k < 3; k++) {
      var src = c[k];
      this.d[i + k] = (src * al + this.d[i + k] * da * (1 - al)) / oa;
    }
    this.d[i + 3] = oa * 255;
    return this;
  };

  /** Multiplica a cor existente (sombras / água sobre o solo). */
  P.prototype.multiply = function (x, y, c, al) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    var i = (y * this.w + x) << 2;
    if (this.d[i + 3] === 0) return this;
    al = al === undefined ? 1 : al;
    this.d[i] += (c[0] * this.d[i] / 255 - this.d[i]) * al;
    this.d[i + 1] += (c[1] * this.d[i + 1] / 255 - this.d[i + 1]) * al;
    this.d[i + 2] += (c[2] * this.d[i + 2] / 255 - this.d[i + 2]) * al;
    return this;
  };

  P.prototype.rect = function (x, y, w, h, c, a) {
    for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) this.set(i, j, c, a);
    return this;
  };

  P.prototype.fill = function (c) { return this.rect(0, 0, this.w, this.h, c); }

  P.prototype.line = function (x0, y0, x1, y1, c, thick, alpha) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy, guard = 0;
    thick = thick || 1;
    while (guard++ < 20000) {
      if (thick <= 1) this.over(x0, y0, c, alpha);
      else this.disc(x0, y0, (thick - 1) / 2, c, alpha);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return this;
  };

  P.prototype.disc = function (cx, cy, r, c, alpha) {
    var r2 = (r + 0.5) * (r + 0.5);
    for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.over(x, y, c, alpha);
      }
    }
    return this;
  };

  /**
   * Mancha orgânica elíptica com borda serrilhada + pontilhado interno.
   * É o "pincel" base de folhas, moitas, sombras e tufos de grama.
   */
  P.prototype.blob = function (cx, cy, rx, ry, c, rnd, opts) {
    opts = opts || {};
    var rough = opts.rough === undefined ? 0.18 : opts.rough;
    var dither = opts.dither === undefined ? 0 : opts.dither;
    var alpha = opts.alpha === undefined ? 1 : opts.alpha;
    var rot = opts.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
    var pad = Math.ceil(Math.max(rx, ry) * (1 + rough)) + 2;
    for (var y = Math.floor(cy - pad); y <= Math.ceil(cy + pad); y++) {
      for (var x = Math.floor(cx - pad); x <= Math.ceil(cx + pad); x++) {
        var dx = (x - cx) * cr + (y - cy) * sr, dy = -(x - cx) * sr + (y - cy) * cr;
        var n = rnd.next() * 2 - 1;
        var e = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        e += n * rough;
        if (e <= 1) {
          if (dither > 0 && rnd.next() < dither) continue;
          this.over(x, y, c, alpha);
        }
      }
    }
    return this;
  };

  /** Clareia/escurece todos os pixels opacos (iluminação global do sprite). */
  P.prototype.tintAll = function (f) {
    for (var i = 0; i < this.d.length; i += 4) {
      if (this.d[i + 3] === 0) continue;
      if (f >= 0) { this.d[i] += (255 - this.d[i]) * f; this.d[i + 1] += (255 - this.d[i + 1]) * f; this.d[i + 2] += (255 - this.d[i + 2]) * f; }
      else { var k = 1 + f; this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k; }
    }
    return this;
  };

  /** Escurece apenas pixels opacos dentro de um círculo (cavidade/sombra). */
  P.prototype.shadeDisc = function (cx, cy, r, c, alpha) {
    for (var y = Math.floor(cy - r); y <= cy + r; y++) for (var x = Math.floor(cx - r); x <= cx + r; x++) {
      if (SV.dist2(x, y, cx, cy) <= r * r) this.multiply(x, y, c, alpha);
    }
    return this;
  };

  /** Contorno de 1px ao redor da silhueta opaca (traço pixel art da referência). */
  P.prototype.outline = function (color, alpha) {
    var c = typeof color === 'string' ? SV.hex(color) : color;
    var add = [];
    for (var y = 0; y < this.h; y++) {
      for (var x = 0; x < this.w; x++) {
        var i = (y * this.w + x) << 2;
        if (this.d[i + 3] > 10) continue;
        var near = false;
        for (var k = 0; k < 4 && !near; k++) {
          var nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0), ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          if (this.d[((ny * this.w + nx) << 2) + 3] > 100) near = true;
        }
        if (near) add.push(x, y);
      }
    }
    for (var j = 0; j < add.length; j += 2) this.over(add[j], add[j + 1], c, alpha === undefined ? 1 : alpha);
    return this;
  };

  /** Copia outro buffer sobre este em (dx,dy). */
  P.prototype.blit = function (other, dx, dy, alpha) {
    for (var y = 0; y < other.h; y++) {
      for (var x = 0; x < other.w; x++) {
        var i = (y * other.w + x) << 2;
        if (other.d[i + 3] === 0) continue;
        this.over(dx + x, dy + y, [other.d[i], other.d[i + 1], other.d[i + 2]], (other.d[i + 3] / 255) * (alpha === undefined ? 1 : alpha));
      }
    }
    return this;
  };

  /** Recorta uma região do buffer em um novo P. */
  P.prototype.crop = function (x, y, w, h) {
    var o = new P(w, h);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var s = this.get(x + i, y + j);
      if (s[3] > 0) o.set(i, j, [s[0], s[1], s[2]], s[3]);
    }
    return o;
  };

  /** Aplica ruído de luminância (textura de solo/casca). */
  P.prototype.grain = function (rnd, amount, maskOnlyOpaque) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var i = (y * this.w + x) << 2;
      if (maskOnlyOpaque && this.d[i + 3] === 0) continue;
      var n = (rnd.next() * 2 - 1) * amount;
      this.d[i] = SV.clamp(this.d[i] + n, 0, 255);
      this.d[i + 1] = SV.clamp(this.d[i + 1] + n, 0, 255);
      this.d[i + 2] = SV.clamp(this.d[i + 2] + n, 0, 255);
    }
    return this;
  };

  P.prototype.flush = function () { this.ctx.putImageData(this.img, 0, 0); return this; };
  P.prototype.toCanvas = function () { this.flush(); return this.canvas; };

  /**
   * Cria um sprite a partir de linhas de texto + paleta de caracteres.
   * '.' e ' ' são transparentes. Ideal para personagem, animais e itens.
   */
  SV.fromRows = function (rows, palette, outlineColor) {
    var w = rows[0].length, h = rows.length;
    var p = new P(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        var c = palette[ch];
        if (!c) continue;
        p.set(x, y, typeof c === 'string' ? SV.hex(c) : c);
      }
    }
    if (outlineColor) p.outline(outlineColor, 0.85);
    return p;
  };
})(window.SV);
