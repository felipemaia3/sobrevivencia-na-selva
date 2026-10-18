/*
 * BootScene — gera todas as texturas do jogo em tempo de inicialização.
 * Nenhum asset externo: cada sprite nasce de pintura pixel a pixel.
 */
(function (SV) {
  'use strict';
  var PAL = SV.PAL;

  function addTex(scene, key, canvas) {
    if (scene.textures.exists(key)) return key;
    scene.textures.addCanvas(key, canvas);
    return key;
  }
  SV.addTex = addTex;

  /* Chaves de UI geradas sob demanda (dependem do tamanho final na tela). */
  var panelCache = {}, barCache = {};
  SV.panelKey = function (scene, w, h, opts) {
    opts = opts || {};
    var key = 'panel_' + w + 'x' + h + '_' + (opts.bg || '') + (opts.noShadow ? '_ns' : '');
    if (!panelCache[key]) panelCache[key] = addTex(scene, key, SV.Art.panel(w, h, opts.r, opts));
    return key;
  };
  SV.barKey = function (scene, w, h, color, filled) {
    var key = 'bar_' + w + 'x' + h + '_' + color.replace('#', '') + '_' + Math.round(filled * 100);
    if (!barCache[key]) barCache[key] = addTex(scene, key, SV.Art.bar(w, h, color, filled));
    return key;
  };
  SV.slotKey = function (scene, size, selected) {
    var key = 'slot_' + size + (selected ? '_on' : '_off');
    if (!panelCache[key]) panelCache[key] = addTex(scene, key, SV.Art.slot(size, selected));
    return key;
  };

  var Boot = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Boot() { Phaser.Scene.call(this, { key: 'Boot' }); },

    create: function () {
      var A = SV.Art, scene = this;

      /* ---------- água ---------- */
      A.waterRipples(3).forEach(function (c, i) { addTex(scene, 'ripple_' + i, c); });
      addTex(scene, 'lily_0', A.lilyPad(11, false));
      addTex(scene, 'lily_1', A.lilyPad(23, true));
      addTex(scene, 'reeds_0', A.reeds(5));
      addTex(scene, 'reeds_1', A.reeds(77));

      /* ---------- vegetação ---------- */
      SV.treeSizes = {}; SV.palmSizes = {};
      for (var v = 0; v < 4; v++) {
        var t = A.tree(1000 + v * 37, 1);
        SV.treeSizes[v] = t;
        addTex(scene, 'tree_trunk_' + v, t.trunk);
        addTex(scene, 'tree_canopy_' + v, t.canopy);
      }
      for (var pv = 0; pv < 3; pv++) {
        var pm = A.palm(500 + pv * 91, 1);
        SV.palmSizes[pv] = pm;
        addTex(scene, 'palm_trunk_' + pv, pm.trunk);
        addTex(scene, 'palm_canopy_' + pv, pm.canopy);
      }
      for (var fv = 0; fv < 3; fv++) addTex(scene, 'fern_' + fv, A.fern(300 + fv * 17, 1));
      for (var bv = 0; bv < 3; bv++) {
        addTex(scene, 'bush_' + bv, A.bush(700 + bv * 23, true));
        addTex(scene, 'bushEmpty_' + bv, A.bush(700 + bv * 23, false));
      }
      for (var lv = 0; lv < 3; lv++) addTex(scene, 'broadleaf_' + lv, A.broadleaf(150 + lv * 41));
      for (var tv = 0; tv < 2; tv++) addTex(scene, 'tallPlant_' + tv, A.tallPlant(80 + tv * 13));
      addTex(scene, 'rock_big', A.rock(21, 40));
      addTex(scene, 'rock_mid', A.rock(57, 30));
      addTex(scene, 'rock_small', A.rock(93, 24));
      addTex(scene, 'log_0', A.log(3));
      addTex(scene, 'stonePile_0', A.stonePile(9));
      addTex(scene, 'branchPile_0', A.branchPile(13));
      addTex(scene, 'fiber_0', A.fiberPlant(17));
      addTex(scene, 'fiber_1', A.fiberPlant(33));
      addTex(scene, 'fruitCluster_0', A.fruitCluster(19));
      addTex(scene, 'coconut_0', A.coconutItem(23));
      addTex(scene, 'mushroom_0', A.mushrooms(29));

      /* ---------- construções e fogo ---------- */
      addTex(scene, 'shelter_0', A.shelter(41));
      addTex(scene, 'firePit_0', A.firePit(43));
      addTex(scene, 'firecover_0', A.fireCover(44));
      for (var i = 0; i < 5; i++) addTex(scene, 'flame_' + i, A.flame(i));
      addTex(scene, 'smoke_0', A.smoke(45));
      addTex(scene, 'smoke_1', A.smoke(47));
      addTex(scene, 'shadow_0', A.shadow(40, 18));
      addTex(scene, 'shadow_big', A.shadow(64, 26));
      addTex(scene, 'shadow_small', A.shadow(24, 12));

      // barreira de toros
      (function () {
        var p = new SV.P(56, 50), rnd = SV.rng(5);
        for (var i = 0; i < 5; i++) {
          var x = 5 + i * 10, top = 6 + (i % 2) * 3;
          p.rect(x, top, 8, 42, SV.hex(i % 2 ? PAL.wood : PAL.woodDark));
          p.rect(x, top, 2, 42, SV.hex(PAL.woodLight));
          p.line(x + 1, top + 2, x + 7, top + 40, SV.hex(PAL.woodDark), 1, 0.4);
          p.disc(x + 4, top, 2.6, SV.hex(PAL.woodLight), 1);
          p.disc(x + 4, top, 1.2, SV.hex(PAL.barkMid), 1);
        }
        p.rect(0, 20, 56, 4, SV.hex(PAL.barkMid));
        p.rect(0, 38, 56, 4, SV.hex(PAL.barkMid));
        p.outline('#241708', 0.7);
        addTex(scene, 'wall_0', p.toCanvas());
      })();

      // cama de folhas
      (function () {
        var p = new SV.P(60, 34), rnd = SV.rng(9);
        p.rect(4, 20, 52, 6, SV.hex(PAL.woodDark));
        p.rect(6, 26, 5, 7, SV.hex(PAL.wood)); p.rect(49, 26, 5, 7, SV.hex(PAL.wood));
        for (var i = 0; i < 9; i++) p.blob(8 + i * 5.4, 16 + rnd.range(-2, 2), 6, 4, SV.hex(i % 2 ? PAL.palm : PAL.palmDark), rnd, { rough: 0.25 });
        for (var j = 0; j < 6; j++) p.blob(10 + j * 7, 13, 4, 2.6, SV.hex(PAL.palmLight), rnd, { rough: 0.3, dither: 0.3 });
        p.outline('#241708', 0.6);
        addTex(scene, 'bed_0', p.toCanvas());
      })();

      /* ---------- personagem ---------- */
      SV.playerFrames = {};
      var ACTS = [
        ['idle', 0, 'idle'], ['walk0', 0, 'walk'], ['walk1', 0.25, 'walk'], ['walk2', 0.5, 'walk'], ['walk3', 0.75, 'walk'],
        ['run0', 0, 'run'], ['run1', 0.25, 'run'], ['run2', 0.5, 'run'], ['run3', 0.75, 'run'],
        ['attack0', 0.05, 'attack'], ['attack1', 0.75, 'attack'], ['eat', 0.5, 'eat'], ['hurt', 0, 'hurt']
      ];
      ['down', 'up', 'side'].forEach(function (dir) {
        ACTS.forEach(function (f) {
          var res = A.playerFrame(dir, f[1], f[2], 0);
          var key = 'pl_' + dir + '_' + f[0];
          addTex(scene, key, res.canvas);
          SV.playerFrames[key] = { hand: res.hand };
        });
      });

      /* ---------- ferramentas seguradas ---------- */
      addTex(scene, 'tool_axe', A.tool('axe'));
      addTex(scene, 'tool_spear', A.tool('spear'));
      addTex(scene, 'tool_spear2', A.tool('spear2'));
      addTex(scene, 'tool_spear3', A.tool('spear3'));
      addTex(scene, 'tool_torch', A.tool('torch'));
      addTex(scene, 'tool_rod', A.tool('rod'));

      /* ---------- bóia da linha de pesca ---------- */
      (function () {
        var p = new SV.P(10, 14), rnd = SV.rng(71);
        p.blob(5, 9.5, 3.2, 4, SV.hex(PAL.fiber), rnd, { rough: 0.1 });        // linha
        p.disc(5, 4.4, 2.6, SV.hex('#e04a35'), 1);
        p.blob(5, 2.6, 2.4, 1.6, SV.hex('#f3ece0'), rnd, { rough: 0.1 });
        p.over(4, 3, SV.hex('#ffffff'), 0.5);
        p.outline('#20160c', 0.75);
        addTex(scene, 'bobber_0', p.toCanvas());
      })();

      /* ---------- fauna (receitas em src/data/fauna.js) ---------- */
      for (var fk in SV.Fauna) {
        if (fk === 'huntable' || fk === 'population' || typeof SV.Fauna[fk] !== 'object') continue;
        var spec = SV.Fauna[fk], frames = spec.draw.bird ? 3 : 4;
        for (var ff = 0; ff < frames; ff++) {
          if (spec.draw.bird) {
            addTex(scene, fk + '_' + ff, SV.Art.bird(fk, ff, false));
            addTex(scene, fk + '_f' + ff, SV.Art.bird(fk, ff, true));
          } else {
            addTex(scene, fk + '_' + ff, SV.Art.quadruped(fk, ff, false));
            addTex(scene, fk + '_f' + ff, SV.Art.quadruped(fk, ff, true));
          }
        }
      }
      addTex(scene, 'butterfly_0', A.butterfly(0));
      addTex(scene, 'butterfly_1', A.butterfly(1));

      /* ---------- ícones ---------- */
      var icons = { wood: 1, stone: 1, fiber: 1, fruit: 1, axe: 1, spear: 1, coconut: 1, branch: 1, campfire: 1, shelter: 1, bed: 1, wall: 1, rope: 1, berry: 1, mushroom: 1, flint: 1, cooked: 1, raw: 1, waterskin: 1, purified: 1, torch: 1, fern: 1 };
      for (var id in SV.Items) if (SV.Items[id].icon) icons[SV.Items[id].icon] = 1;
      for (var ik in icons) addTex(scene, 'icon_' + ik, A.icon(ik));
      ['temp', 'day', 'clock', 'heart', 'food', 'water', 'energy', 'sun', 'cloud', 'rain', 'storm', 'moon', 'mission', 'lock'].forEach(function (k) {
        addTex(scene, 'hud_' + k, A.hudIcon(k));
      });

      /* ---------- chuva ---------- */
      for (var f = 0; f < 3; f++) {
        var p = new SV.P(6, 14);
        for (var i2 = 0; i2 < 12; i2++) {
          var x2 = 5 - i2 * 0.42 + f * 0.3;
          p.over(x2, i2, [205, 230, 255], Math.max(0.05, 0.6 - i2 * 0.035));
          p.over(x2 - 0.6, i2 + 0.4, [255, 255, 255], 0.22);
        }
        addTex(scene, 'rain_' + f, p.toCanvas());
      }
      (function () {
        var sp = new SV.P(12, 8);
        for (var a = 0; a < 6; a++) {
          var ang = a / 6 * Math.PI * 2;
          sp.over(6 + Math.cos(ang) * 4, 4 + Math.sin(ang) * 1.8, [225, 245, 255], 0.7);
        }
        sp.line(2, 4, 10, 4, [220, 240, 255], 1, 0.35);
        addTex(scene, 'splash_0', sp.toCanvas());
      })();

      /* ---------- seta de interação ---------- */
      (function () {
        var p = new SV.P(14, 18);
        p.line(7, 1, 1, 9, SV.hex('#ffffff'), 2, 1); p.line(7, 1, 13, 9, SV.hex('#ffffff'), 2, 1);
        p.line(1, 9, 13, 9, SV.hex('#ffffff'), 2, 1);
        p.rect(6, 9, 2, 8, SV.hex('#ffffff'));
        p.outline('#12303f', 0.9);
        addTex(scene, 'prompt_arrow', p.toCanvas());
      })();

      this.scene.start('Menu');
    }
  });

  SV.BootScene = Boot;
})(window.SV);
