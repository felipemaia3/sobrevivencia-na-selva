/*
 * art_props.js — gerador de terreno e vegetação (pixel art procedural).
 * Produz canvais; a cena apenas os registra como texturas do Phaser.
 */
(function (SV) {
  'use strict';
  var PAL = SV.PAL, Art = SV.Art = SV.Art || {};

  /* ------------------------------------------------------------------ *
   * Helpers de pintura                                                *
   * ------------------------------------------------------------------ */

  /**
   * Campo de ruído pré-computado em baixa resolução + amostragem bilinear.
   * As coordenadas da grade são em espaço de MUNDO, então chunks vizinhos
   * amostram o mesmo ruído e não deixam emenda na fronteira.
   */
  Art.field = function (w, h, step, seed, oct, ox, oy, freq) {
    ox = ox || 0; oy = oy || 0; freq = freq === undefined ? 0.01 : freq;
    var gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2;
    var g = new Float32Array(gw * gh);
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      g[j * gw + i] = SV.fbm((ox + i * step) * freq, (oy + j * step) * freq, oct || 3, seed);
    }
    return function (x, y) {
      var fx = x / step, fy = y / step;
      var xi = Math.floor(fx), yi = Math.floor(fy);
      var tx = SV.smoothstep(fx - xi), ty = SV.smoothstep(fy - yi);
      var a = g[yi * gw + xi], b = g[yi * gw + xi + 1];
      var c = g[(yi + 1) * gw + xi], d = g[(yi + 1) * gw + xi + 1];
      return SV.lerp(SV.lerp(a, b, tx), SV.lerp(c, d, tx), ty);
    };
  };

  /** Traça uma polilinha com espessura variável e cor por parâmetro t. */
  Art.taper = function (p, pts, widthFn, colorFn) {
    var total = 0, segs = [];
    for (var i = 1; i < pts.length; i++) {
      var L = SV.dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      segs.push(L); total += L;
    }
    var acc = 0;
    for (var s = 0; s < segs.length; s++) {
      var a = pts[s], b = pts[s + 1], L = segs[s] || 0.001;
      var steps = Math.max(1, Math.ceil(L * 2));
      for (var k = 0; k < steps; k++) {
        var lt = k / steps;
        var x = SV.lerp(a[0], b[0], lt), y = SV.lerp(a[1], b[1], lt);
        var t = (acc + L * lt) / total;
        var w = widthFn(t);
        p.disc(x, y, w / 2, colorFn(t), 1);
      }
      acc += L;
    }
    return p;
  };

  /** Casca de árvore: faixa vertical com sulhos ondulados e musgo. */
  function barkColor(x, y, seed, moss) {
    var n = SV.fbm(x * 0.22, y * 0.05, 2, seed);
    var c = SV.mix(PAL.barkDark, PAL.barkMid, n);
    if (n > 0.66) c = SV.mix(c, PAL.barkLight, (n - 0.66) * 2.2);
    if (n < 0.3) c = SV.mix(c, PAL.barkDark, (0.3 - n) * 1.6);
    if (moss > 0) {
      var m = SV.fbm(x * 0.13 + 40, y * 0.13, 2, seed + 91);
      if (m > 0.62) c = SV.mix(c, SV.hex(PAL.leaf), (m - 0.62) * 2.4 * moss);
    }
    return c;
  }
  Art.barkColor = barkColor;

  /** Aglomerado de folhagem: várias manchas elípticas em 3 tons + brotos claros. */
  function foliage(p, cx, cy, rx, ry, rnd, tone) {
    tone = tone || 0;
    var dark = SV.mix(PAL.leafDark, PAL.palmDark, tone), mid = SV.mix(PAL.leaf, PAL.palm, tone);
    var light = SV.mix(PAL.leafMid, PAL.palmLight, tone), hi = SV.mix(PAL.leafLight, PAL.leafBright, tone);
    var n = 7 + Math.floor(rnd.next() * 5);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rnd.range(-0.4, 0.4);
      var d = rnd.range(0.25, 0.85);
      p.blob(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d,
        rx * rnd.range(0.45, 0.7), ry * rnd.range(0.45, 0.7), dark, rnd, { rough: 0.28 });
    }
    for (var j = 0; j < n; j++) {
      var a2 = rnd.range(0, Math.PI * 2), d2 = rnd.range(0.1, 0.6);
      p.blob(cx + Math.cos(a2) * rx * d2, cy + Math.sin(a2) * ry * d2 - ry * 0.12,
        rx * rnd.range(0.4, 0.62), ry * rnd.range(0.4, 0.62), mid, rnd, { rough: 0.3 });
    }
    for (var k = 0; k < 5; k++) {
      var a3 = rnd.range(-2.6, -0.4), d3 = rnd.range(0.15, 0.7);
      p.blob(cx + Math.cos(a3) * rx * d3, cy + Math.sin(a3) * ry * d3,
        rx * rnd.range(0.25, 0.45), ry * rnd.range(0.22, 0.4), light, rnd, { rough: 0.34 });
    }
    for (var t = 0; t < 9; t++) {
      var a4 = rnd.range(-2.8, -0.3), d4 = rnd.range(0.1, 0.75);
      p.blob(cx + Math.cos(a4) * rx * d4, cy + Math.sin(a4) * ry * d4,
        rx * rnd.range(0.1, 0.22), ry * rnd.range(0.08, 0.18), hi, rnd, { rough: 0.4, dither: 0.35 });
    }
  }
  Art.foliage = foliage;

  /** Folha composta (samambaia/fronde): nervura + folíolos alternados. */
  function frond(p, x0, y0, x1, y1, width, rnd, colDark, colLight, leaflets) {
    var dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    var nx = -dy / len, ny = dx / len;
    var steps = Math.ceil(len);
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var cx = x0 + dx * t, cy = y0 + dy * t;
      var bell = Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35);
      var w = width * bell;
      p.over(cx, cy, colDark, 1);
      if (w > 0.6) p.over(cx + nx, cy + ny, colDark, 1);
      if (leaflets) {
        var lf = Math.sin(t * Math.PI * (leaflets * 2)) * 0.5 + 0.5;
        if (t > 0.05 && t < 0.98) {
          var sgn = (Math.floor(t * leaflets * 2) % 2) ? 1 : -1;
          for (var q = 0; q < Math.max(1, w); q += 0.5) {
            p.over(cx + nx * sgn * q, cy + ny * sgn * q + q * 0.35, q > w * 0.55 ? colDark : colLight, 1);
            p.over(cx + nx * sgn * q + 0.5, cy + ny * sgn * q + q * 0.35 - 0.5, colLight, 1);
          }
        }
      }
    }
    return p;
  }
  Art.frond = frond;

  /* ------------------------------------------------------------------ *
   * TERRENO: um chunk de chão assado em textura estática              *
   * ------------------------------------------------------------------ */

  /**
   * Pinta o solo de um chunk (grama, lama, areia da margem, água do rio,
   * tufos de grama, folhas caídas e pedrinhas). `shape` vem de world.js e
   * fornece `chunk(ox,oy,size)`: um amostrador rápido e contínuo entre chunks.
   */
  Art.groundChunk = function (size, ox, oy, seed, shape) {
    var p = new SV.P(size, size), rnd = SV.rng(seed ^ (ox * 7919) ^ (oy * 104729));
    var s = shape.chunk(ox, oy, size);
    var fMoist = Art.field(size, size, 25, seed + 11, 3, ox, oy, 0.0045);
    var fTone = Art.field(size, size, 20, seed + 23, 2, ox, oy, 0.0032);
    var fPatch = Art.field(size, size, 40, seed + 37, 3, ox, oy, 0.0018);

    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var q = s(x, y);                    // {water, sand, dirt}
        var m = fMoist(x, y), tn = fTone(x, y), pc = fPatch(x, y);
        var c;
        if (q.water > 0) {
          var wob = Math.sin(((ox + x) * 0.06) + Math.cos((oy + y) * 0.09 + (ox + x) * 0.02) * 2.2) * 0.5 + 0.5;
          var deep = q.water < 1 ? q.water : 1;
          c = SV.mix(PAL.waterShallow, PAL.waterDeep, deep * 0.85);
          c = SV.mix(c, SV.hex(PAL.waterMid), wob * 0.35);
          if (deep < 0.22 && wob > 0.72) c = SV.mix(c, SV.hex(PAL.waterFoam), 0.35);
          if (deep < 0.15) c = SV.mix(c, SV.hex(PAL.mudDark), (0.15 - deep) * 1.6);
        } else {
          var g1 = SV.mix(PAL.grassDark, PAL.grassMid, tn * 0.9 + 0.05);
          g1 = SV.mix(g1, SV.hex(PAL.grassLight), Math.max(0, tn - 0.55) * 1.4);
          if (pc > 0.62) g1 = SV.mix(g1, SV.hex(PAL.grassDeep), (pc - 0.62) * 1.9);      // sombra de copa
          if (pc < 0.34) g1 = SV.mix(g1, SV.hex(PAL.grassBright), (0.34 - pc) * 1.2);    // clareira
          if (m > 0.55) g1 = SV.mix(g1, SV.hex(PAL.mudDark), (m - 0.55) * 0.75);         // solo encharcado
          if (q.sand > 0) g1 = SV.mix(g1, SV.hex(PAL.sand), Math.min(1, q.sand) * 0.85);
          if (q.dirt > 0) g1 = SV.mix(g1, SV.mix(PAL.mud, PAL.mudLight, m), Math.min(1, q.dirt) * 0.62);
          if (q.far) {
            // do outro lado do rio a mata é fechada e sombreada
            g1 = SV.mix(g1, SV.hex(PAL.leafDark), 0.5);
            g1 = SV.mix(g1, SV.hex(PAL.grassDeep), Math.max(0, tn - 0.45) * 0.7);
          }
          var jitter = (rnd.next() - 0.5) * 16;
          c = [SV.clamp(g1[0] + jitter, 0, 255), SV.clamp(g1[1] + jitter, 0, 255), SV.clamp(g1[2] + jitter, 0, 255)];
        }
        p.set(x, y, c);
      }
    }

    // --- detalhes de superfície em grade GLOBAL (continua entre chunks) ---
    var step = 15;
    var i0 = Math.floor(ox / step) - 1, i1 = Math.ceil((ox + size) / step) + 1;
    var j0 = Math.floor(oy / step) - 1, j1 = Math.ceil((oy + size) / step) + 1;
    for (var gj = j0; gj < j1; gj++) {
      for (var gi = i0; gi < i1; gi++) {
        var h = ((gi * 73856093) ^ (gj * 19349663) ^ (seed * 83492791)) >>> 0;
        var rnd2 = SV.rng(h);
        var wx = gi * step + rnd2.range(-step * 0.5, step * 0.5);
        var wy = gj * step + rnd2.range(-step * 0.5, step * 0.5);
        var jx = wx - ox, jy = wy - oy;
        if (jx < -6 || jy < -6 || jx > size + 6 || jy > size + 6) continue;
        var q2 = s(jx, jy);
        if (q2.water > 0) continue;
        var r = rnd2.next();
        if (q2.dirt > 0.35 || q2.sand > 0.35) {
          if (r < 0.30) pebble(p, jx, jy, rnd2);
          else if (r < 0.44) twig(p, jx, jy, rnd2);
        } else if (q2.far) {
          if (r < 0.20) tuft(p, jx, jy, rnd2);
          else if (r < 0.34) leafLitter(p, jx, jy, rnd2);
        } else {
          if (r < 0.34) tuft(p, jx, jy, rnd2);
          else if (r < 0.45) pebble(p, jx, jy, rnd2);
          else if (r < 0.62) leafLitter(p, jx, jy, rnd2);
          else if (r < 0.70) twig(p, jx, jy, rnd2);
        }
      }
    }

    // poças d'água (efeito da chuva): manchas escuras com brilho discreto
    var nPud = rnd.int(2, 5);
    for (var i = 0; i < nPud; i++) {
      var px = rnd.range(20, size - 20), py = rnd.range(20, size - 20);
      if (s(px, py).water > 0) continue;
      var rw = rnd.range(9, 24), rh = rw * rnd.range(0.4, 0.6);
      p.blob(px, py, rw, rh, SV.hex(PAL.waterDeep), rnd, { rough: 0.2, alpha: 0.34 });
      p.blob(px - rw * 0.18, py - rh * 0.28, rw * 0.42, rh * 0.34, SV.hex(PAL.waterFoam), rnd, { rough: 0.32, alpha: 0.13 });
    }
    return p.toCanvas();
  };

  function tuft(p, x, y, rnd) {
    var h = rnd.int(2, 5), n = rnd.int(2, 5);
    var base = rnd.next() < 0.3 ? PAL.grassDry : (rnd.next() < 0.5 ? PAL.grassLight : PAL.grassBright);
    for (var i = 0; i < n; i++) {
      var bx = x + rnd.range(-3, 3), by = y + rnd.range(-1, 1);
      var lean = rnd.range(-2.5, 2.5), hh = h + rnd.range(-1.5, 2);
      p.line(bx, by, bx + lean, by - hh, SV.hex(base), 1, 1);
      p.over(bx + lean, by - hh, SV.hex(PAL.grassBright), 1);
    }
    p.over(x, y + 1, SV.hex(PAL.grassDeep), 1);
  }
  function pebble(p, x, y, rnd) {
    var r = rnd.range(1, 2.4);
    p.disc(x, y, r, SV.hex(PAL.stone), 1);
    p.disc(x - r * 0.3, y - r * 0.35, r * 0.45, SV.hex(PAL.stoneLight), 1);
  }
  function twig(p, x, y, rnd) {
    var a = rnd.range(0, Math.PI), L = rnd.range(4, 9);
    var x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L * 0.5;
    p.line(x, y, x1, y1, SV.hex(PAL.woodDark), 1, 1);
    p.line(x + L * 0.4, y + L * 0.2, x + L * 0.4 + 2, y - 2, SV.hex(PAL.wood), 1, 1);
  }
  function leafLitter(p, x, y, rnd) {
    var c = rnd.next() < 0.5 ? PAL.leafDark : PAL.grassDry;
    p.blob(x, y, rnd.range(1.6, 3), rnd.range(1, 1.8), SV.hex(c), rnd, { rough: 0.4, alpha: 0.8 });
  }

  /* ------------------------------------------------------------------ *
   * ÁGUA ANIMADA                                                        *
   * ------------------------------------------------------------------ */

  /** Frames de ondulação para sobrepor ao rio (3 quadros). */
  Art.waterRipples = function (seed) {
    var out = [];
    for (var f = 0; f < 3; f++) {
      var p = new SV.P(64, 32), rnd = SV.rng(seed + f * 31);
      for (var i = 0; i < 10; i++) {
        var x = rnd.range(4, 60), y = rnd.range(4, 28), w = rnd.range(5, 14);
        var a = 0.18 + 0.14 * Math.sin((i + f * 1.1));
        p.line(x - w / 2, y, x + w / 2, y, SV.hex(PAL.waterFoam), 1, SV.clamp(a, 0.05, 0.4));
        p.over(x - w / 2 - 1, y, SV.hex(PAL.waterFoam), 0.2);
      }
      out.push(p.toCanvas());
    }
    return out;
  };

  /** Nenúfar (vitória-régia) como na referência. */
  Art.lilyPad = function (seed, big) {
    var s = big ? 34 : 24;
    var p = new SV.P(s, s), rnd = SV.rng(seed);
    var c = s / 2;
    p.blob(c, c, c - 2, c - 3, SV.hex(PAL.leaf), rnd, { rough: 0.1 });
    p.blob(c - 1, c - 1, c - 5, c - 6, SV.hex(PAL.leafMid), rnd, { rough: 0.12 });
    // nervuras
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2;
      p.line(c, c, c + Math.cos(a) * (c - 4), c + Math.sin(a) * (c - 4), SV.hex(PAL.leafDark), 1, 0.6);
    }
    // talhe característico do nenúfar
    for (var t = 0; t < 12; t++) p.set(c + t, c - 1 - Math.floor(t * 0.12), [0, 0, 0], 0);
    p.outline('#12331a', 0.7);
    return p.toCanvas();
  };

  /** Taboa / junco na margem. */
  Art.reeds = function (seed) {
    var p = new SV.P(26, 44), rnd = SV.rng(seed);
    for (var i = 0; i < 6; i++) {
      var bx = 6 + i * 3 + rnd.range(-1, 1), lean = rnd.range(-5, 5);
      var h = rnd.range(20, 38);
      Art.taper(p, [[bx, 43], [bx + lean * 0.4, 43 - h * 0.55], [bx + lean, 43 - h]],
        function (t) { return SV.lerp(2.2, 0.4, t); },
        function (t) { return SV.mix(SV.hex(PAL.palmDark), SV.hex(PAL.palmLight), t); });
      if (rnd.chance(0.4)) {
        p.disc(bx + lean, 43 - h - 3, 1.6, SV.hex(PAL.barkMid), 1);
        p.disc(bx + lean, 43 - h - 3, 1.0, SV.hex(PAL.barkDark), 1);
      }
    }
    p.outline('#12331a', 0.5);
    return p.toCanvas();
  };

  /* ------------------------------------------------------------------ *
   * VEGETAÇÃO E OBJETOS DO CENÁRIO                                      *
   * ------------------------------------------------------------------ */

  /**
   * Árvore grande: tronco com raízes tabulares + copa, em duas texturas
   * para que o jogador possa passar por trás do tronco e por baixo da copa.
   */
  Art.tree = function (seed, scale) {
    var rnd = SV.rng(seed);
    scale = scale || 1;
    var W = Math.round(200 * scale), H = Math.round(280 * scale);
    var trunk = new SV.P(W, H), canopy = new SV.P(W, H);
    var baseX = W / 2, baseY = H - 6;
    var trunkH = H * rnd.range(0.5, 0.6);
    var topY = baseY - trunkH;
    var wBase = W * 0.19, wTop = W * 0.075;

    // tronco curvado
    var lean = rnd.range(-6, 6);
    var pts = [[baseX, baseY], [baseX + lean * 0.3, baseY - trunkH * 0.4], [baseX + lean, topY]];
    Art.taper(trunk, pts, function (t) { return SV.lerp(wBase * 2, wTop * 2, t * t); },
      function (t) { return barkColor(baseX + lean * t, topY + (1 - t) * trunkH, seed, 0.5 * (1 - t)); });

    // raízes tabulares (marca registrada da árvore gigante da referência)
    var nRoots = 5 + rnd.int(0, 2);
    for (var i = 0; i < nRoots; i++) {
      var side = (i % 2 === 0) ? -1 : 1;
      var spread = rnd.range(0.28, 0.62);
      var rx0 = baseX + side * wBase * rnd.range(0.1, 0.55);
      var ry0 = baseY - trunkH * rnd.range(0.08, 0.3);
      var rx1 = baseX + side * W * spread * rnd.range(0.55, 1);
      var rootPts = [[rx0, ry0], [(rx0 + rx1) / 2, SV.lerp(ry0, baseY, 0.62)], [rx1, baseY + rnd.range(-1, 2)]];
      Art.taper(trunk, rootPts, function (t) { return SV.lerp(wBase * 0.95, 1.6, SV.smoothstep(t)); },
        function (t) { return barkColor(rx0 + t * 40, ry0 + t * 30, seed + 7, 0.35); });
    }
    // galhos baixos
    for (var b = 0; b < 3; b++) {
      var by = topY + trunkH * rnd.range(0.05, 0.3);
      var dir = rnd.chance(0.5) ? 1 : -1;
      var bl = rnd.range(W * 0.16, W * 0.3);
      Art.taper(trunk, [[baseX + lean * 0.5, by], [baseX + dir * bl * 0.6, by - bl * 0.25], [baseX + dir * bl, by - bl * 0.5]],
        function (t) { return SV.lerp(5 * scale, 1.2, t); },
        function (t) { return barkColor(baseX, by, seed + 3, 0.2); });
    }
    // cipós pendurados
    for (var v = 0; v < 4; v++) {
      var vx = baseX + rnd.range(-W * 0.3, W * 0.3), vy = topY + rnd.range(4, 26);
      var vl = rnd.range(18, 52);
      var vp = [[vx, vy]];
      for (var k = 1; k <= 5; k++) vp.push([vx + Math.sin(k * 1.2 + v) * 4, vy + vl * (k / 5)]);
      Art.taper(trunk, vp, function () { return 1.2; }, function (t) { return SV.mix(SV.hex(PAL.leafDark), SV.hex(PAL.barkMid), t * 0.5); });
    }

    // copa
    var cy = topY - H * 0.06;
    foliage(canopy, baseX + lean, cy, W * 0.44, H * 0.19, rnd, rnd.range(-0.2, 0.5));
    foliage(canopy, baseX + lean - W * 0.22, cy + 14, W * 0.24, H * 0.11, rnd, rnd.range(0, 0.6));
    foliage(canopy, baseX + lean + W * 0.24, cy + 10, W * 0.22, H * 0.1, rnd, rnd.range(0, 0.6));
    // sombra interna sob a copa
    canopy.shadeDisc(baseX + lean, cy + H * 0.12, W * 0.3, SV.hex(PAL.grassDeep), 0.35);

    trunk.outline('#16240f', 0.55);
    canopy.outline('#16240f', 0.5);
    return {
      trunk: trunk.toCanvas(), canopy: canopy.toCanvas(),
      w: W, h: H, trunkW: wBase * 2, topY: topY
    };
  };

  /** Palmeira com tronco curvo, coroa de frondes e cocos. */
  Art.palm = function (seed, scale) {
    var rnd = SV.rng(seed);
    scale = scale || 1;
    var W = Math.round(140 * scale), H = Math.round(190 * scale);
    var trunk = new SV.P(W, H), canopy = new SV.P(W, H);
    var bx = W * 0.5, by = H - 4;
    var bend = rnd.range(-1, 1) * W * 0.16, topX = bx + bend, topY = H * 0.2;
    var pts = [[bx, by], [bx + bend * 0.25, by - (by - topY) * 0.45], [bx + bend * 0.7, by - (by - topY) * 0.8], [topX, topY]];
    Art.taper(trunk, pts, function (t) { return SV.lerp(11 * scale, 5.5 * scale, t); },
      function (t) { return barkColor(bx, by - t * 100, seed + 17, 0.15); });
    // anéis do tronco
    for (var i = 0; i < 14; i++) {
      var t = i / 14;
      var px = SV.lerp(bx, topX, t) + Math.sin(t * 3) * 2, py = SV.lerp(by, topY, t);
      canopy.line(px - 5, py, px + 5, py + 1, SV.hex(PAL.barkDark), 1, 0.35);
    }
    // coroa de frondes
    var nF = 9;
    for (var f = 0; f < nF; f++) {
      var a = -Math.PI * 0.08 - (f / (nF - 1)) * Math.PI * 0.84;
      var len = W * rnd.range(0.34, 0.48);
      var ex = topX + Math.cos(a + Math.PI) * -len * (Math.cos(a) > 0 ? 1 : 1);
      // direção horizontal espelhada, com queda na ponta
      var dirx = Math.cos(a) * len, diry = Math.sin(a) * len * 0.75 + len * 0.3;
      var midx = topX + dirx * 0.55, midy = topY + diry * 0.3 - 6;
      var sp = [[topX, topY], [midx, midy], [topX + dirx, topY + diry]];
      // desenha a fronde em segmentos retos aproximados
      var segs = 26;
      for (var s = 0; s < segs; s++) {
        var tt = s / segs;
        var qx = SV.lerp(SV.lerp(topX, midx, tt), SV.lerp(midx, topX + dirx, tt), tt);
        var qy = SV.lerp(SV.lerp(topY, midy, tt), SV.lerp(midy, topY + diry, tt), tt);
        var nx = s < segs - 1 ? (SV.lerp(SV.lerp(topX, midx, tt + 0.04), SV.lerp(midx, topX + dirx, tt + 0.04), tt + 0.04) - qx) : 1;
        var ny = s < segs - 1 ? (SV.lerp(SV.lerp(topY, midy, tt + 0.04), SV.lerp(midy, topY + diry, tt + 0.04), tt + 0.04) - qy) : 0;
        var L2 = Math.hypot(nx, ny) || 1; nx /= L2; ny /= L2;
        var wdt = Math.sin(Math.PI * Math.min(1, tt * 1.1)) * 7 * scale + 1;
        var col = tt < 0.5 ? PAL.palmDark : (tt < 0.82 ? PAL.palm : PAL.palmLight);
        for (var q = 0; q < wdt; q += 0.8) {
          canopy.over(qx + (-ny) * q, qy + nx * q, SV.hex(col), 1);
          canopy.over(qx - (-ny) * q, qy - nx * q, SV.hex(tt < 0.6 ? PAL.palmDark : PAL.palm), 1);
        }
        canopy.over(qx, qy, SV.hex(PAL.palmLight), 1);
      }
    }
    // cocos
    for (var c = 0; c < 3; c++) {
      var cx = topX + rnd.range(-5, 5), cyy = topY + rnd.range(3, 9);
      canopy.disc(cx, cyy, 3.4 * scale, SV.hex(PAL.coconut), 1);
      canopy.disc(cx - 1, cyy - 1, 1.6 * scale, SV.hex(PAL.coconutLight), 1);
    }
    trunk.outline('#16240f', 0.5);
    canopy.outline('#12331a', 0.45);
    return { trunk: trunk.toCanvas(), canopy: canopy.toCanvas(), w: W, h: H, trunkW: 11 * scale };
  };

  /** Samambaia em roseta. */
  Art.fern = function (seed, scale) {
    var rnd = SV.rng(seed);
    scale = scale || 1;
    var S = Math.round(64 * scale);
    var p = new SV.P(S, S);
    var cx = S / 2, cy = S * 0.86;
    var n = 7 + rnd.int(0, 3);
    for (var i = 0; i < n; i++) {
      var a = Math.PI * (0.06 + (i / (n - 1)) * 0.88) + rnd.range(-0.06, 0.06);
      var len = S * rnd.range(0.34, 0.48);
      var ex = cx - Math.cos(a) * len, ey = cy - Math.sin(a) * len;
      frond(p, cx, cy, ex, ey, 5.5 * scale, rnd, SV.hex(PAL.fernDark), SV.hex(PAL.fernLight), 7);
    }
    p.outline('#12331a', 0.5);
    return p.toCanvas();
  };

  /** Moita folhosa (opcionalmente com frutos vermelhos). */
  Art.bush = function (seed, withFruit) {
    var rnd = SV.rng(seed);
    var W = 62, H = 52;
    var p = new SV.P(W, H);
    foliage(p, W / 2, H * 0.6, W * 0.42, H * 0.36, rnd, rnd.range(-0.1, 0.4));
    if (withFruit) {
      for (var i = 0; i < 6; i++) {
        var bx = rnd.range(10, W - 10), by = rnd.range(12, H - 8);
        p.disc(bx, by, 2, SV.hex(PAL.fruitRed), 1);
        p.disc(bx - 0.6, by - 0.6, 0.8, SV.hex(PAL.fruitRedLight), 1);
      }
    }
    p.outline('#16240f', 0.5);
    return p.toCanvas();
  };

  /** Planta de fibras (touceira seca, como a do chão na referência). */
  Art.fiberPlant = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(34, 30);
    for (var i = 0; i < 9; i++) {
      var a = -Math.PI * 0.5 + rnd.range(-1.1, 1.1);
      var L = rnd.range(9, 16);
      p.line(17, 28, 17 + Math.cos(a) * L, 28 + Math.sin(a) * L, SV.hex(PAL.fiberDark), 1, 1);
      p.line(17, 28, 17 + Math.cos(a) * L * 0.9, 28 + Math.sin(a) * L * 0.9 - 1, SV.hex(PAL.fiber), 1, 1);
    }
    p.outline('#3a2c14', 0.45);
    return p.toCanvas();
  };

  /** Broto / planta de folhas largas. */
  Art.broadleaf = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(36, 34);
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI * 0.5 + (i - 2) * 0.5 + rnd.range(-0.1, 0.1);
      var L = rnd.range(11, 17);
      var ex = 18 + Math.cos(a) * L, ey = 32 + Math.sin(a) * L;
      p.blob((18 + ex) / 2, (32 + ey) / 2, Math.abs(ex - 18) * 0.55 + 3, Math.abs(ey - 32) * 0.5 + 2.5,
        SV.hex(i % 2 ? PAL.leafMid : PAL.leaf), rnd, { rough: 0.2, rot: a });
      p.line(18, 32, ex, ey, SV.hex(PAL.leafDark), 1, 0.9);
    }
    p.outline('#12331a', 0.5);
    return p.toCanvas();
  };

  /** Pedra de tamanho variável com facetas. */
  Art.rock = function (seed, size) {
    var rnd = SV.rng(seed);
    var W = Math.round(size), H = Math.round(size * rnd.range(0.7, 0.85));
    var p = new SV.P(W, H);
    p.blob(W / 2, H * 0.6, W * 0.44, H * 0.42, SV.hex(PAL.stone), rnd, { rough: 0.12 });
    p.blob(W / 2 - W * 0.1, H * 0.45, W * 0.3, H * 0.26, SV.hex(PAL.stoneLight), rnd, { rough: 0.16 });
    p.blob(W / 2 + W * 0.12, H * 0.72, W * 0.26, H * 0.18, SV.hex(PAL.stoneDark), rnd, { rough: 0.2, alpha: 0.8 });
    // musgo no topo
    p.blob(W * 0.4, H * 0.3, W * 0.2, H * 0.1, SV.hex(PAL.leaf), rnd, { rough: 0.35, dither: 0.4 });
    p.outline('#2b2b28', 0.6);
    return p.toCanvas();
  };

  /** Tronco caído no chão (recurso de madeira). */
  Art.log = function (seed) {
    var rnd = SV.rng(seed);
    var W = 96, H = 34;
    var p = new SV.P(W, H);
    var cy = H * 0.6;
    for (var x = 6; x < W - 10; x++) {
      var rr = 10 + Math.sin(x * 0.25) * 1.2;
      for (var y = cy - rr; y <= cy + rr * 0.75; y++) p.over(x, y, barkColor(x, y, seed + 51, 0.4), 1);
    }
    // corte transversal na ponta direita, com anéis de crescimento
    var ex = W - 12;
    p.disc(ex, cy, 9.5, SV.hex(PAL.woodLight), 1);
    for (var r = 2; r < 9; r += 2.4) p.disc(ex, cy, r, SV.hex(PAL.wood), 1);
    p.disc(ex, cy, 1.6, SV.hex(PAL.barkMid), 1);
    p.outline('#241708', 0.6);
    // musgo
    for (var m = 0; m < 5; m++) p.blob(rnd.range(12, W - 24), cy - rnd.range(4, 9), rnd.range(5, 11), 3, SV.hex(PAL.leafMid), rnd, { rough: 0.4, dither: 0.3 });
    return p.toCanvas();
  };

  /** Montinho de galhos no chão. */
  Art.branchPile = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(40, 22);
    for (var i = 0; i < 7; i++) {
      var a = rnd.range(-0.5, 0.5), L = rnd.range(10, 19);
      var x0 = 20 - Math.cos(a) * L / 2, y0 = 14 + Math.sin(a) * 3 - i * 0.6;
      p.line(x0, y0, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L * 0.5, SV.hex(i % 2 ? PAL.wood : PAL.woodDark), 2, 1);
      p.line(x0, y0 - 1, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L * 0.5 - 1, SV.hex(PAL.woodLight), 1, 0.8);
    }
    p.outline('#241708', 0.5);
    return p.toCanvas();
  };

  /** Pedras pequenas coletáveis. */
  Art.stonePile = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(26, 18);
    p.disc(9, 11, 5, SV.hex(PAL.stone), 1); p.disc(8, 9, 2, SV.hex(PAL.stoneLight), 1);
    p.disc(18, 12, 4, SV.hex(PAL.stoneDark), 1); p.disc(17, 10, 1.6, SV.hex(PAL.stoneLight), 1);
    p.disc(13, 7, 2.6, SV.hex(PAL.stone), 1);
    p.outline('#2b2b28', 0.6);
    return p.toCanvas();
  };

  /** Arbusto de frutas (manga/coco vermelho) no chão. */
  Art.fruitCluster = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(24, 20);
    p.blob(12, 14, 9, 5, SV.hex(PAL.leafDark), rnd, { rough: 0.3, alpha: 0.9 });
    var cols = [PAL.fruitRed, PAL.fruitOrange, PAL.fruitYellow];
    for (var i = 0; i < 3; i++) {
      var x = 7 + i * 5 + rnd.range(-1, 1), y = 10 + rnd.range(-2, 2);
      p.disc(x, y, 4, SV.hex(cols[i]), 1);
      p.disc(x - 1.2, y - 1.2, 1.4, SV.hex('#ffffff'), 0.35);
      p.line(x, y - 4, x + 1, y - 6, SV.hex(PAL.leaf), 1, 1);
    }
    p.outline('#2b1a08', 0.55);
    return p.toCanvas();
  };

  /** Coco caído. */
  Art.coconutItem = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(18, 16);
    p.disc(9, 9, 6.5, SV.hex(PAL.coconut), 1);
    p.blob(7, 6, 3.5, 2.6, SV.hex(PAL.coconutLight), rnd, { rough: 0.25 });
    p.over(6, 8, SV.hex(PAL.barkDark), 1); p.over(9, 7, SV.hex(PAL.barkDark), 1); p.over(11, 10, SV.hex(PAL.barkDark), 1);
    p.outline('#241708', 0.6);
    return p.toCanvas();
  };

  /** Cogumelos (recurso secundário). */
  Art.mushrooms = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(22, 18);
    for (var i = 0; i < 3; i++) {
      var x = 5 + i * 6 + rnd.range(-1, 1), h = rnd.range(5, 9);
      p.line(x, 17, x, 17 - h, SV.hex('#e8ddc8'), 2, 1);
      p.disc(x, 17 - h, 3.4, SV.hex('#b3552e'), 1);
      p.disc(x - 1, 17 - h - 1, 1.2, SV.hex('#e8b58e'), 1);
    }
    p.outline('#2b1a08', 0.5);
    return p.toCanvas();
  };

  /** Cupinzeiro / moita de planta tropical alta. */
  Art.tallPlant = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(46, 62);
    Art.taper(p, [[23, 61], [22, 38], [23, 20]], function (t) { return SV.lerp(4, 1.4, t); },
      function () { return SV.hex(PAL.palmDark); });
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI * 0.5 + (i - 2.5) * 0.52;
      var L = rnd.range(14, 24);
      frond(p, 23, 22 + i * 2, 23 + Math.cos(a) * L, 22 + i * 2 + Math.sin(a) * L * 0.8, 5, rnd, SV.hex(PAL.fernDark), SV.hex(PAL.fernLight), 5);
    }
    p.disc(23, 16, 3, SV.hex(PAL.fruitRed), 1);
    p.outline('#12331a', 0.5);
    return p.toCanvas();
  };

  /** Abrigo A-frame de madeira e folhas (construção). */
  Art.shelter = function (seed) {
    var rnd = SV.rng(seed);
    var W = 116, H = 86;
    var p = new SV.P(W, H);
    // estrutura de estacas
    var apexX = W * 0.5, apexY = 8;
    for (var i = 0; i < 7; i++) {
      var t = i / 6;
      var lx = SV.lerp(10, W - 10, t);
      p.line(lx, H - 4, apexX + (lx - apexX) * 0.12, apexY + 4, SV.hex(PAL.woodDark), 3, 1);
      p.line(lx - 1, H - 4, apexX + (lx - apexX) * 0.12 - 1, apexY + 4, SV.hex(PAL.woodLight), 1, 0.7);
    }
    p.line(10, H - 4, apexX, apexY, SV.hex(PAL.wood), 4, 1);
    p.line(W - 10, H - 4, apexX, apexY, SV.hex(PAL.wood), 4, 1);
    // cobertura de folhas de palmeira
    for (var r = 0; r < 6; r++) {
      var yy = SV.lerp(apexY + 10, H - 12, r / 5);
      var halfW = SV.lerp(12, W * 0.46, r / 5);
      for (var s = 0; s < 9; s++) {
        var sx = apexX - halfW + (s / 8) * halfW * 2;
        p.blob(sx, yy + rnd.range(-2, 2), 9, 5, SV.hex(r % 2 ? PAL.palm : PAL.palmDark), rnd, { rough: 0.3 });
        p.blob(sx - 2, yy - 2, 6, 3, SV.hex(PAL.palmLight), rnd, { rough: 0.35, dither: 0.25 });
      }
    }
    p.outline('#16240f', 0.55);
    return p.toCanvas();
  };

  /** Base da fogueira: anel de pedras + lenha. */
  Art.firePit = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(56, 34);
    for (var i = 0; i < 9; i++) {
      var a = (i / 9) * Math.PI * 2;
      var x = 28 + Math.cos(a) * 22, y = 22 + Math.sin(a) * 9;
      p.disc(x, y, rnd.range(3.4, 5), SV.hex(i % 2 ? PAL.stone : PAL.stoneDark), 1);
      p.disc(x - 1, y - 1.4, 1.8, SV.hex(PAL.stoneLight), 0.9);
    }
    // solo queimado
    p.blob(28, 22, 17, 7, SV.hex(PAL.mudDark), rnd, { rough: 0.2, alpha: 0.75 });
    // lenha cruzada
    p.line(14, 26, 42, 18, SV.hex(PAL.woodDark), 4, 1);
    p.line(14, 26, 42, 18, SV.hex(PAL.wood), 2, 1);
    p.line(42, 26, 14, 18, SV.hex(PAL.woodDark), 4, 1);
    p.line(42, 26, 14, 18, SV.hex(PAL.woodLight), 2, 1);
    p.outline('#1a1207', 0.5);
    return p.toCanvas();
  };

  /**
   * Telhado da fogueira: estacas altas e um dossel de folhas de palmeira,
   * apoiado acima da chama. O meio fica aberto (transparente) para o fogo
   * aparecer por baixo.
   */
  Art.fireCover = function (seed) {
    var rnd = SV.rng(seed);
    var W = 96, H = 108;
    var p = new SV.P(W, H);
    var apexX = W * 0.5, apexY = 8, eaveY = 50, footY = H - 3;
    // estacas laterais, cravadas no chão ao redor do anel de pedras
    [[10, 1], [W - 10, -1]].forEach(function (post) {
      p.line(post[0], footY, post[0] + post[1] * 2, eaveY - 2, SV.hex(PAL.woodDark), 3.6, 1);
      p.line(post[0] - 1, footY, post[0] - 1 + post[1] * 2, eaveY - 2, SV.hex(PAL.woodLight), 1.2, 0.8);
    });
    // travessa que segura o dossel
    p.line(8, eaveY - 1, W - 8, eaveY - 1, SV.hex(PAL.barkMid), 2.4, 1);
    p.line(8, eaveY - 3, W - 8, eaveY - 3, SV.hex(PAL.barkPale), 1, 0.7);
    // amarrações de fibra nos nós
    for (var n = 0; n < 2; n++) {
      var nx = n ? W - 10 : 10;
      p.line(nx - 3, eaveY - 6, nx + 3, eaveY - 3, SV.hex(PAL.fiberDark), 1.4, 1);
      p.line(nx - 3, eaveY + 1, nx + 3, eaveY + 4, SV.hex(PAL.fiber), 1.2, 1);
    }
    // escada de mão encostada: o fogo continua acessível por baixo
    p.line(20, footY, 26, eaveY + 6, SV.hex(PAL.woodDark), 1.6, 1);
    p.line(34, footY, 30, eaveY + 6, SV.hex(PAL.woodDark), 1.6, 1);
    for (var rung = 0; rung < 5; rung++) {
      var ry = SV.lerp(footY - 3, eaveY + 8, rung / 4);
      p.line(SV.lerp(21, 27, rung / 4), ry, SV.lerp(33, 29, rung / 4), ry, SV.hex(PAL.wood), 1.4, 1);
    }
    // dossel: folhas caídas em fiadas, do topo para as beiradas
    for (var r = 0; r < 6; r++) {
      var t = r / 5;
      var yy = SV.lerp(apexY + 4, eaveY - 3, t);
      var halfW = SV.lerp(9, W * 0.47, t);
      for (var s = 0; s < 8; s++) {
        var sx = apexX - halfW + (s / 7) * halfW * 2;
        p.blob(sx, yy + rnd.range(-1.4, 1.8), 8, 4.4, SV.hex(r % 2 ? PAL.palm : PAL.palmDark), rnd, { rough: 0.28 });
        p.blob(sx - 1.5, yy - 1.6, 5, 2.4, SV.hex(PAL.palmLight), rnd, { rough: 0.3, dither: 0.28 });
      }
    }
    // cumeeira e beirada desfiada
    for (var side = -1; side <= 1; side += 2) {
      p.line(apexX, apexY, apexX + side * (W * 0.46), eaveY - 2, SV.hex(PAL.woodDark), 2, 1);
      for (var d = 0; d < 8; d++) {
        var dt = d / 7;
        p.blob(apexX + side * (W * 0.46) * dt, eaveY - 2 + SV.lerp(-2, 6, dt) + rnd.range(-1, 1.6),
          4, 3, SV.hex(d % 2 ? PAL.palmDark : PAL.fern), rnd, { rough: 0.35, dither: 0.35 });
      }
    }
    p.blob(apexX, apexY, 6, 4, SV.hex(PAL.palmLight), rnd, { rough: 0.3 });
    p.outline('#16240f', 0.55);
    return p.toCanvas();
  };

  /** 5 quadros de chama (animação contínua). */
  Art.flame = function (frame) {
    var rnd = SV.rng(1000 + frame * 77);
    var W = 44, H = 46;
    var p = new SV.P(W, H);
    var cx = W / 2, base = H - 2;
    var hgt = 30 + Math.sin(frame * 1.7) * 5;
    // corpo externo laranja
    for (var i = 0; i < 5; i++) {
      var ox = (i - 2) * 5 + Math.sin(frame * 1.3 + i) * 2.5;
      var hh = hgt * (1 - Math.abs(i - 2) * 0.22) * rnd.range(0.85, 1.1);
      p.blob(cx + ox, base - hh * 0.42, 7 - Math.abs(i - 2) * 1.2, hh * 0.5, SV.hex(PAL.fire3), rnd, { rough: 0.28 });
    }
    p.blob(cx, base - hgt * 0.35, 10, hgt * 0.45, SV.hex(PAL.fire2), rnd, { rough: 0.25 });
    p.blob(cx + Math.sin(frame) * 2, base - hgt * 0.3, 6.5, hgt * 0.34, SV.hex(PAL.fire1), rnd, { rough: 0.28 });
    p.blob(cx, base - hgt * 0.16, 8, hgt * 0.2, SV.hex('#fff3c4'), rnd, { rough: 0.2, dither: 0.2 });
    // faíscas
    for (var s = 0; s < 4; s++) {
      p.over(cx + rnd.range(-9, 9), base - hgt - rnd.range(2, 9), SV.hex(PAL.ember), 0.9);
    }
    p.outline('#5a1a05', 0.28);
    return p.toCanvas();
  };

  /** Fumaça: mancha suave dithered. */
  Art.smoke = function (seed) {
    var rnd = SV.rng(seed);
    var p = new SV.P(34, 34);
    p.blob(17, 17, 12, 10, SV.hex(PAL.smoke), rnd, { rough: 0.3, dither: 0.45, alpha: 0.5 });
    p.blob(15, 14, 7, 6, SV.hex('#eef0ea'), rnd, { rough: 0.3, dither: 0.5, alpha: 0.4 });
    return p.toCanvas();
  };

  /** Sombra elíptica suave usada sob objetos e personagens. */
  Art.shadow = function (w, h) {
    var p = new SV.P(w, h), rnd = SV.rng(7);
    for (var l = 0; l < 4; l++) {
      p.blob(w / 2, h / 2, (w / 2) * (1 - l * 0.16), (h / 2) * (1 - l * 0.16), [0, 0, 0], rnd,
        { rough: 0.12, dither: 0.25 + l * 0.2, alpha: 0.13 });
    }
    return p.toCanvas();
  };
})(window.SV);
