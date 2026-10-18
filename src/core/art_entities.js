/*
 * art_entities.js — personagem, animais, ferramentas e ícones da interface.
 * Tudo é desenhado pixel a pixel em tempo de boot (nenhum arquivo externo).
 */
(function (SV) {
  'use strict';
  var PAL = SV.PAL, Art = SV.Art;

  var INK = '#1a1208';

  /* ------------------------------------------------------------------ *
   * PERSONAGEM: boneco articulado desenhado por partes                 *
   * ------------------------------------------------------------------ */

  /**
   * @param {string} dir  'down' (frente), 'up' (costas), 'side' (perfil)
   * @param {number} phase 0..1 fase do ciclo de passada
   * @param {string} act   'idle' | 'walk' | 'run' | 'attack' | 'chop' | 'eat' | 'hurt'
   * @param {number} seed  variação da cor de pele/cabelo
   */
  Art.playerFrame = function (dir, phase, act, seed) {
    var rnd = SV.rng(4242 + (seed || 0));
    var W = 24, H = 32;
    var p = new SV.P(W, H);
    var cx = 12, hipY = 20, headY = 8.5;
    var moving = act === 'walk' || act === 'run';
    var amp = act === 'run' ? 4.2 : (moving ? 2.6 : 0);
    var bob = moving ? Math.abs(Math.sin(phase * Math.PI * 2)) * (act === 'run' ? 1.6 : 0.9) : 0;
    hipY -= bob; headY -= bob;

    var skin = SV.hex(PAL.flesh), skinSh = SV.hex(PAL.fleshShadow);
    var hairC = SV.hex(PAL.hair), hairL = SV.hex(PAL.hairLight);
    var shirt = SV.hex(PAL.shirt), shirtD = SV.hex(PAL.shirtDark);
    var pants = SV.hex(PAL.pants), pantsD = SV.hex(PAL.pantsDark);
    var boot = SV.hex(PAL.boot), pack = SV.hex(PAL.pack), packD = SV.hex(PAL.packDark);

    function limb(x0, y0, x1, y1, x2, y2, w0, w1, col, colDark) {
      var pts = [[x0, y0], [x1, y1], [x2, y2]];
      Art.taper(p, pts, function (t) { return SV.lerp(w0, w1, t); }, function (t) { return t > 0.75 ? colDark : col; });
    }

    var swing = Math.sin(phase * Math.PI * 2) * amp;
    var lift = Math.max(0, Math.sin(phase * Math.PI * 2)) * (moving ? 2 : 0);
    var liftB = Math.max(0, -Math.sin(phase * Math.PI * 2)) * (moving ? 2 : 0);

    // ---- pernas ----
    var legL = { x: cx - 3 + swing * (dir === 'side' ? 0.2 : 1), y: H - 3 - lift, k: hipY + 2 };
    var legR = { x: cx + 3 - swing * (dir === 'side' ? 0.2 : 1), y: H - 3 - liftB, k: hipY + 2 };
    if (dir === 'side') { legL.x = cx - swing * 1.1; legR.x = cx + swing * 1.1; }

    function drawLeg(l, back) {
      var kneeX = (cx + l.x) / 2 + (dir === 'side' ? swing * 0.3 : 0);
      limb(cx + (back ? -1 : 1) * (dir === 'side' ? 0 : 1.6), hipY, kneeX, (hipY + l.y) / 2, l.x, l.y,
        4.4, 3.2, back ? pantsD : pants, back ? SV.mix(PAL.pantsDark, PAL.boot, 0.4) : pantsD);
      p.disc(l.x, l.y - 0.4, 2.1, boot, 1);
      p.rect(l.x - 2.4, l.y - 1.4, 5, 2.6, boot);
      p.over(l.x + 2, l.y - 1, SV.mix(PAL.boot, PAL.barkLight, 0.3), 1);
    }
    drawLeg(legL, true);

    // ---- mochila (atravessa as costas) ----
    if (dir === 'up') {
      p.blob(cx, hipY - 4.5, 6.4, 6.6, pack, rnd, { rough: 0.1 });
      p.blob(cx, hipY - 6, 5, 4, SV.mix(PAL.pack, PAL.barkLight, 0.35), rnd, { rough: 0.12 });
      p.rect(cx - 5, hipY - 2, 10, 2, packD);
      p.line(cx, hipY - 10, cx, hipY + 1, packD, 1, 1);
      // cantil + galhos saindo da mochila
      p.disc(cx + 5, hipY - 6, 2.2, SV.hex(PAL.stoneLight), 1);
      limb(cx - 4, hipY - 9, cx - 7, hipY - 14, cx - 6, hipY - 17, 1.6, 0.8, SV.hex(PAL.wood), SV.hex(PAL.woodDark));
    } else {
      p.blob(cx - 6.2, hipY - 4.5, 2.6, 5.2, packD, rnd, { rough: 0.12 });
      p.blob(cx + 6.2, hipY - 4.5, 2.6, 5.2, packD, rnd, { rough: 0.12 });
    }

    // ---- tronco ----
    p.rect(cx - 4.6, hipY - 9.6, 9.2, 10.2, shirt);
    p.blob(cx, hipY - 5, 5.2, 5.4, shirt, rnd, { rough: 0.06 });
    p.rect(cx - 4.6, hipY - 1.6, 9.2, 2, SV.hex(PAL.barkDark));           // cinto
    p.rect(cx - 1, hipY - 1.6, 2, 2, SV.hex(PAL.fiber));                    // fivela
    p.line(cx - 1.5, hipY - 9.6, cx - 2.5, hipY - 2, SV.hex(PAL.shirtDark), 1, 0.8);
    p.line(cx + 1.5, hipY - 9.6, cx + 2.5, hipY - 2, SV.hex(PAL.shirtDark), 1, 0.8);
    // alças da mochila na frente
    if (dir !== 'up') {
      p.line(cx - 2.6, hipY - 9.4, cx - 3.4, hipY - 2, packD, 1.6, 1);
      p.line(cx + 2.6, hipY - 9.4, cx + 3.4, hipY - 2, packD, 1.6, 1);
    }

    // ---- braços ----
    var shY = hipY - 8.4;
    var armSwing = swing * 0.9;
    var handN = { x: cx, y: hipY - 1 }, handF = { x: cx, y: hipY - 1 };

    if (act === 'attack' || act === 'chop') {
      // braço da frente erguido/cortando; fase 0 = levantamento, 1 = golpe
      var t = phase;
      var ang = act === 'chop' ? SV.lerp(-2.3, -0.2, SV.smoothstep(t)) : SV.lerp(-2.0, 0.5, SV.smoothstep(t));
      var L = 8.5;
      var hx = cx + (dir === 'up' ? 5 : dir === 'side' ? Math.cos(ang) * L : Math.cos(ang) * L * 0.55);
      var hy = shY + (dir === 'up' ? -Math.sin(Math.abs(ang)) * 2 : Math.sin(ang) * L);
      if (dir === 'down') { hx = cx + 5.5; hy = shY - 2 + t * 6; }
      handN = { x: hx, y: hy };
      handF = { x: cx - (dir === 'side' ? 4 : 3), y: hipY - 2 };
    } else if (act === 'eat') {
      handN = { x: cx + (dir === 'side' ? 3 : 2.5), y: headY + 3 };
      handF = { x: cx - 4, y: hipY - 2 };
    } else if (act === 'hurt') {
      handN = { x: cx + 6, y: shY - 2 }; handF = { x: cx - 6, y: shY - 2 };
    } else {
      handN = { x: cx + (dir === 'side' ? 4.5 - armSwing : 4.4), y: hipY - 1.4 + (moving ? -armSwing * 0.8 : 0) };
      handF = { x: cx - (dir === 'side' ? 4.5 + armSwing : 4.4), y: hipY - 1.4 + (moving ? armSwing * 0.8 : 0) };
    }

    function drawArm(sx, sy, hx, hy, back) {
      var mx = (sx + hx) / 2, my = (sy + hy) / 2 + 1.6;
      limb(sx, sy, mx, my, hx, hy, 3.6, 2.6, back ? shirtD : shirt, back ? SV.mix(PAL.shirtDark, PAL.fleshShadow, 0.4) : skinSh);
      p.disc(hx, hy, 1.9, back ? skinSh : skin, 1);
    }
    drawArm(cx - (dir === 'side' ? 1 : 4), shY, handF.x, handF.y, true);

    // ---- cabeça ----
    var hx0 = cx + (dir === 'side' ? -0.5 : 0);
    p.disc(hx0, headY, 5.6, skin, 1);
    p.blob(hx0, headY + 1.2, 5.4, 5, skin, rnd, { rough: 0.05 });
    if (dir === 'side') {
      p.rect(hx0 - 6, headY - 1, 3, 2, skin); // nariz
      p.over(hx0 + 3.4, headY + 0.5, skinSh, 1);
    }
    // cabelo: calota + mechas arrepiadas (igual à referência)
    p.blob(hx0, headY - 1.6, 6.3, 5.4, hairC, rnd, { rough: 0.14 });
    p.blob(hx0 - 0.5, headY - 2.6, 5.4, 4, hairL, rnd, { rough: 0.2, dither: 0.35 });
    for (var s = 0; s < 7; s++) {
      var a = Math.PI * (1.05 + (s / 6) * 0.95);
      var rx = hx0 + Math.cos(a) * 6.2, ry = headY - 1 + Math.sin(a) * 5.2;
      p.blob(rx, ry, 2.2, 1.8, hairC, rnd, { rough: 0.3 });
    }
    // mechas laterais e nuca
    p.blob(hx0 - 5.4, headY + 1.5, 2, 3.4, hairC, rnd, { rough: 0.2 });
    p.blob(hx0 + 5.4, headY + 1.5, 2, 3.4, hairC, rnd, { rough: 0.2 });
    if (dir === 'up') p.blob(hx0, headY + 1, 5.6, 4.6, hairC, rnd, { rough: 0.16 });

    // rosto
    if (dir === 'down') {
      p.rect(hx0 - 3, headY + 1.2, 2, 2.4, SV.hex(INK));
      p.rect(hx0 + 1.4, headY + 1.2, 2, 2.4, SV.hex(INK));
      p.over(hx0 - 2.4, headY + 1.6, [255, 255, 255], 0.7);
      p.over(hx0 + 2, headY + 1.6, [255, 255, 255], 0.7);
      p.over(hx0, headY + 4.4, SV.hex(PAL.fleshShadow), 1);
      if (act === 'hurt') { p.rect(hx0 - 2.4, headY + 4, 5, 1.6, SV.hex('#7a2a20')); }
      p.blob(hx0 - 4, headY + 3, 1.6, 1.1, SV.hex('#d88f78'), rnd, { rough: 0.3, alpha: 0.6 });
      p.blob(hx0 + 4, headY + 3, 1.6, 1.1, SV.hex('#d88f78'), rnd, { rough: 0.3, alpha: 0.6 });
    } else if (dir === 'side') {
      var fx = hx0 + 3.4;
      p.rect(fx - 1, headY + 1.2, 2, 2.2, SV.hex(INK));
      p.over(fx - 0.4, headY + 1.6, [255, 255, 255], 0.7);
      p.over(hx0 + 4.6, headY + 3.4, SV.hex(PAL.fleshShadow), 1);
    }

    drawArm(cx + (dir === 'side' ? 1 : 4), shY, handN.x, handN.y, false);
    drawLeg(legR, false);

    p.outline(INK, 0.9);
    return { canvas: p.toCanvas(), hand: [Math.round(handN.x), Math.round(handN.y)] };
  };

  /* ------------------------------------------------------------------ *
   * FERRAMENTAS E MATERIAIS                                             *
   * ------------------------------------------------------------------ */

  /** Machado de pedra / lança / porrete: desenhados na vertical, cabo embaixo. */
  Art.tool = function (kind) {
    var rnd = SV.rng(kind.length * 977 + 3);
    var p = new SV.P(22, 26);
    var cx = 11;
    function handle() {
      Art.taper(p, [[cx, 25], [cx - 0.5, 16], [cx - 1, 8]], function (t) { return SV.lerp(2.6, 2, t); },
        function (t) { return SV.mix(SV.hex(PAL.woodDark), SV.hex(PAL.woodLight), 0.35 + t * 0.3); });
      // fibras de amarração
      for (var i = 0; i < 3; i++) p.line(cx - 2.4, 9 + i, cx + 1.4, 9.6 + i, SV.hex(PAL.fiberDark), 1, 1);
    }
    if (kind === 'axe') {
      handle();
      // pedra lascada
      p.blob(cx - 3.5, 5.5, 5.2, 4.4, SV.hex(PAL.rock), rnd, { rough: 0.16 });
      p.blob(cx - 4.5, 4.5, 3, 2.4, SV.hex(PAL.metal), rnd, { rough: 0.2, alpha: 0.55 });
      p.line(cx + 1.2, 2.5, cx + 2.4, 8.5, SV.hex(PAL.stoneDark), 1.6, 1);
      p.line(cx - 8.5, 4, cx - 3, 8.6, SV.hex(PAL.stoneDark), 1.2, 0.8);
      for (var i = 0; i < 4; i++) p.over(cx - 6 + i * 2, 8.4 + (i % 2), SV.hex(PAL.stonePale), 1);
      p.line(cx - 2.6, 8.6, cx + 0.6, 9.2, SV.hex(PAL.fiber), 1.6, 1);
    } else if (kind === 'spear') {
      Art.taper(p, [[cx, 25], [cx, 12], [cx, 4]], function (t) { return SV.lerp(2.4, 1.6, t); },
        function (t) { return SV.mix(SV.hex(PAL.woodDark), SV.hex(PAL.woodLight), t); });
      p.blob(cx, 3.2, 2.6, 4, SV.hex(PAL.stonePale), rnd, { rough: 0.1 });
      p.line(cx, 0.5, cx, 6.5, SV.hex(PAL.stoneDark), 1, 0.7);
      p.line(cx - 2, 6.6, cx + 2, 7.4, SV.hex(PAL.fiberDark), 1.4, 1);
      p.line(cx - 1.6, 8, cx + 1.8, 8.8, SV.hex(PAL.fiber), 1.2, 1);
    } else if (kind === 'torch') {
      Art.taper(p, [[cx, 25], [cx, 14], [cx, 8]], function (t) { return SV.lerp(2.6, 2, t); },
        function (t) { return SV.mix(SV.hex(PAL.woodDark), SV.hex(PAL.woodLight), t); });
      p.blob(cx, 6, 3.4, 3.4, SV.hex(PAL.barkDark), rnd, { rough: 0.2 });
      p.blob(cx, 4.5, 2.8, 3.6, SV.hex(PAL.fire3), rnd, { rough: 0.25 });
      p.blob(cx, 4, 1.8, 2.6, SV.hex(PAL.fire2), rnd, { rough: 0.25 });
      p.blob(cx, 3.6, 1, 1.6, SV.hex(PAL.fire1), rnd, { rough: 0.2 });
    } else { // 'stick' / 'rock' / 'hammer'
      handle();
    }
    p.outline(INK, 0.85);
    return p.toCanvas();
  };

  /** Ícone de item (16x16) para hotbar, inventário e receitas. */
  Art.icon = function (kind) {
    var rnd = SV.rng((kind.charCodeAt(0) << 3) + kind.length * 31 + 7);
    var p = new SV.P(16, 16), c = 8;
    switch (kind) {
      case 'wood':
        p.line(2, 13, 13, 3, SV.hex(PAL.woodDark), 5, 1);
        p.line(2.5, 12.5, 13, 3.5, SV.hex(PAL.wood), 3, 1);
        p.disc(13, 3.5, 2.2, SV.hex(PAL.woodLight), 1);
        p.disc(13, 3.5, 1.1, SV.hex(PAL.barkMid), 1);
        break;
      case 'branch':
        p.line(2, 13, 13, 3, SV.hex(PAL.woodDark), 2, 1);
        p.line(6, 9, 9, 5, SV.hex(PAL.wood), 1.4, 1);
        p.line(9, 12, 13, 11, SV.hex(PAL.woodLight), 1.2, 1);
        break;
      case 'stone':
        p.blob(c, 9, 6, 4.6, SV.hex(PAL.stone), rnd, { rough: 0.12 });
        p.blob(c - 1.5, 7.5, 3.4, 2.6, SV.hex(PAL.stoneLight), rnd, { rough: 0.16 });
        p.blob(c + 2, 11, 2.6, 1.6, SV.hex(PAL.stoneDark), rnd, { rough: 0.2, alpha: 0.8 });
        break;
      case 'fiber':
        for (var i = 0; i < 6; i++) {
          var a = -1.9 + i * 0.42;
          p.line(8, 15, 8 + Math.cos(a) * 10, 15 + Math.sin(a) * 11, SV.hex(PAL.fiberDark), 1.4, 1);
          p.line(8, 15, 8 + Math.cos(a) * 9, 15 + Math.sin(a) * 10, SV.hex(PAL.fiber), 1, 1);
        }
        p.line(4, 14, 12, 14, SV.hex(PAL.fiberDark), 1.6, 1);
        break;
      case 'fruit':
        p.disc(6, 9, 4.2, SV.hex(PAL.fruitRed), 1); p.disc(5, 7.6, 1.5, SV.hex(PAL.fruitRedLight), 1);
        p.disc(11, 10, 3.4, SV.hex(PAL.fruitOrange), 1); p.disc(10, 8.8, 1.2, SV.hex(PAL.fruitYellow), 1);
        p.line(6, 5, 7, 2.5, SV.hex(PAL.barkMid), 1.2, 1);
        p.blob(9, 3, 2.6, 1.4, SV.hex(PAL.leafMid), rnd, { rough: 0.25, rot: -0.4 });
        break;
      case 'coconut':
        p.disc(c, 9, 5.6, SV.hex(PAL.coconut), 1);
        p.blob(6, 6.5, 2.6, 2, SV.hex(PAL.coconutLight), rnd, { rough: 0.2 });
        p.over(5, 9, SV.hex(PAL.barkDark), 1); p.over(8, 7, SV.hex(PAL.barkDark), 1); p.over(10, 10, SV.hex(PAL.barkDark), 1);
        p.rect(4, 2, 9, 3, SV.hex(PAL.coconutMilk));   // abertura com água
        p.rect(4, 2, 9, 1.4, SV.hex('#c9b896'));
        break;
      case 'axe':
        p.line(4, 15, 11, 4, SV.hex(PAL.woodDark), 2.4, 1);
        p.line(4.4, 14.6, 11, 4.4, SV.hex(PAL.woodLight), 1.2, 1);
        p.blob(11.5, 4.5, 3.6, 3.2, SV.hex(PAL.rock), rnd, { rough: 0.14 });
        p.blob(11, 3.6, 2, 1.6, SV.hex(PAL.stonePale), rnd, { rough: 0.2 });
        p.line(8, 7.5, 12, 8.6, SV.hex(PAL.fiberDark), 1.4, 1);
        break;
      case 'spear':
        p.line(3, 15, 12, 3, SV.hex(PAL.woodDark), 2, 1);
        p.line(3.4, 14.6, 12, 3.4, SV.hex(PAL.wood), 1, 1);
        p.blob(12.6, 2.6, 2.2, 2.8, SV.hex(PAL.stonePale), rnd, { rough: 0.12, rot: 0.7 });
        p.line(10, 5.5, 12.5, 6.5, SV.hex(PAL.fiberDark), 1.2, 1);
        break;
      case 'hammer':
        p.line(5, 15, 10, 5, SV.hex(PAL.woodDark), 2.2, 1);
        p.blob(10, 4, 4, 3, SV.hex(PAL.rock), rnd, { rough: 0.14, rot: 1.57 });
        p.blob(9, 3, 2.2, 1.6, SV.hex(PAL.stonePale), rnd, { rough: 0.2 });
        break;
      case 'cooked':
        p.blob(8, 9, 5.4, 4, SV.hex('#8a4a26'), rnd, { rough: 0.16 });
        p.blob(7, 7.6, 3, 2, SV.hex('#b06a34'), rnd, { rough: 0.2 });
        p.line(11, 11, 14, 14, SV.hex('#e0d0b0'), 2, 1);
        p.over(5, 5, SV.hex('#ffd9a0'), 0.7);
        break;
      case 'raw':
        p.blob(8, 9, 5.2, 4, SV.hex('#c9705a'), rnd, { rough: 0.18 });
        p.blob(7, 7.8, 2.8, 1.8, SV.hex('#e0917a'), rnd, { rough: 0.2 });
        break;
      case 'waterskin':
        p.blob(8, 9, 4.6, 5, SV.hex(PAL.coconutLight), rnd, { rough: 0.12 });
        p.rect(6.5, 2, 3, 2.6, SV.hex(PAL.barkMid));
        p.blob(8, 9.5, 2.6, 2.6, SV.hex(PAL.water), rnd, { rough: 0.2, alpha: 0.5 });
        break;
      case 'purified':
        p.blob(8, 9, 4.8, 5, SV.hex('#6fb6c9'), rnd, { rough: 0.1 });
        p.blob(6.6, 7.4, 2, 1.6, SV.hex('#cbeef5'), rnd, { rough: 0.2 });
        break;
      case 'wall':
        p.rect(2, 4, 12, 3.4, SV.hex(PAL.wood)); p.rect(2, 8.4, 12, 3.4, SV.hex(PAL.woodDark));
        p.line(6, 4, 6, 12, SV.hex(PAL.woodDark), 1, 0.8); p.line(10, 8, 10, 12, SV.hex(PAL.wood), 1, 0.8);
        p.rect(2, 3, 12, 1, SV.hex(PAL.woodLight));
        break;
      case 'campfire':
        p.line(3, 13, 12, 9, SV.hex(PAL.woodDark), 2.2, 1); p.line(12, 13, 3, 9, SV.hex(PAL.wood), 2.2, 1);
        p.blob(8, 6, 3, 3.6, SV.hex(PAL.fire3), rnd, { rough: 0.25 });
        p.blob(8, 5.4, 1.8, 2.4, SV.hex(PAL.fire1), rnd, { rough: 0.2 });
        break;
      case 'shelter':
        p.line(2, 13, 8, 3, SV.hex(PAL.woodDark), 1.6, 1); p.line(14, 13, 8, 3, SV.hex(PAL.woodDark), 1.6, 1);
        p.blob(5.5, 8, 4, 3, SV.hex(PAL.palm), rnd, { rough: 0.3 });
        p.blob(10.5, 8.6, 4, 3, SV.hex(PAL.palmDark), rnd, { rough: 0.3 });
        break;
      case 'bed':
        p.rect(2, 8, 12, 3, SV.hex(PAL.woodDark)); p.rect(3, 6, 10, 2.4, SV.hex(PAL.fiber));
        p.rect(2, 11, 1.6, 3, SV.hex(PAL.wood)); p.rect(12.4, 11, 1.6, 3, SV.hex(PAL.wood));
        break;
      case 'rope':
        p.line(3, 12, 6, 6, SV.hex(PAL.fiberDark), 2, 1);
        p.blob(9, 6, 4, 4, SV.hex(PAL.fiber), rnd, { rough: 0.25, dither: 0.15 });
        p.blob(9, 6, 2, 2, SV.hex(PAL.fiberDark), rnd, { rough: 0.3, alpha: 0.6 });
        break;
      case 'berry':
        p.disc(6, 9, 3.2, SV.hex(PAL.fruitRed), 1); p.disc(10.5, 10, 2.8, SV.hex('#8a2a5a'), 1);
        p.disc(5, 7.8, 1, SV.hex(PAL.fruitRedLight), 1);
        p.blob(9, 5, 3, 1.6, SV.hex(PAL.leafMid), rnd, { rough: 0.3, rot: -0.4 });
        break;
      case 'mushroom':
        p.rect(7, 8, 2.6, 5, SV.hex('#e8ddc8'));
        p.blob(8, 7, 5, 3.4, SV.hex('#b3552e'), rnd, { rough: 0.14 });
        p.blob(6.5, 6, 1.6, 1, SV.hex('#e8b58e'), rnd, { rough: 0.2 });
        break;
      case 'flint':
        p.blob(8, 9, 5, 4, SV.hex('#4a4740'), rnd, { rough: 0.18 });
        p.blob(6.6, 7.4, 2.2, 1.6, SV.hex('#726d62'), rnd, { rough: 0.25 });
        break;
      default:
        p.blob(8, 8, 5, 5, SV.hex(PAL.stone), rnd, { rough: 0.2 });
    }
    p.outline(INK, 0.9);
    return p.toCanvas();
  };

  /* ------------------------------------------------------------------ *
   * ANIMAIS                                                             *
   * ------------------------------------------------------------------ */

  /** Chave estável curta para semear o ruído de cada espécie. */
  function hashKey(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function flipC(cv, W, H) {
    var f = new SV.P(W, H);
    f.ctx.save(); f.ctx.translate(W, 0); f.ctx.scale(-1, 1); f.ctx.drawImage(cv, 0, 0); f.ctx.restore();
    return f.canvas;
  }

  /**
   * Gerador genérico de quadrúpedes/répteis: lê a receita da espécie em
   * src/data/fauna.js e desenha frame a frame (0 = parado, 1..3 = andar).
   * Adicionar um animal novo não exige tocar aqui — só escrever a receita.
   */
  Art.quadruped = function (kind, frame, flip) {
    var spec = SV.Fauna[kind];
    if (!spec || spec.draw.bird) return null;
    var D = spec.draw, C = D.coat, L = D.legs, T = D.tail || { type: 'none' };
    var W = D.w, H = D.h;
    var rnd = SV.rng(hashKey(kind) + frame * 7919);
    var p = new SV.P(W, H);

    var body = SV.hex(C.body), dark = SV.hex(C.dark), light = SV.hex(C.light), bellyC = SV.hex(C.belly);
    var ink = SV.hex(C.rosette || C.shell || C.scale || C.dark);
    var sw = Math.sin((frame % 4) * Math.PI / 2);
    var bob = (frame % 2) ? -0.7 : 0.5;
    var by = D.body[1] + bob;
    var hipY = by + D.body[3] * 0.66;
    /* A textura tem origem nos pés (origin 0.5,1 na cena), então o comprimento
       da perna é sempre a distância do quadril até a última linha do canvas. */
    var legLen = Math.max(2, (H - 1) - (hipY - 1));

    /* ---------- pernas ---------- */
    var legs = [
      { x: L.back, s: -sw, far: true },
      { x: L.back + 5.5, s: sw, far: false },
      { x: L.front, s: sw, far: true },
      { x: L.front + 5, s: -sw, far: false }
    ];
    function drawLeg(lg) {
      var c0 = lg.far ? SV.mix(dark, body, 0.18) : body;
      var x0 = lg.x + lg.s * 1.7, x1 = lg.x + lg.s * 3.6;
      var top = hipY - 1 + (lg.far ? 0.8 : 0), len = legLen - (lg.far ? 0.8 : 0);
      for (var t = 0; t <= 1.001; t += 1 / len) {
        var yy = top + t * len, xx = x0 + (x1 - x0) * t;
        var wd = Math.max(1.2, L.thick * (1 - t * (lg.far ? 0.44 : 0.32)));
        p.rect(xx - wd / 2, yy, wd, 1.4, c0);
      }
      /* casco/pata: um degrau mais escuro na ponta, 1 px mais alto na perna longe */
      var hoofY = H - (lg.far ? 2 : 3);
      p.rect(x1 - L.thick * 0.72, hoofY, L.thick * 1.5, 2.4, SV.hex(L.paw));
      if (!lg.far) p.over(x1 - L.thick * 0.4, hoofY + 1.6, SV.mix(SV.hex(L.paw), light, 0.4), 0.8);
    }
    legs.forEach(function (lg) { if (lg.far) drawLeg(lg); });

    /* ---------- cauda (atrás do corpo) ---------- */
    var tx = D.body[0] - D.body[2] * 0.92, ty = by - D.body[3] * 0.2;
    if (T.type === 'ringed') {
      for (var q = 0; q < T.len; q++) {
        var qa = -0.5 - q * 0.13, qx = tx - q * 0.75, qy = ty - Math.sin(q / T.len * 1.9) * q * 0.5;
        p.disc(qx, qy, 1.9 - q * 0.08, (q % 2) ? dark : body, 1);
      }
    } else if (T.type === 'long') {
      for (var j = 0; j < T.len; j++) {
        p.disc(tx - j * 0.55, ty + j * 0.62 + Math.sin(j * 0.4) * 1.2, 2.5 - j * 0.13, j > T.len * 0.6 ? dark : body, 1);
      }
    } else if (T.type === 'reptile') {
      for (var j2 = 0; j2 < T.len; j2++) {
        var tw = 5.0 - j2 * 0.28;
        p.rect(tx - j2 * 0.9, ty - tw / 2 + Math.sin(j2 * 0.35) * 1.1, 1.5, tw, j2 % 3 === 0 ? dark : body, 1);
      }
      p.line(tx - 2, ty - 2.6, tx - T.len * 0.8, ty - 0.6, dark, 1, 0.8);
    } else if (T.type === 'short') {
      p.blob(tx - T.len * 0.4, ty - (T.up ? 1.6 : 0), T.len * 0.6, 1.6, dark, rnd, { rough: 0.2 });
    } else if (T.type === 'taper') {
      for (var j3 = 0; j3 < T.len; j3++) p.disc(tx - j3 * 0.8, ty + j3 * 0.18, 1.9 - j3 * 0.2, body, 1);
    }

    /* ---------- corpo ---------- */
    p.blob(D.body[0], by, D.body[2], D.body[3], body, rnd, { rough: 0.06 });
    p.blob(D.belly[0], D.belly[1] + bob, D.belly[2], D.belly[3], bellyC, rnd, { rough: 0.18, dither: 0.24, alpha: 0.9 });
    /* brilho e sombra como FAIXAS junto ao contorno (lombo iluminado, barriga
       na sombra): no meio do corpo pareciam manchas de sarna */
    p.blob(D.body[0] - 1, by - D.body[3] * 0.62, D.body[2] * 0.8, D.body[3] * 0.26, light, rnd, { rough: 0.08, dither: 0.22 });
    p.blob(D.body[0] + 1, by + D.body[3] * 0.66, D.body[2] * 0.84, D.body[3] * 0.24, dark, rnd, { rough: 0.09, dither: 0.26, alpha: 0.4 });

    /* ---------- pelagem / armadura ---------- */
    var i, k, a, rr, cx, cy, rad;
    if (C.pattern === 'rosettes') {
      /* rosetas em grade com jitter: distribuídas pelo corpo todo, porque em
         polar elas se acumulam no meio e viram uma mancha escura só */
      var cols = 5, rw = D.body[2] * 1.62 / cols, rh = D.body[3] * 1.5 / Math.ceil(C.density / cols);
      for (i = 0; i < C.density; i++) {
        cx = D.body[0] - D.body[2] * 0.81 + (i % cols + 0.5) * rw + rnd.range(-rw * 0.3, rw * 0.3);
        cy = by - D.body[3] * 0.72 + (((i / cols) | 0) + 0.5) * rh + rnd.range(-rh * 0.3, rh * 0.3);
        var ex = (cx - D.body[0]) / (D.body[2] * 0.9), ey = (cy - by) / (D.body[3] * 0.92);
        if (ex * ex + ey * ey > 1) continue;          /* fora do corpo não pinta */
        rad = rnd.range(1.6, 2.5);
        for (k = 0; k < 8; k++) {
          if (rnd.next() < 0.3) continue;
          var ka = k / 8 * Math.PI * 2 + i;
          p.over(cx + Math.cos(ka) * rad, cy + Math.sin(ka) * rad * 0.8, ink, 0.92);
        }
        if (rnd.next() < 0.45) p.over(cx, cy, SV.mix(ink, light, 0.3), 0.55);
      }
    } else if (C.pattern === 'spots') {
      for (i = 0; i < C.density; i++) {
        a = rnd.range(0, Math.PI * 2); rr = Math.sqrt(rnd.next()) * 0.74;
        p.over(D.body[0] + Math.cos(a) * D.body[2] * rr,
          by - D.body[3] * 0.28 + Math.sin(a) * D.body[3] * rr * 0.5,
          SV.mix(bellyC, light, 0.42), 0.62);
      }
    } else if (C.pattern === 'scales') {
      for (var sy = by - D.body[3]; sy < by + D.body[3]; sy += 2.4) {
        for (var sx = D.body[0] - D.body[2]; sx < D.body[0] + D.body[2]; sx += 3) {
          p.line(sx + ((sy | 0) % 2), sy, sx + 1.6, sy - 0.8, ink, 1, 0.55);
        }
      }
      for (var rg = 0; rg < 7; rg++) p.over(D.body[0] - 8 + rg * 3, by - D.body[3] * 0.86, dark, 1);
    } else if (C.pattern === 'shell') {
      /* casco: carapaça clara com faixas verticais, deixando a cabeça livre */
      var shx = D.body[0] - 2;
      p.blob(shx, by - 0.8, D.body[2] * 0.76, D.body[3] * 0.9, SV.hex(C.shell), rnd, { rough: 0.05 });
      for (var bn = 0; bn < 5; bn++) {
        var bx = shx - D.body[2] * 0.5 + bn * (D.body[2] * 0.25);
        p.line(bx, by - D.body[3] * 0.78, bx - 0.7, by + D.body[3] * 0.5, dark, 1, 0.8);
      }
      p.blob(shx - D.body[2] * 0.6, by - D.body[3] * 0.2, D.body[2] * 0.24, D.body[3] * 0.62, SV.mix(SV.hex(C.shell), dark, 0.25), rnd, { rough: 0.08 });
      p.blob(shx + 1, by - D.body[3] * 0.62, D.body[2] * 0.44, D.body[3] * 0.3, SV.mix(SV.hex(C.shell), light, 0.55), rnd, { rough: 0.12, dither: 0.5 });
    } else if (C.pattern === 'saddle') {
      /* faixa clara sobre os ombros, como a queixada tem: borda irregular e
         meio transparente para não parecer um oval colado por cima */
      var sx0 = D.body[0] + 1;
      p.blob(sx0, by - 0.8, D.body[2] * 0.3, D.body[3] * 0.66, SV.hex(C.saddle), rnd, { rough: 0.24, dither: 0.3, alpha: 0.8 });
      p.line(sx0 + D.body[2] * 0.3, by - D.body[3] * 0.7, sx0 + D.body[2] * 0.34, by + D.body[3] * 0.6, SV.mix(SV.hex(C.saddle), dark, 0.6), 1, 0.6);
    }

    legs.forEach(function (lg) { if (!lg.far) drawLeg(lg); });

    /* ---------- pescoço e cabeça ---------- */
    var N = D.neck, Hd = D.head, Sn = D.snout;
    p.blob(N[0], N[1] + bob * 0.5, N[2], N[2] * 0.9, body, rnd, { rough: 0.08 });
    p.blob(Hd[0], Hd[1], Hd[2], Hd[3], body, rnd, { rough: 0.06 });
    p.blob(Hd[0] - 0.6, Hd[1] - Hd[3] * 0.42, Hd[2] * 0.78, Hd[3] * 0.4, light, rnd, { rough: 0.14, dither: 0.5 });
    p.blob(Sn[0], Sn[1], Sn[2], Sn[3], D.longSnout ? SV.mix(body, light, 0.25) : SV.mix(body, dark, 0.3), rnd, { rough: 0.09 });
    if (D.trunk) {
      p.blob(Sn[0] + 1.1, Sn[1] + 2.1, 2.3, 3.0, SV.mix(body, dark, 0.3), rnd, { rough: 0.1 });
      p.blob(Sn[0] + 1.5, Sn[1] + 4.2, 1.7, 1.8, SV.mix(body, dark, 0.5), rnd, { rough: 0.14 });
      p.over(Sn[0] + 1.2, Sn[1] + 5.5, SV.hex(D.nose), 1);
    }
    if (D.jaws) {
      p.line(Sn[0] - Sn[2], Sn[1] + 0.6, Sn[0] + Sn[2] * 1.5, Sn[1] + 0.2, dark, 1, 0.95);
      for (var tt = 0; tt < 5; tt++) p.over(Sn[0] - 1 + tt * 1.5, Sn[1] + 1.4, [240, 238, 226], 0.9);
    }
    p.over(Sn[0] + Sn[2] * 0.62, Sn[1] - Sn[3] * 0.35, SV.hex(D.nose), 1);

    /* ---------- orelhas, chifres, olhos ---------- */
    var E = D.ear;
    if (E && E.type === 'round') {
      p.blob(E.at[0], E.at[1], E.r * 0.86, E.r * 1.14, SV.mix(body, dark, 0.35), rnd, { rough: 0.1 });
      p.blob(E.at[0] + 0.3, E.at[1] + 0.5, E.r * 0.5, E.r * 0.7, SV.hex(C.dark), rnd, { rough: 0.12 });
      if (E.tip) p.blob(E.at[0] - 0.2, E.at[1] - E.r * 0.74, E.r * 0.46, E.r * 0.4, SV.hex(E.tip), rnd, { rough: 0.16 });
      if (E.back) p.line(E.at[0] - E.r, E.at[1] + 1, E.at[0] + E.r, E.at[1] + 1.4, SV.hex(E.back), 1, 0.7);
    } else if (E && E.type === 'point') {
      for (var pe = 0; pe < E.r * 2; pe++) {
        var pw = Math.max(1, (E.r * 2 - pe) * 0.5);
        p.rect(E.at[0] - pw / 2, E.at[1] + E.r - pe * 0.9, pw, 1.2,
          pe > E.r ? SV.mix(body, dark, 0.45) : body);
      }
      p.rect(E.at[0] - 0.6, E.at[1] + E.r - 1.4, 1.4, 1.6, SV.mix(body, dark, 0.6));
    } else if (E && E.type === 'tiny') {
      p.disc(E.at[0], E.at[1], E.r, SV.mix(body, dark, 0.4), 1);
    }
    if (D.horn && D.horn.type === 'antler') {
      /* a base nasce no topo do crânio para a haste nunca ficar solta no ar */
      var hx = Hd[0] - 0.8, hy = Hd[1] - Hd[3] * 0.86;
      var horn = SV.hex(D.horn.color || '#8a7146'), horn2 = SV.hex(D.horn.color2 || '#6f5a37');
      p.line(hx, hy + 1.2, hx - 1.2, hy - 6.4, horn, 1.4, 1);
      p.line(hx - 0.6, hy - 2.4, hx + 2.2, hy - 5.2, horn, 1, 1);
      p.line(hx - 1.0, hy - 4.2, hx - 3.4, hy - 6.4, horn2, 1, 1);
      p.line(hx + 2.2, hy - 5.2, hx + 2.6, hy - 7.4, horn2, 1, 1);
      p.over(hx - 1.2, hy - 6.4, horn, 1);
    }
    if (D.eye) {
      var ec = D.eyeColor ? SV.hex(D.eyeColor) : SV.hex('#1a1008');
      p.over(D.eye[0], D.eye[1], ec, 1);
      p.over(D.eye[0] + 0.9, D.eye[1], SV.hex('#120c06'), 1);
      p.over(D.eye[0] - 0.3, D.eye[1] - 0.7, [255, 255, 255], 0.5);
      if (D.eyeColor) { p.over(D.eye[0] + 0.9, D.eye[1], SV.hex('#120c06'), 1); }
    }
    if (D.ridge) for (var rz = 0; rz < 4; rz++) p.over(Hd[0] - 3 + rz * 2.4, Hd[1] - Hd[3] * 0.95, dark, 1);

    p.grain(rnd, 0.045, true);
    p.outline(C.outline || '#241708', 0.88);
    var cv = p.toCanvas();
    return flip ? flipC(cv, W, H) : cv;
  };

  /** Aves: tucano pousado e arara-azul em voo. */
  Art.bird = function (kind, frame, flip) {
    var D = SV.Fauna[kind].draw;
    var W = D.w, H = D.h;
    var rnd = SV.rng(hashKey(kind) + frame * 331);
    var p = new SV.P(W, H);
    var flap = frame === 1 ? -3 : (frame === 2 ? 2 : 0);

    if (D.bird === 'toucan') {
      p.blob(12, 14.5, 6.8, 6.4, SV.hex('#20232a'), rnd, { rough: 0.07 });
      p.blob(11, 17, 4.6, 3.4, SV.hex('#12141a'), rnd, { rough: 0.1, alpha: 0.85 });
      p.blob(15.5, 13.5, 3.6, 4.2, SV.hex('#f4ecd8'), rnd, { rough: 0.09 });
      p.blob(15.6, 12.6, 2.4, 2.2, SV.hex('#f0b428'), rnd, { rough: 0.14, dither: 0.35 });
      p.blob(17.6, 8.4, 4.8, 4.4, SV.hex('#22252c'), rnd, { rough: 0.07 });
      p.blob(17.6, 7.2, 3.2, 2.2, SV.hex('#33373f'), rnd, { rough: 0.14, dither: 0.4 });
      p.blob(23, 8.8, 5.6, 2.4, SV.hex(PAL.fruitOrange), rnd, { rough: 0.07 });
      p.blob(23.6, 7.8, 4.8, 1.5, SV.hex(PAL.fruitYellow), rnd, { rough: 0.09 });
      p.line(19.4, 10.6, 27.6, 9.6, SV.hex('#8a2f10'), 1, 0.95);
      p.over(27.6, 8.8, SV.hex('#2a1a08'), 1);
      p.disc(19.2, 7.6, 1.9, SV.hex('#4ec4d8'), 1);
      p.disc(19.4, 7.6, 1.0, SV.hex('#101418'), 1);
      p.blob(8.4 + flap * 0.3, 13.5 + flap * 0.8, 4.4, 5.2, SV.hex('#2a2d34'), rnd, { rough: 0.12, rot: flap * 0.16 });
      p.line(4.5, 16.5, 1.2, 20, SV.hex('#1b1d22'), 2.6, 1);
      p.line(6.5, 18.5, 3.4, 21.5, SV.hex('#12141a'), 1.6, 1);
      p.line(13, 20.5, 13, 22.6, SV.hex('#5a5f6a'), 1.2, 1);
      p.line(15.4, 20.5, 15.4, 22.6, SV.hex('#5a5f6a'), 1.2, 1);
      p.outline('#0a0a0e', 0.8);
    } else {
      /* arara-azul-grande: corpo azul, face branca com listras, bico negro,
         mancha amarela na dobra da asa e cauda longa. */
      p.line(9, 11, 1, 16, SV.hex('#1c3f86'), 3.2, 1);
      p.line(9, 12, 2, 18, SV.hex('#16306b'), 2.2, 1);
      p.blob(15, 10.5, 6.4, 5.0, SV.hex('#2f6fd0'), rnd, { rough: 0.07 });
      p.blob(14, 12.6, 5.0, 3.0, SV.hex('#1c4a9c'), rnd, { rough: 0.1, alpha: 0.8 });
      p.blob(19.5, 6.6, 4.0, 3.6, SV.hex('#3a7de0'), rnd, { rough: 0.08 });
      p.blob(21.4, 7.4, 2.4, 2.2, SV.hex('#eef0ea'), rnd, { rough: 0.1 });
      p.line(20.6, 7.0, 23.2, 7.6, SV.hex('#2a2a28'), 1, 0.8);
      p.blob(23.6, 6.4, 2.2, 1.6, SV.hex('#22242a'), rnd, { rough: 0.1 });
      p.blob(23.4, 5.6, 1.6, 1.0, SV.hex('#3a3d44'), rnd, { rough: 0.12 });
      p.disc(20.6, 5.6, 1.1, SV.hex('#f2e9c8'), 1);
      p.over(20.8, 5.6, SV.hex('#141414'), 1);
      var wy = flap < 0 ? 8.5 : 11.5;
      p.blob(13.5, wy, 6.2, 2.6, SV.hex('#2a5fc0'), rnd, { rough: 0.1, rot: flap * 0.1 });
      p.blob(11.5, wy + 0.6, 2.6, 1.5, SV.hex('#e8c33c'), rnd, { rough: 0.14, dither: 0.25 });
      p.line(8, wy + 1.4, 4, wy + 3.4, SV.hex('#16306b'), 1.8, 1);
      p.line(16, 15, 14.6, 17.6, SV.hex('#4a4f58'), 1.2, 1);
      p.outline('#0e1a30', 0.82);
    }
    var cv = p.toCanvas();
    return flip ? flipC(cv, W, H) : cv;
  };

  /** Borboleta / inseto ambiente. */
  Art.butterfly = function (frame) {
    var p = new SV.P(10, 8), rnd = SV.rng(31 + frame);
    var c = frame ? '#f0d860' : '#e8b840';
    p.blob(3, 4, 2.6, frame ? 3 : 1.6, SV.hex(c), rnd, { rough: 0.2 });
    p.blob(7, 4, 2.6, frame ? 3 : 1.6, SV.hex(c), rnd, { rough: 0.2 });
    p.over(3, 4, SV.hex('#a06a20'), 0.6);
    p.over(7, 4, SV.hex('#a06a20'), 0.6);
    p.line(5, 2, 5, 6, SV.hex('#3a3020'), 1, 1);
    p.outline('#3a3020', 0.5);
    return p.toCanvas();
  };

  /* ------------------------------------------------------------------ *
   * HUD: ícones e painéis                                               *
   * ------------------------------------------------------------------ */

  /** Ícone da HUD (termômetro, calendário, relógio, clima, coração, etc.). */
  Art.hudIcon = function (kind) {
    var rnd = SV.rng(kind.length * 131 + 5);
    var p = new SV.P(18, 18);
    switch (kind) {
      case 'temp': // termômetro
        p.rect(7, 2, 4, 10, SV.hex('#dfe8ee')); p.disc(9, 13.5, 3.6, SV.hex('#dfe8ee'), 1);
        p.rect(7.8, 5, 2.4, 7, SV.hex(PAL.hp)); p.disc(9, 13.4, 2.4, SV.hex(PAL.hp), 1);
        p.line(11.5, 4, 13.5, 4, SV.hex('#9fb0ba'), 1, 1); p.line(11.5, 7, 13, 7, SV.hex('#9fb0ba'), 1, 1);
        break;
      case 'day': // calendário
        p.rect(2, 4, 14, 12, SV.hex('#f2f5f7')); p.rect(2, 4, 14, 3.6, SV.hex(PAL.hp));
        p.rect(4.5, 1.5, 2, 3.6, SV.hex('#b9c3cb')); p.rect(11.5, 1.5, 2, 3.6, SV.hex('#b9c3cb'));
        for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) p.rect(4 + i * 4, 9.5 + j * 3.4, 2.6, 2.4, SV.hex('#5b6b78'));
        break;
      case 'clock': // relógio
        p.disc(9, 9, 7.4, SV.hex('#eef3f6'), 1); p.disc(9, 9, 6, SV.hex('#ffffff'), 1);
        p.line(9, 9, 9, 4.6, SV.hex('#2b3a46'), 1.4, 1); p.line(9, 9, 12.4, 10.4, SV.hex('#2b3a46'), 1.2, 1);
        p.disc(9, 9, 1, SV.hex(PAL.hp), 1);
        for (var k = 0; k < 12; k++) { var a = k / 12 * Math.PI * 2; p.over(9 + Math.cos(a) * 5.2, 9 + Math.sin(a) * 5.2, SV.hex('#9fb0ba'), 1); }
        break;
      case 'heart':
        p.blob(5.6, 6.6, 3.4, 3.2, SV.hex(PAL.hp), rnd, { rough: 0.08 });
        p.blob(12.4, 6.6, 3.4, 3.2, SV.hex(PAL.hp), rnd, { rough: 0.08 });
        p.line(2.4, 8, 9, 15.6, SV.hex(PAL.hp), 4.4, 1); p.line(15.6, 8, 9, 15.6, SV.hex(PAL.hp), 4.4, 1);
        p.blob(5, 5.6, 1.6, 1.2, SV.hex('#ff8a8a'), rnd, { rough: 0.2 });
        break;
      case 'food': // sobrecoxa
        p.blob(8, 10, 5.4, 5, SV.hex(PAL.food), rnd, { rough: 0.14 });
        p.blob(7, 8.6, 3, 2.6, SV.hex('#f0a94a'), rnd, { rough: 0.2, dither: 0.3 });
        p.line(12, 12.5, 15.5, 15.5, SV.hex('#efe3cc'), 2.6, 1);
        p.disc(15.6, 15.4, 1.6, SV.hex('#ffffff'), 1);
        break;
      case 'water': // gota
        p.blob(9, 11, 5, 5.4, SV.hex(PAL.water), rnd, { rough: 0.06 });
        p.line(4.6, 10, 9, 2.6, SV.hex(PAL.water), 3.4, 1);
        p.line(13.4, 10, 9, 2.6, SV.hex(PAL.water), 3.4, 1);
        p.blob(7, 10, 1.6, 2.4, SV.hex('#a8e4ff'), rnd, { rough: 0.2, alpha: 0.9 });
        break;
      case 'energy': // raio
        p.line(11, 1.5, 5.5, 9.5, SV.hex(PAL.energy), 3, 1);
        p.line(5.5, 9.5, 11.5, 9.5, SV.hex(PAL.energy), 2.4, 1);
        p.line(11.5, 9.5, 6.5, 16.5, SV.hex(PAL.energy), 3, 1);
        p.line(10.4, 3.4, 7.4, 8, SV.hex('#fff4a8'), 1.4, 1);
        break;
      case 'sun':
        p.disc(9, 9, 4.6, SV.hex('#ffd23f'), 1); p.disc(8.2, 8.2, 2.6, SV.hex('#fff0a0'), 1);
        for (var r = 0; r < 8; r++) { var a2 = r / 8 * Math.PI * 2; p.line(9 + Math.cos(a2) * 6, 9 + Math.sin(a2) * 6, 9 + Math.cos(a2) * 8.4, 9 + Math.sin(a2) * 8.4, SV.hex('#ffb02e'), 1.6, 1); }
        break;
      case 'cloud':
        p.blob(7, 10, 5.4, 3.6, SV.hex('#dfe8ee'), rnd, { rough: 0.1 });
        p.blob(12, 10.6, 4.4, 3, SV.hex('#c8d6de'), rnd, { rough: 0.1 });
        p.blob(9, 8, 3.6, 2.8, SV.hex('#ffffff'), rnd, { rough: 0.12 });
        break;
      case 'rain':
        p.blob(8, 7, 6, 3.6, SV.hex('#b9c8d2'), rnd, { rough: 0.1 });
        p.blob(12.5, 8, 3.6, 2.6, SV.hex('#93a6b3'), rnd, { rough: 0.12 });
        for (var d = 0; d < 3; d++) { p.line(4 + d * 4.4, 11.5, 3 + d * 4.4, 16, SV.hex(PAL.water), 1.6, 1); }
        break;
      case 'storm':
        p.blob(8, 6.5, 6.4, 3.8, SV.hex('#7b8894'), rnd, { rough: 0.1 });
        p.blob(12.5, 7.4, 4, 2.8, SV.hex('#5f6c78'), rnd, { rough: 0.12 });
        p.line(9, 9, 6, 13, SV.hex(PAL.energy), 2, 1); p.line(6, 13, 9.5, 13, SV.hex(PAL.energy), 1.6, 1);
        p.line(9.5, 13, 6.5, 17, SV.hex(PAL.energy), 2, 1);
        for (var s2 = 0; s2 < 2; s2++) p.line(12 + s2 * 3, 10, 11 + s2 * 3, 15, SV.hex('#9fd4ff'), 1.2, 1);
        break;
      case 'moon':
        p.disc(9, 9, 5.6, SV.hex('#e8eeF5'.toLowerCase()), 1);
        p.disc(11.6, 7.4, 5, [0, 0, 0], 0);
        p.blob(11, 7, 4.6, 5, [0, 0, 0], rnd, { rough: 0.02, alpha: 0 });
        p.disc(7.4, 7.4, 1.2, SV.hex('#c8d2e0'), 1); p.disc(9.6, 11, 1.6, SV.hex('#c8d2e0'), 1);
        break;
      case 'mission': // machadinha da caixa de missão
        p.line(4, 15, 11, 4, SV.hex(PAL.woodDark), 2.4, 1);
        p.line(4.4, 14.6, 11, 4.4, SV.hex(PAL.woodLight), 1.1, 1);
        p.blob(11.6, 4.6, 3.8, 3.4, SV.hex(PAL.rock), rnd, { rough: 0.14 });
        p.blob(11, 3.6, 2, 1.6, SV.hex(PAL.stonePale), rnd, { rough: 0.2 });
        p.line(8.4, 7.4, 12.4, 8.6, SV.hex(PAL.fiberDark), 1.3, 1);
        break;
      case 'lock':
        p.rect(4, 8, 10, 8, SV.hex('#c8a24a')); p.rect(5.4, 9.6, 7.2, 5, SV.hex('#e8c468'));
        p.line(6, 8, 6, 5, SV.hex('#9a9aa0'), 1.8, 1); p.line(12, 8, 12, 5, SV.hex('#9a9aa0'), 1.8, 1);
        p.line(6, 4.6, 12, 4.6, SV.hex('#9a9aa0'), 1.8, 1);
        p.rect(8.4, 11, 1.6, 3.4, SV.hex('#5a4a1a'));
        break;
      default:
        p.disc(9, 9, 6, SV.hex(PAL.stone), 1);
    }
    p.outline('#0e1a24', 0.75);
    return p.toCanvas();
  };

  /** Painel arredondado 9-slice da HUD (fundo escuro + borda clara). */
  Art.panel = function (w, h, radius, opts) {
    opts = opts || {};
    var rnd = SV.rng(w * 31 + h);
    var p = new SV.P(w, h);
    var bg = opts.bg || PAL.uiPanel, edge = opts.edge || PAL.uiBorder;
    var r = radius === undefined ? 7 : radius;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dx = Math.max(r - x, x - (w - 1 - r), 0), dy = Math.max(r - y, y - (h - 1 - r), 0);
      if (dx * dx + dy * dy > r * r) continue;
      var inner = Math.max(dx, dy);
      var c;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || inner > r - 1.2) c = SV.hex(edge);
      else if (inner > r - 2.4) c = SV.mix(edge, bg, 0.45);
      else {
        var t = SV.clamp(y / h, 0, 1);
        c = SV.mix(SV.shadeHex(bg, 0.1), SV.shadeHex(bg, -0.25), t);
      }
      p.set(x, y, c);
    }
    if (opts.shadow !== false) {
      var out = new SV.P(w + 4, h + 4);
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        var s = p.get(xx, yy);
        if (s[3] > 0) { out.over(xx + 2, yy + 3, [0, 0, 0], 0.28); }
      }
      for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) {
        var v = p.get(x2, y2);
        if (v[3] > 0) out.set(x2 + 2, y2 + 2, [v[0], v[1], v[2]], v[3]);
      }
      return out.toCanvas();
    }
    return p.toCanvas();
  };

  /** Barra de status (fundo escuro + preenchimento com brilho segmentado). */
  Art.bar = function (w, h, color, filled) {
    var p = new SV.P(w, h);
    var rnd = SV.rng(w + h * 7);
    // moldura
    p.rect(0, 0, w, h, SV.hex('#0b141f'));
    p.rect(1, 1, w - 2, h - 2, SV.hex('#243546'));
    var fw = Math.max(0, Math.round((w - 4) * SV.clamp(filled, 0, 1)));
    if (fw > 0) {
      for (var y = 2; y < h - 2; y++) for (var x = 2; x < 2 + fw; x++) {
        var t = (y - 2) / Math.max(1, h - 5);
        var c = t < 0.35 ? SV.shadeHex(color, 0.35) : (t > 0.72 ? SV.shadeHex(color, -0.3) : SV.hex(color));
        var g = (SV.fbm(x * 0.4, y * 0.4, 2, 3) - 0.5) * 18;
        p.set(x, y, [SV.clamp(c[0] + g, 0, 255), SV.clamp(c[1] + g, 0, 255), SV.clamp(c[2] + g, 0, 255)]);
      }
      // nervuras diagonais
      for (var s = 0; s < fw; s += 6) p.line(2 + s, 2, 2 + s + 3, h - 3, SV.hex('#000000'), 1, 0.14);
    }
    p.rect(0, 0, w, 1, SV.hex('#7fc4e8'));
    p.rect(0, h - 1, w, 1, SV.hex('#0a1018'));
    p.rect(0, 0, 1, h, SV.hex('#7fc4e8'));
    p.rect(w - 1, 0, 1, h, SV.hex('#0a1018'));
    return p.toCanvas();
  };

  /** Slot do inventário (quadrado com borda; variante selecionada mais clara). */
  Art.slot = function (size, selected) {
    var p = new SV.P(size, size);
    var rnd = SV.rng(size + (selected ? 1 : 0));
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var t = y / size;
      var c = SV.mix(SV.hex(selected ? '#2d4c68' : '#1b2f42'), SV.hex(selected ? '#1a3247' : '#0f1c29'), t);
      p.set(x, y, c);
    }
    p.blob(size * 0.3, size * 0.7, size * 0.3, size * 0.2, SV.hex('#000000'), rnd, { rough: 0.3, dither: 0.5, alpha: 0.15 });
    var b = selected ? '#bfe8ff' : '#5f86a3';
    p.rect(0, 0, size, 1, SV.hex(b)); p.rect(0, size - 1, size, 1, SV.hex(b));
    p.rect(0, 0, 1, size, SV.hex(b)); p.rect(size - 1, 0, 1, size, SV.hex(b));
    if (selected) {
      p.rect(1, 1, size - 2, 1, SV.hex('#ffffff')); p.rect(1, 1, 1, size - 2, SV.hex('#ffffff'));
    }
    return p.toCanvas();
  };

  /** Cursor/seta e outros glifos pequenos. */
  Art.dot = function (r, color) {
    var p = new SV.P(r * 2, r * 2);
    p.disc(r, r, r - 0.5, SV.hex(color), 1);
    return p.toCanvas();
  };

  /** Utilitário: clareia/escurece hex devolvendo hex. */
  function shadeHex(h, f) { return SV.toHex(SV.shade(h, f)); }
  SV.shadeHex = shadeHex;
})(window.SV);
