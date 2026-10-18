/*
 * world.js — formato do terreno e geração determinística do mundo aberto:
 * rio no topo, açude, clareira do acampamento, vegetação em camadas,
 * recursos coletáveis, pontos de colisão e poleiros dos tucanos.
 */
(function (SV) {
  'use strict';
  var W = 2400, H = 1800;

  SV.World = { W: W, H: H };

  /**
   * Funções de "forma" do mundo, usadas pelo pintor de terreno e pela lógica.
   * Todas recebem coordenadas de mundo em pixels de jogo.
   */
  SV.World.makeShape = function (seed) {
    var shore = new Float32Array(0);
    var shoreN = 192;
    var sh = [];
    for (var i = 0; i <= shoreN; i++) {
      var x = (i / shoreN) * W;
      sh.push(210 + SV.fbm(x * 0.0022, 3.7, 3, seed + 5) * 130 - 40);
    }
    function shoreAt(x) {
      var t = SV.clamp(x / W, 0, 1) * (shoreN - 1);
      var i = Math.floor(t), f = SV.smoothstep(t - i);
      return SV.lerp(sh[i], sh[Math.min(shoreN, i + 1)], f);
    }
    var pond = { x: W * 0.19, y: H * 0.62, r: 118 };
    // acampamento perto do rio: na tela inicial a água aparece no topo, como na referência
    var camp = { x: W * 0.52, y: shoreAt(W * 0.52) + 175, r: 186 };
    var riverW = 250;
    /** Margem oposta do rio: acima desta linha começa a parede de mata fechada. */
    function riverTopAt(x) { return shoreAt(x) - riverW; }

    function pondDepth(x, y) {
      var d = SV.dist(x, y, pond.x, pond.y);
      var edge = pond.r * (0.82 + SV.fbm(x * 0.008, y * 0.008, 2, seed + 31) * 0.42);
      return (edge - d) / 55;
    }

    var chunkCache = {};
    /**
     * Amostrador rápido e contínuo para um chunk de terreno: pré-computa a
     * margem do rio e os campos de ruído da borda do açude/acampamento.
     * Devolve f(x,y) -> {water, sand, dirt} em coordenadas locais do chunk.
     */
    function chunkSampler(ox, oy, size) {
      var key = ox + '_' + oy + '_' + size;
      if (chunkCache[key]) return chunkCache[key];
      var shoreArr = new Float32Array(size);
      for (var i = 0; i < size; i++) shoreArr[i] = shoreAt(ox + i);
      var fPond = SV.Art.field(size, size, 25, seed + 31, 2, ox, oy, 0.008);
      var fDirt = SV.Art.field(size, size, 25, seed + 71, 2, ox, oy, 0.006);
      var plx = pond.x - ox, ply = pond.y - oy, clx = camp.x - ox, cly = camp.y - oy;
      var fn = function (x, y) {
        var wy = oy + y;                                       // y em coordenadas de MUNDO
        var sx = shoreArr[SV.clamp(x | 0, 0, size - 1)];
        var d = (sx - wy) / riverW;
        var far = d > 1 ? 1 : 0;                       // margem oposta: mata fechada ao fundo
        var water = (d > 0 && far === 0) ? Math.min(1, d * 2.2) : 0;
        var pdx = x - plx, pdy = y - ply;
        var edge = pond.r * (0.82 + fPond(x, y) * 0.42);
        var pd = (edge - Math.sqrt(pdx * pdx + pdy * pdy)) / 55;
        if (pd > 0) water = Math.max(water, Math.min(1, pd));
        var dy = wy - sx;
        var sand = (dy >= 0 && dy < 34) ? 1 - dy / 34 : 0;
        if (pd <= 0 && pd > -0.6) sand = Math.max(sand, (0.6 + pd) / 0.6 * 0.9);
        var fd = wy - (sx - riverW);                   // areia da margem oposta
        if (fd >= 0 && fd < 26) sand = Math.max(sand, 1 - fd / 26);
        var cdx = x - clx, cdy = y - cly;
        var cedge = camp.r * (0.86 + fDirt(x, y) * 0.4);
        var dirt = far ? 0 : SV.clamp((cedge - Math.sqrt(cdx * cdx + cdy * cdy)) / 70, 0, 1);
        return { water: water, sand: SV.clamp(sand, 0, 1), dirt: dirt, far: far };
      };
      chunkCache[key] = fn;
      return fn;
    }

    return {
      seed: seed, shore: shoreAt, pond: pond, camp: camp, chunk: chunkSampler,
      riverBottom: function (x) { return shoreAt(x); },
      riverTop: riverTopAt,
      /** true quando (x,y) fica na margem oposta, do outro lado do rio. */
      farBank: function (x, y) { return y < riverTopAt(x); },
      /** >0 = água (0..1 = profundidade relativa). */
      waterAt: function (x, y) {
        var s = shoreAt(x);
        var d = (s - y) / riverW;
        var v = (d > 0 && d < 1) ? Math.min(1, d * 2.2) : 0;
        var pd = pondDepth(x, y);
        if (pd > 0) v = Math.max(v, Math.min(1, pd));
        return v;
      },
      /** Faixa de areia/terra batida na margem (0..1). */
      sandAt: function (x, y) {
        var s = shoreAt(x);
        var d = y - s;                       // logo abaixo da margem do rio
        var v = d >= 0 && d < 34 ? 1 - d / 34 : 0;
        var fd = y - (s - riverW);           // e acima da margem oposta
        if (fd >= 0 && fd < 26) v = Math.max(v, 1 - fd / 26);
        var pd = pondDepth(x, y);
        if (pd <= 0 && pd > -0.6) v = Math.max(v, (0.6 + pd) / 0.6 * 0.9);
        return SV.clamp(v, 0, 1);
      },
      /** Clareira do acampamento (terra batida). */
      dirtAt: function (x, y) {
        if (y < riverTopAt(x)) return 0;
        var d = SV.dist(x, y, camp.x, camp.y);
        var edge = camp.r * (0.86 + SV.fbm(x * 0.006, y * 0.006, 2, seed + 71) * 0.4);
        return SV.clamp((edge - d) / 70, 0, 1);
      },
      /** Área onde o jogador pode andar. */
      walkable: function (x, y) { return this.waterAt(x, y) <= 0.02; },
      /** Ponto mais alto da água na vertical x (para a borda navegável). */
      shoreY: shoreAt
    };
  };

  /* ------------------------------------------------------------------ *
   * Geração de objetos                                                  *
   * ------------------------------------------------------------------ */

  // tipo -> textura base + se é sólido + recurso que oferece
  var TYPES = {
    tree: { tex: 'tree', solid: 13, hp: 6, tool: 'axe', yield: 'wood', qty: 3, canopy: true, h: 280 },
    palm: { tex: 'palm', solid: 8, hp: 3, tool: null, yield: 'coconut', qty: 2, canopy: true, h: 190 },
    log: { tex: 'log', solid: 0, hp: 4, tool: 'axe', yield: 'wood', qty: 4, h: 34 },
    rock: { tex: 'rock', solid: 11, hp: 4, tool: 'axe', yield: 'stone', qty: 3, h: 34 },
    stonePile: { tex: 'stonePile', solid: 0, hp: 1, tool: null, yield: 'stone', qty: 2, h: 18 },
    branchPile: { tex: 'branchPile', solid: 0, hp: 1, tool: null, yield: 'branch', qty: 3, h: 22 },
    fiber: { tex: 'fiber', solid: 0, hp: 1, tool: null, yield: 'fiber', qty: 2, h: 30 },
    fern: { tex: 'fern', solid: 0, hp: 0, h: 64 },
    bush: { tex: 'bush', solid: 9, hp: 1, tool: null, yield: 'fruit', qty: 2, h: 52 },
    bushEmpty: { tex: 'bush', solid: 9, hp: 0, h: 52 },
    broadleaf: { tex: 'broadleaf', solid: 0, h: 34 },
    tallPlant: { tex: 'tallPlant', solid: 0, hp: 1, tool: null, yield: 'fiber', qty: 2, h: 62 },
    mushroom: { tex: 'mushroom', solid: 0, hp: 1, tool: null, yield: 'mushroom', qty: 1, h: 18 },
    fruitGround: { tex: 'fruitCluster', solid: 0, hp: 1, tool: null, yield: 'fruit', qty: 2, h: 20 },
    coconutGround: { tex: 'coconut', solid: 0, hp: 1, tool: null, yield: 'coconut', qty: 1, h: 16 },
    reeds: { tex: 'reeds', solid: 0, h: 44 },
    lily: { tex: 'lily', solid: 0, h: 34 },
    stone: { tex: 'rock', solid: 8, hp: 3, tool: 'axe', yield: 'stone', qty: 2, h: 22 }
  };
  SV.World.TYPES = TYPES;

  /** Chaves de textura (registradas pelo Boot) para cada objeto do mundo. */
  SV.World.texFor = function (p) {
    var v = p.variant % 4;
    switch (p.type) {
      case 'tree': return { trunk: 'tree_trunk_' + v, canopy: 'tree_canopy_' + v };
      case 'palm': return { trunk: 'palm_trunk_' + (p.variant % 3), canopy: 'palm_canopy_' + (p.variant % 3) };
      case 'fern': return { solo: 'fern_' + (p.variant % 3) };
      case 'bush': return { solo: 'bush_' + (p.variant % 3) };
      case 'bushEmpty': return { solo: 'bushEmpty_' + (p.variant % 3) };
      case 'broadleaf': return { solo: 'broadleaf_' + (p.variant % 3) };
      case 'tallPlant': return { solo: 'tallPlant_' + (p.variant % 2) };
      case 'log': return { solo: 'log_0' };
      case 'rock': return { solo: 'rock_big' };
      case 'stone': return { solo: 'rock_mid' };
      case 'stonePile': return { solo: 'stonePile_0' };
      case 'branchPile': return { solo: 'branchPile_0' };
      case 'fiber': return { solo: 'fiber_' + (p.variant % 2) };
      case 'fruitGround': return { solo: 'fruitCluster_0' };
      case 'coconutGround': return { solo: 'coconut_0' };
      case 'mushroom': return { solo: 'mushroom_0' };
      case 'reeds': return { solo: 'reeds_' + (p.variant % 2) };
      case 'lily': return { solo: 'lily_' + (p.variant % 2) };
    }
    return { solo: 'fern_0' };
  };

  /**
   * Gera a lista de objetos do mundo. `count` controla a densidade da mata.
   * Retorna props, áreas sólidas e poleiros para os tucanos.
   */
  SV.World.generate = function (seed) {
    var rnd = SV.rng(seed);
    var shape = SV.World.makeShape(seed);
    var props = [], perches = [], dens = [];
    var cell = 74;

    function tooClose(x, y, list, min) {
      for (var i = 0; i < list.length; i++) {
        if (SV.dist2(x, y, list[i].x, list[i].y) < min * min) return true;
      }
      return false;
    }

    for (var gy = 0; gy < H / cell; gy++) {
      for (var gx = 0; gx < W / cell; gx++) {
        var bx = gx * cell, by = gy * cell;
        var x = bx + rnd.range(6, cell - 6), y = by + rnd.range(6, cell - 6);
        if (x < 20 || y < 20 || x > W - 20 || y > H - 20) continue;
        var water = shape.waterAt(x, y);
        var dirt = shape.dirtAt(x, y);
        var shore = shape.shoreY(x);
        var forest = SV.fbm(x * 0.0035, y * 0.0035, 3, seed + 3);   // manchas de densidade
        var campD = SV.dist(x, y, shape.camp.x, shape.camp.y);

        /* --- vegetação aquática / margem --- */
        if (water > 0.05) {
          if (water < 0.5 && rnd.chance(0.16)) props.push(mk('lily', x, y, rnd));
          continue;
        }
        if (y - shore < 40 && rnd.chance(0.3)) { props.push(mk('reeds', x, y, rnd)); continue; }

        /* --- margem oposta: parede de mata fechada, só cenografia ao fundo --- */
        if (shape.farBank(x, y)) {
          if (rnd.chance(0.66)) props.push(mk(forest > 0.45 ? 'tree' : 'palm', x, y, rnd));
          else if (rnd.chance(0.72)) props.push(mk(rnd.pick(['fern', 'bush', 'broadleaf', 'tallPlant', 'fiber']), x, y, rnd));
          continue;
        }

        /* --- clareira do acampamento: quase nada, só detalhes --- */
        if (dirt > 0.55) {
          if (rnd.chance(0.06)) props.push(mk(rnd.chance(0.5) ? 'branchPile' : 'stonePile', x, y, rnd));
          continue;
        }

        /* --- floresta: copa grande longe do acampamento, sub-bosque por perto --- */
        var r = rnd.next();
        var treeGate = 0.1 + forest * 0.14;
        if (r < treeGate) {
          var big = campD > shape.camp.r + 140;
          var t = big ? ((forest > 0.56 && rnd.chance(0.72)) ? 'tree' : (rnd.chance(0.22) ? 'palm' : 'tree'))
            : (rnd.chance(0.35) ? 'palm' : rnd.pick(['fern', 'bush', 'broadleaf']));
          if (!tooClose(x, y, props, t === 'tree' ? 92 : 46)) {
            var pr = mk(t, x, y, rnd);
            props.push(pr);
            if (t === 'tree' && pr.variant > 0) perches.push({ x: pr.x + rnd.range(-26, 26), y: pr.y - pr.h * 0.62, prop: props.length - 1 });
          }
        } else if (r < treeGate + 0.16) {
          props.push(mk(rnd.chance(0.5) ? 'fern' : 'bush' + (rnd.chance(0.45) ? '' : 'Empty'), x, y, rnd));
        } else if (r < treeGate + 0.27) {
          props.push(mk(rnd.pick(['fiber', 'broadleaf', 'tallPlant', 'fern']), x, y, rnd));
        } else if (r < treeGate + 0.33) {
          props.push(mk(rnd.pick(['rock', 'stone', 'log']), x, y, rnd));
        } else if (r < treeGate + 0.41) {
          props.push(mk(rnd.pick(['branchPile', 'stonePile', 'fruitGround', 'coconutGround', 'mushroom']), x, y, rnd));
        }
        if (rnd.chance(0.05)) dens.push({ x: x, y: y });
      }
    }

    function mk(type, x, y, rnd, scale) {
      var T = TYPES[type];
      var variant = rnd.int(0, 3);
      scale = scale || 1;
      if (scale === 1) {
        if (type === 'tree') scale = rnd.range(0.78, 1.18);
        else if (type === 'palm') scale = rnd.range(0.8, 1.1);
        else if (type === 'fern') scale = rnd.range(0.8, 1.35);
        else if (type === 'rock' || type === 'stone') scale = rnd.range(0.7, 1.3);
        else if (type === 'bush' || type === 'bushEmpty') scale = rnd.range(0.85, 1.15);
        else if (type === 'lily') scale = rnd.range(0.7, 1.2);
        else if (type === 'reeds') scale = rnd.range(0.8, 1.2);
      }
      var o = {
        type: type, x: Math.round(x), y: Math.round(y), variant: variant, scale: scale,
        flip: rnd.chance(0.5), h: T.h * scale, solid: T.solid ? T.solid * scale : 0,
        hp: T.hp, maxHp: T.hp, tool: T.tool, yield: T.yield, qty: T.qty, alive: T.hp > 0
      };
      if (T.canopy) o.canopy = true;
      return o;
    }

    // garante recursos perto do acampamento para a missão inicial
    var c = shape.camp;
    var starters = [
      ['tree', -268, -58, 1.42], ['palm', 236, -46, 1.15],
      ['branchPile', -120, 90], ['stonePile', 130, 60], ['fiber', -70, -40],
      ['log', 175, 130], ['fruitGround', -180, 20], ['coconutGround', 60, 150],
      ['rock', -230, 150], ['fern', 210, -20], ['bush', -150, 190], ['tree', 330, 96, 1.1],
      ['tree', -372, 96, 1.05], ['palm', 260, 220], ['fiber', 40, -120], ['branchPile', -40, 220],
      ['fern', -215, -125], ['broadleaf', 150, -110], ['tallPlant', -300, 30]
    ];
    starters.forEach(function (s, i) {
      props.push(mk(s[0], c.x + s[1], c.y + s[2], SV.rng(seed + i * 13), s[3] || 1));
    });

    // ordena por Y para facilitar a inicialização com depth correto
    props.sort(function (a, b) { return a.y - b.y; });
    props.forEach(function (p, i) { p.uid = i; });

    // tucanos: escolhe poleiros altos
    var toucanSpots = perches.filter(function (p) { return p.y > 60; }).slice(0, 12);

    return {
      shape: shape, props: props, toucanSpots: toucanSpots, camp: c, seed: seed,
      /** Anel de pedras já montado no centro do acampamento (é só acender). */
      fireSpot: { x: Math.round(c.x), y: Math.round(c.y + 8) }
    };
  };
})(window.SV);
