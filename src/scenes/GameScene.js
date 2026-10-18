/*
 * GameScene — mundo aberto, jogador, coleta, combate, construções, animais,
 * clima e iluminação. A simulação de sobrevivência fica em sim.js (lógica
 * pura); esta cena cuida de entrada, física, estado do mundo e renderização.
 */
(function (SV) {
  'use strict';
  var CHUNK = 400;

  SV.Game = SV.Game || {};

  /** Estado inicial de uma partida nova (Dia 5, 15:40, chuvoso — como na referência). */
  SV.Game.defaultState = function () {
    var seed = (Math.random() * 1e9) | 0;
    var shape = SV.World.makeShape(seed);
    var c = shape.camp;
    return {
      seed: seed, day: 5, clock: 15.67, weather: { kind: 'rain', timer: 90 },
      stats: { hp: 82, food: 64, water: 58, energy: 72, wet: 0.3, temp: 26 }, bodyTemp: 36.2,
      player: { x: c.x, y: c.y + 40, dir: 'down' },
      inv: null, built: {}, mission: SV.Missions.newState(),
      // o acampamento já tem um anel de pedras pronto: falta apenas acendê-lo
      structures: [{ type: 'campfire', x: Math.round(c.x), y: Math.round(c.y + 8), fuel: 0, lit: false }],
      propState: {}, animalState: {}, equipped: 0,
      settings: { sfx: 0.85, music: 0.5, muted: false, touch: null },
      deaths: 0, timePlayed: 0
    };
  };

  var Game = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Game() { Phaser.Scene.call(this, { key: 'Game' }); },

    /* ================================================================ *
     * CRIAÇÃO                                                          *
     * ================================================================ */
    create: function (data) {
      var scene = this;
      var st = (data && data.state) || SV.Game.state || SV.Game.defaultState();
      SV.Game.state = st;
      SV.Game.scene = this;
      SV.Game.paused = false;
      this.ensureTextures();

      /* ---- mundo ---- */
      var world = SV.World.generate(st.seed);
      SV.Game.world = world;
      this.shape = world.shape;
      SV.Game.shape = world.shape;
      this.props = world.props;
      this.solids = [];
      this.grid = {};

      /* ---- inventário / simulação ---- */
      this.inv = new SV.Inventory(24);
      this.inv.load(st.inv);
      if (!st.inv) {
        this.inv.add('axe', 1); this.inv.add('spear', 1); this.inv.add('coconut', 2);
        this.inv.add('fiber', 3); this.inv.add('fruit', 2); this.inv.add('stone', 1);
      }
      SV.Game.inv = this.inv;
      this.sim = new SV.Sim(st);
      SV.Game.sim = this.sim;
      st.equipped = st.equipped || 0;

      /* ---- terreno em chunks ---- */
      this.groundLayer = this.add.layer();
      this.chunkQueue = [];
      var cols = Math.ceil(SV.World.W / CHUNK), rows = Math.ceil(SV.World.H / CHUNK), list = [];
      for (var cy = 0; cy < rows; cy++) for (var cx = 0; cx < cols; cx++) {
        list.push({ cx: cx, cy: cy, d: SV.dist(cx * CHUNK, cy * CHUNK, st.player.x, st.player.y) });
      }
      list.sort(function (a, b) { return a.d - b.d; });
      this.chunkQueue = list;
      for (var k = 0; k < 9; k++) this.buildChunk(this.chunkQueue.shift());

      /* ---- objetos do cenário ---- */
      this.propLayer = this.add.layer();
      this.canopyLayer = this.add.layer();
      this.props.forEach(function (p) { scene.spawnProp(p); });

      /* ---- água animada ---- */
      this.ripples = [];
      var rnd = SV.rng(st.seed + 5);
      for (var i = 0; i < 110; i++) {
        var rx = rnd.range(40, SV.World.W - 40);
        var ry = this.shape.shoreY(rx) - rnd.range(15, 210);
        if (this.shape.waterAt(rx, ry) <= 0) continue;
        var rKey = rnd.int(0, 2);
        var rImg = this.add.image(rx, ry, 'ripple_' + rKey).setDepth(4).setAlpha(0.55);
        rImg.ri = rKey;
        this.ripples.push(rImg);
      }

      /* ---- construções salvas ---- */
      this.structures = [];
      (st.structures || []).forEach(function (s) { scene.addStructure(s.type, s.x, s.y, s); });

      /* ---- jogador ---- */
      this.player = this.add.image(st.player.x, st.player.y, 'pl_down_idle').setOrigin(0.5, 1);
      this.playerShadow = this.add.image(st.player.x, st.player.y, 'shadow_0').setAlpha(0.7);
      this.toolSprite = this.add.image(0, 0, 'tool_axe').setOrigin(0.5, 0.85).setVisible(false);
      this.playerState = {
        dir: st.player.dir || 'down', act: 'idle', t: 0, anim: 0, flip: false,
        moving: false, running: false, dodge: 0, invuln: 0, hurt: 0, attackIdx: 0
      };
      SV.Game.player = this.player;
      SV.Game.playerState = this.playerState;

      /* ---- animais ---- */
      this.animals = [];
      this.butterflies = [];
      this.spawnAnimals(world, st);

      /* ---- chuva ---- */
      this.rainGroup = [];
      for (var r = 0; r < 220; r++) {
        var im2 = this.add.image(Math.random() * 1600, Math.random() * 900, 'rain_' + (r % 3))
          .setScrollFactor(0).setDepth(950000).setAlpha(0.55).setVisible(false);
        im2.sp = 380 + Math.random() * 260;
        this.rainGroup.push(im2);
      }
      this.splashes = [];
      for (var sp = 0; sp < 26; sp++) {
        this.splashes.push(this.add.image(0, 0, 'splash_0').setScrollFactor(0).setDepth(940000).setVisible(false));
      }
      this.splashIdx = 0;

      /* ---- iluminação / relâmpago ---- */
      if (!this.textures.exists('light')) this.textures.createCanvas('light', 240, 160);
      this.lightTex = this.textures.get('light');
      this.lightImg = this.add.image(0, 0, 'light').setDepth(990000).setScrollFactor(0).setVisible(false);
      this.flash = this.add.rectangle(0, 0, 6000, 6000, 0xffffff, 0).setDepth(960000).setScrollFactor(0);

      /* ---- entrada ---- */
      this.keys = this.input.keyboard.addKeys({
        up: 'W', down: 'S', left: 'A', right: 'D',
        up2: Phaser.Input.Keyboard.KeyCodes.UP, down2: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left2: Phaser.Input.Keyboard.KeyCodes.LEFT, right2: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        shift: Phaser.Input.Keyboard.KeyCodes.SHIFT, E: 'E', space: 'SPACE'
      });
      this.input.keyboard.on('keydown', function (ev) {
        var n = '123456'.indexOf(ev.key);
        if (n >= 0) scene.selectSlot(n);
      });
      this.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT]);

      this.input.on('pointerdown', function (ptr) {
        if (SV.Game.paused || (SV.Game.ui && SV.Game.ui.uiHot)) return;
        if (!SV.Audio.ready) { SV.Audio.init(); SV.Audio.resume(); }
        if (ptr.rightButtonDown && ptr.rightButtonDown()) return;
        if (scene.placing) scene.placeStructure();
        else scene.attack();
      });
      if (this.input.mouse) this.input.mouse.disableContextMenu();

      /* ---- câmera ---- */
      this.cameras.main.setBounds(0, 0, SV.World.W, SV.World.H);
      this.cameras.main.startFollow(this.player, false, 0.12, 0.12);
      this.cameras.main.setDeadzone(110, 80);
      this.layout();
      this.scale.on('resize', this.layout, this);

      /* ---- estado de loop ---- */
      SV.Game.touch = { x: 0, y: 0, run: false };
      this.hudTimer = 0; this.stepTimer = 0; this.birdTimer = 4; this.autosaveTimer = 0;
      if (!st.settings.touch) st.settings.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

      /* ---- UI ---- */
      this.scene.launch('Ui');
      this.syncHud();
      this.events.on('shutdown', function () { scene.save(); scene.scale.off('resize', scene.layout, scene); });
    },

    /** Texturas de partículas (criadas uma única vez). */
    ensureTextures: function () {
      if (this.textures.exists('p_leaf')) return;
      var kinds = { p_leaf: SV.PAL.leafLight, p_wood: SV.PAL.barkLight, p_stone: SV.PAL.stoneLight, p_blood: SV.PAL.fruitRed, p_spark: SV.PAL.fire1, p_water: SV.PAL.waterFoam };
      for (var k in kinds) {
        var p = new SV.P(6, 6), rnd = SV.rng(k.length);
        p.blob(3, 3, 2.4, 2, SV.hex(kinds[k]), rnd, { rough: 0.2 });
        this.textures.addCanvas(k, p.toCanvas());
      }
    },

    /** Ajusta zoom da câmera e da interface ao tamanho da janela. */
    layout: function () {
      var w = this.scale.width, h = this.scale.height;
      var z = Phaser.Math.Clamp(h / 540, 0.7, 3.2);
      var cam = this.cameras.main;
      cam.setZoom(z);
      SV.Game.zoom = z;
      SV.Game.viewW = w / z;
      SV.Game.viewH = h / z;
      /* escala da interface: limita também pela LARGURA, senão telas altas e
         estreitas (celular em retrato) recebiam um HUD de tamanho desktop */
      SV.Game.uiScale = Phaser.Math.Clamp(Math.min(h / 720, w / 900), 0.7, 1.45);
      if (SV.Game.ui) SV.Game.ui.relayout();
    },

    /* ================================================================ *
     * CENÁRIO                                                          *
     * ================================================================ */
    buildChunk: function (c) {
      if (!c) return;
      var ox = c.cx * CHUNK, oy = c.cy * CHUNK;
      var key = 'g_' + c.cx + '_' + c.cy;
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, SV.Art.groundChunk(CHUNK, ox, oy, SV.Game.state.seed, this.shape));
      }
      this.groundLayer.add(this.add.image(ox, oy, key).setOrigin(0, 0).setDepth(-10));
    },

    texFor: function (p) { return SV.World.texFor(p); },

    spawnProp: function (p) {
      var S = SV.World.TYPES[p.type];
      var tex = this.texFor(p), sc = p.scale;
      var saved = SV.Game.state.propState[p.uid];
      if (saved) { if (saved.gone) p.gone = true; if (saved.hp !== undefined) p.hp = saved.hp; }

      if (tex.solo) {
        p.img = this.propLayer.add(this.add.image(p.x, p.y, tex.solo).setOrigin(0.5, 1).setScale(sc));
      } else {
        p.img = this.propLayer.add(this.add.image(p.x, p.y, tex.trunk).setOrigin(0.5, 1).setScale(sc));
        p.cap = this.canopyLayer.add(this.add.image(p.x, p.y, tex.canopy).setOrigin(0.5, 1).setScale(sc));
        p.cap.setDepth(1e6 + p.y);
      }
      p.img.setDepth(p.y);
      p.img.setVisible(!p.gone);
      if (p.cap) p.cap.setVisible(!p.gone);

      if (p.type === 'tree' || p.type === 'palm' || p.type === 'bush' || p.type === 'bushEmpty' || p.type === 'rock') {
        p.shadow = this.propLayer.add(this.add.image(p.x, p.y - 1, p.type === 'tree' ? 'shadow_big' : 'shadow_0')
          .setOrigin(0.5, 0.5).setDepth(p.y - 2).setAlpha(p.type === 'tree' ? 0.5 : 0.38)
          .setScale(sc * (p.type === 'tree' ? 1.05 : 0.8)));
        p.shadow.setVisible(!p.gone);
      }
      if (p.solid) this.solids.push(p);
      this.indexProp(p);
      return p;
    },

    indexProp: function (p) {
      var key = ((p.x / 120) | 0) + '_' + ((p.y / 120) | 0);
      (this.grid[key] = this.grid[key] || []).push(p);
    },

    /** Objetos próximos de (x,y) usando a grade espacial de 120px. */
    nearProps: function (x, y, radius, filter) {
      var out = [], r2 = radius * radius;
      var x0 = ((x - radius) / 120) | 0, x1 = ((x + radius) / 120) | 0;
      var y0 = ((y - radius) / 120) | 0, y1 = ((y + radius) / 120) | 0;
      for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
        var arr = this.grid[gx + '_' + gy];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var p = arr[i];
          if (SV.dist2(x, y, p.x, p.y) < r2 && (!filter || filter(p))) out.push(p);
        }
      }
      return out;
    },

    /* ================================================================ *
     * FAUNA — tudo dirigido pela tabela src/data/fauna.js              *
     * ================================================================ */
    spawnAnimals: function (world, st) {
      var rnd = SV.rng(st.seed + 991), pop = SV.Fauna.population;
      this.lastFaunaDay = st.day;
      for (var kind in pop) {
        for (var i = 0; i < pop[kind]; i++) {
          var spot = this.findSpawn(kind, world, rnd);
          if (!spot) continue;
          var a = this.addAnimal(kind, spot.x, spot.y, rnd, kind + i);
          var saved = st.animalState && st.animalState[a.id];
          if (saved && saved.dead) {
            a.alive = false; a.img.setVisible(false); a.deadDay = saved.day || 1;
          }
        }
      }
      for (var b = 0; b < 10; b++) {
        var bx = rnd.range(world.camp.x - 420, world.camp.x + 420), by = rnd.range(world.camp.y - 220, world.camp.y + 320);
        if (!world.shape.walkable(bx, by)) continue;
        this.butterflies.push({ img: this.add.image(bx, by, 'butterfly_0'), x: bx, y: by, t: rnd.range(0, 6), sp: rnd.range(12, 26) });
      }
    },

    /** Ponto de nascimento coerente com o habitat e longe o bastante do acampamento. */
    findSpawn: function (kind, world, rnd) {
      var g = SV.Fauna[kind].game;
      if (g.habitat === 'air') {
        var ps = world.toucanSpots;
        if (!ps.length) return null;
        var pr = ps[(rnd.next() * ps.length) | 0];
        return { x: pr.x, y: pr.y };
      }
      for (var t = 0; t < 140; t++) {
        var x = rnd.range(90, SV.World.W - 90), shore = world.shape.shoreY(x);
        /* o rio fica ACIMA da margem: shoreY é a linha onde a água some */
        var y = g.habitat === 'water' ? shore - rnd.range(34, 110) : rnd.range(shore + 34, SV.World.H - 70);
        if (g.habitat === 'water') { if (world.shape.waterAt(x, y) < 0.3) continue; }
        else if (!world.shape.walkable(x, y)) continue;
        var dCamp = SV.dist(x, y, world.camp.x, world.camp.y);
        if (g.predator ? dCamp < 330 : dCamp < 130) continue;
        return { x: x, y: y };
      }
      return null;
    },

    addAnimal: function (kind, x, y, rnd, id) {
      var spec = SV.Fauna[kind], g = spec.game;
      var a = {
        kind: kind, id: id, spec: g, frames: spec.draw.bird ? 3 : 4,
        x: x, y: y, home: { x: x, y: y }, hp: g.hp, alive: true,
        dir: rnd.chance(0.5) ? -1 : 1, state: g.habitat === 'air' ? 'perch' : 'idle',
        timer: rnd.range(0.5, 6), anim: rnd.range(0, 4), ang: rnd.range(0, 6.283),
        hitCd: 0, prevState: '',
        img: this.add.image(x, y, kind + '_0').setOrigin(0.5, 1).setScale(g.scale || 1)
      };
      if (g.habitat === 'air') {
        a.img.setDepth(1e6 + y);
        a.perches = SV.Game.world.toucanSpots;
      } else {
        a.solid = { x: x, y: y, r: Math.round(SV.clamp(spec.draw.w * 0.26, 8, 16)), animal: a };
        this.solids.push(a.solid);
      }
      this.animals.push(a);
      return a;
    },

    /* ================================================================ *
     * LOOP PRINCIPAL                                                   *
     * ================================================================ */
    update: function (time, delta) {
      var dt = Math.min(delta, 50) / 1000;
      if (this.chunkQueue.length) this.buildChunk(this.chunkQueue.shift());
      if (SV.Game.paused) return;

      SV.Game.state.timePlayed += dt;
      this.updatePlayer(dt);
      this.updateStructures(dt);
      this.updateAnimals(dt);
      this.updateSim(dt);
      this.updateWeather(dt);
      this.updateLighting();
      this.updateAmbience(dt);

      this.hudTimer -= dt;
      if (this.hudTimer <= 0) { this.hudTimer = 0.15; this.syncHud(); }
      this.autosaveTimer += dt;
      if (this.autosaveTimer > 25) { this.autosaveTimer = 0; this.save(); }
    },

    /* ---------------------------------------------------------------- *
     * Personagem                                                       *
     * ---------------------------------------------------------------- */
    updatePlayer: function (dt) {
      var k = this.keys, ps = this.playerState, st = SV.Game.state;
      var ix = 0, iy = 0;
      if (k.left.isDown || k.left2.isDown) ix -= 1;
      if (k.right.isDown || k.right2.isDown) ix += 1;
      if (k.up.isDown || k.up2.isDown) iy -= 1;
      if (k.down.isDown || k.down2.isDown) iy += 1;
      var tc = SV.Game.touch || { x: 0, y: 0, run: false };
      ix = SV.clamp(ix + tc.x, -1, 1); iy = SV.clamp(iy + tc.y, -1, 1);

      var wantRun = (k.shift.isDown || tc.run) && (ix !== 0 || iy !== 0);
      var running = wantRun && st.stats.energy > 4 && ps.act !== 'attack' && ps.act !== 'eat';
      var speed = running ? 108 : 62;
      if (st.stats.energy <= 2) speed = 44;

      var mag = Math.hypot(ix, iy) || 1;
      var vx = (ix / mag) * speed, vy = (iy / mag) * speed * 0.9;
      if (ix === 0 && iy === 0) { vx = 0; vy = 0; }

      if (ps.act === 'attack' || ps.act === 'eat') {
        ps.t -= dt;
        if (ps.t <= 0) ps.act = 'idle';
        vx *= 0.25; vy *= 0.25;
      }
      if (ps.dodge > 0) { ps.dodge -= dt; vx *= 2.3; vy *= 2.3; }
      ps.invuln = Math.max(0, ps.invuln - dt);
      ps.hurt = Math.max(0, ps.hurt - dt);
      if (ps.act === 'hurt' && ps.hurt <= 0) ps.act = 'idle';

      var moved = this.movePlayer(this.player.x + vx * dt, this.player.y + vy * dt);
      ps.moving = moved && (ix !== 0 || iy !== 0);
      ps.running = running && ps.moving;

      if (ps.moving) {
        if (Math.abs(iy) > Math.abs(ix) * 1.05) ps.dir = iy < 0 ? 'up' : 'down';
        else { ps.dir = 'side'; ps.flip = ix < 0; }
      }
      if (ps.act !== 'attack' && ps.act !== 'eat' && ps.act !== 'hurt') {
        ps.act = ps.moving ? (running ? 'run' : 'walk') : 'idle';
      }
      ps.anim += dt * (ps.act === 'run' ? 11 : 7);
      this.renderPlayer();

      if (ps.moving) {
        this.stepTimer -= dt * (running ? 1.75 : 1);
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.36;
          var dirt = this.shape.dirtAt(this.player.x, this.player.y);
          var sand = this.shape.sandAt(this.player.x, this.player.y);
          SV.Audio.play('step', dirt > 0.3 ? 'mud' : (sand > 0.3 ? 'stone' : 'grass'));
        }
      }
      var inWater = this.shape.waterAt(this.player.x, this.player.y + 2) > 0.05;
      if (inWater && !ps._inWater) SV.Audio.play('splash');
      ps._inWater = inWater;

      this.updateInteraction();

      if (Phaser.Input.Keyboard.JustDown(k.E)) this.interact();
      if (Phaser.Input.Keyboard.JustDown(k.space)) this.dodge();
    },

    renderPlayer: function () {
      var ps = this.playerState;
      var name;
      if (ps.act === 'attack') {
        var t = 1 - SV.clamp(ps.t / 0.32, 0, 1);
        name = 'pl_' + ps.dir + '_attack' + (t < 0.45 ? 0 : 1);
      } else if (ps.act === 'eat' || ps.act === 'hurt') name = 'pl_' + ps.dir + '_' + ps.act;
      else if (ps.act === 'idle') name = 'pl_' + ps.dir + '_idle';
      else name = 'pl_' + ps.dir + '_' + ps.act + (Math.floor(ps.anim) % 4);
      if (!this.textures.exists(name)) name = 'pl_' + ps.dir + '_idle';
      if (this.player.texture.key !== name) this.player.setTexture(name);

      this.player.setDepth(ps.dir === 'up' ? this.player.y - 0.5 : this.player.y);
      this.player.setFlipX(!!ps.flip && ps.dir === 'side');
      this.player.setAlpha(ps.invuln > 0 && Math.floor(this.time.now / 70) % 2 ? 0.45 : 1);
      this.playerShadow.setPosition(this.player.x, this.player.y - 1).setDepth(this.player.y - 3);
      this.updateToolSprite(name);
    },

    /** Ferramenta segurada na mão do personagem, girando no golpe. */
    updateToolSprite: function (frameName) {
      var st = SV.Game.state, ps = this.playerState;
      var slot = this.inv.slot(st.equipped);
      var def = slot && SV.Items.get(slot.id);
      var tex = def && def.tool === 'axe' ? 'tool_axe' : def && def.tool === 'spear' ? 'tool_spear'
        : def && def.tool === 'torch' ? 'tool_torch' : def && def.tool === 'container' ? 'tool_spear' : null;
      if (!tex) { this.toolSprite.setVisible(false); return; }
      if (this.toolSprite.texture.key !== tex) this.toolSprite.setTexture(tex);
      this.toolSprite.setVisible(true);

      var f = SV.playerFrames[frameName] || SV.playerFrames['pl_' + ps.dir + '_idle'];
      var hand = f ? f.hand : [16, 18];
      var flip = ps.dir === 'side' && ps.flip;
      var w = this.player.width;
      var hx = this.player.x + (flip ? w / 2 - hand[0] : hand[0] - w / 2);
      var hy = this.player.y - this.player.height + hand[1];
      var ang = 0;
      if (ps.act === 'attack') {
        var t = 1 - SV.clamp(ps.t / 0.32, 0, 1);
        ang = SV.lerp(-1.7, 0.8, SV.smoothstep(t)) * (flip ? -1 : 1);
      } else if (tex === 'tool_axe') ang = flip ? 0.3 : -0.3;
      this.toolSprite.setPosition(hx, hy).setRotation(ang).setFlipX(flip)
        .setDepth(this.player.y + 0.5).setScale(0.8);
    },

    /** Move o jogador resolvendo colisões com sólidos, água e bordas. */
    movePlayer: function (nx, ny) {
      var ox = this.player.x, oy = this.player.y;
      nx = SV.clamp(nx, 24, SV.World.W - 24);
      ny = SV.clamp(ny, 24, SV.World.H - 16);

      if (this.shape.waterAt(nx, ny) > 0.32) {
        var okX = this.shape.waterAt(nx, oy) <= 0.32;
        var okY = this.shape.waterAt(ox, ny) <= 0.32;
        if (okX) ny = oy; else if (okY) nx = ox; else { nx = ox; ny = oy; }
      }
      var r = 7;
      for (var i = 0; i < this.solids.length; i++) {
        var s = this.solids[i];
        if (Math.abs(s.x - nx) > 120 || Math.abs(s.y - ny) > 120) continue;
        var rr = (s.r || 10) + r;
        var dx = nx - s.x, dy = (ny - s.y) * 0.85;
        var d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.0001) {
          var push = (rr - Math.sqrt(d2)) / Math.sqrt(d2);
          nx += dx * push; ny += (dy * push) / 0.85;
        }
      }
      nx = SV.clamp(nx, 24, SV.World.W - 24);
      ny = SV.clamp(ny, 24, SV.World.H - 16);
      this.player.setPosition(nx, ny);
      return Math.abs(nx - ox) > 0.05 || Math.abs(ny - oy) > 0.05;
    },

    /* ---------------------------------------------------------------- *
     * Ações                                                            *
     * ---------------------------------------------------------------- */
    selectSlot: function (i) {
      if (i < 0 || i >= this.inv.hotbar) return;
      SV.Game.state.equipped = i;
      SV.Audio.play('ui');
      this.syncHud();
    },

    equippedDef: function () {
      var slot = this.inv.slot(SV.Game.state.equipped);
      return slot ? SV.Items.get(slot.id) : null;
    },

    /** Clique esquerdo / botão de ataque. */
    attack: function () {
      var ps = this.playerState, st = SV.Game.state;
      if (ps.act === 'attack') return;
      if (this.placing) { this.placeStructure(); return; }
      var def = this.equippedDef();
      var kind = def && def.tool;
      if (kind === 'container') { this.fillContainer(); return; }

      ps.act = 'attack'; ps.t = 0.32;
      st.stats.energy = SV.clamp(st.stats.energy - (kind === 'axe' ? 1.7 : 1.1), 0, 100);

      if (kind === 'spear') {
        var hit = this.meleeAnimal(52);
        if (hit) this.woundAnimal(hit, 1.5);
        else SV.Audio.play('hit');
        this.damageTool(1);
        return;
      }
      if (kind === 'axe') {
        var target = this.bestTarget();
        if (target) this.chop(target);
        else { SV.Audio.play('hit'); this.damageTool(0.35); }
        return;
      }
      var a = this.meleeAnimal(32);
      if (a) this.woundAnimal(a, 0.5);
      SV.Audio.play('hit');
      st.stats.energy = SV.clamp(st.stats.energy - 0.6, 0, 100);
    },

    /** Dano do jogador num animal: presa foge, predador recua assustado. */
    woundAnimal: function (a, dmg) {
      a.hp -= dmg;
      this.particles(a.x, a.y - 8, 'p_blood', 8);
      if (a.hp <= 0) { this.killAnimal(a); return; }
      a.state = 'flee';
      a.timer = a.spec.predator ? 2.6 : 6;
      a.fleeFrom = { x: this.player.x, y: this.player.y };
      if (a.spec.sound) SV.Audio.play(a.spec.sound);
    },

    bestTarget: function () {
      var list = this.nearProps(this.player.x, this.player.y - 4, 54, function (p) {
        return !p.gone && p.hp > 0 && p.type !== 'lily' && p.type !== 'reeds';
      });
      var best = null, bd = 1e9;
      for (var i = 0; i < list.length; i++) {
        var d = SV.dist(this.player.x, this.player.y, list[i].x, list[i].y);
        if (d < bd) { bd = d; best = list[i]; }
      }
      return best;
    },

    chop: function (p) {
      var S = SV.World.TYPES[p.type];
      var def = this.equippedDef();
      var kind = def && def.tool;
      if (S.tool && kind !== S.tool) {
        this.toast('Você precisa de um ' + (S.tool === 'axe' ? 'machado' : 'ferramenta') + ' para coletar ' + SV.Items.name(p.yield).toLowerCase() + '.', '#ffd27f');
        return;
      }
      var power = def && def.tier === 2 ? 2 : 1;
      p.hp -= power;
      SV.Game.state.propState[p.uid] = { hp: p.hp };
      SV.Audio.play('chop');
      this.shakeProp(p);
      this.particles(p.x, p.y - 14, (p.type === 'rock' || p.type === 'stone') ? 'p_stone' : 'p_wood', 6);
      this.damageTool(power);
      var got = this.give(p.yield, 1);
      if (got > 0) this.countResource(p.yield, got);
      if (p.hp <= 0) this.depleteProp(p);
    },

    damageTool: function (n) {
      var i = SV.Game.state.equipped;
      var slot = this.inv.slot(i);
      if (!slot) return;
      var r = this.inv.damageTool(i, n);
      if (r === 'broken') {
        this.toast('Sua ' + SV.Items.name(slot.id).toLowerCase() + ' quebrou!', '#ff8a6a');
        SV.Audio.play('hurt');
      }
      this.syncHud();
    },

    depleteProp: function (p) {
      p.gone = true; p.hp = 0;
      if (p.img) p.img.setVisible(false);
      if (p.cap) p.cap.setVisible(false);
      if (p.shadow) p.shadow.setVisible(false);
      SV.Game.state.propState[p.uid] = { hp: 0, gone: 1, t: p.type === 'tree' ? 240 : 90 };
      this.solids = this.solids.filter(function (s) { return s !== p; });
      this.particles(p.x, p.y - 8, 'p_leaf', 8);
    },

    /** Tecla E: coletar, interagir com estrutura ou encher cantil. */
    interact: function () {
      if (this.placing) { this.placeStructure(); return; }
      var t = this.interactTarget;
      if (!t) {
        var slot = this.inv.slot(SV.Game.state.equipped);
        if (slot && SV.Items.get(slot.id).type === 'consumable') this.consumeSlot(SV.Game.state.equipped);
        return;
      }
      if (t.kind === 'structure') { this.useStructure(t.obj); return; }
      if (t.kind === 'water') { this.fillContainer(); return; }

      var p = t.prop, S = SV.World.TYPES[p.type];
      if (S.tool) { this.chop(p); return; }
      var got = this.give(p.yield, p.qty || 1);
      if (got <= 0) { this.toast('Mochila cheia!', '#ff8a6a'); return; }
      this.countResource(p.yield, got);
      SV.Audio.play('pick');
      this.particles(p.x, p.y - 8, 'p_spark', 6);
      this.toast('+' + got + ' ' + SV.Items.name(p.yield), '#bfe8ff');
      SV.Game.state.stats.energy = SV.clamp(SV.Game.state.stats.energy - 0.8, 0, 100);
      this.depleteProp(p);
    },

    give: function (id, n) {
      if (!id) return 0;
      var got = this.inv.add(id, n);
      if (got > 0) this.syncHud();
      return got;
    },

    countResource: function (id, n) {
      var m = SV.Game.state.mission, cur = SV.Missions.current(m);
      if (cur && cur.goal && cur.goal[id]) {
        if (SV.Missions.progress(m, id, n)) this.onMissionComplete();
      }
    },

    onMissionComplete: function () {
      var idx = SV.Game.state.mission.index;
      var done = SV.Missions[idx - 1];
      SV.Audio.play('levelup');
      if (done) this.toast('Missão concluída: ' + done.title, '#8affb0');
      var next = SV.Missions.current(SV.Game.state.mission);
      if (next && next.reward) this.toast(next.reward, '#bfe8ff');
      this.save();
      this.syncHud();
    },

    consumeSlot: function (i) {
      var slot = this.inv.slot(i);
      if (!slot) return;
      var d = SV.Items.get(slot.id);
      if (!d || d.type !== 'consumable') { this.toast('Isto não é comestível.', '#ffd27f'); return; }
      var st = SV.Game.state.stats;
      st.food = SV.clamp(st.food + (d.food || 0), 0, 100);
      st.water = SV.clamp(st.water + (d.water || 0), 0, 100);
      st.energy = SV.clamp(st.energy + (d.energy || 0), 0, 100);
      st.hp = SV.clamp(st.hp + (d.hp || 0), 0, 100);
      if (d.risk && Math.random() < d.risk) {
        st.hp = SV.clamp(st.hp - 8, 0, 100);
        this.playerState.act = 'hurt'; this.playerState.t = 0.5;
        this.toast('Aquilo fez mal à sua barriga...', '#ff8a6a');
        SV.Audio.play('hurt');
      } else {
        this.toast((d.water > d.food ? 'Você bebeu ' : 'Você comeu ') + d.name.toLowerCase() + '.', '#bfe8ff');
        SV.Audio.play(d.water > d.food ? 'drink' : 'eat');
      }
      if (slot.id === 'clean_water') this.missionEvent('cleanWater', 1);
      if (slot.id === 'cooked_meat') this.missionEvent('cookedMeal', 1);
      slot.n -= 1;
      if (slot.n <= 0) this.inv.slots[i] = null;
      this.syncHud();
    },

    /** Há água a até `rad` px do jogador (para encher o cantil na margem). */
    nearWater: function (rad) {
      var px = this.player.x, py = this.player.y;
      for (var a = 0; a < 8; a++) {
        var ang = a * Math.PI / 4;
        if (this.shape.waterAt(px + Math.cos(ang) * rad, py + Math.sin(ang) * rad) > 0.02) return true;
      }
      return false;
    },

    dodge: function () {      var ps = this.playerState, st = SV.Game.state;
      if (ps.dodge > 0 || st.stats.energy < 8) return;
      ps.dodge = 0.26; ps.invuln = 0.45;
      st.stats.energy = SV.clamp(st.stats.energy - 6, 0, 100);
      SV.Audio.play('step', 'grass');
    },

    /* ---------------------------------------------------------------- *
     * Alvo de interação (mensagem contextual)                          *
     * ---------------------------------------------------------------- */
    updateInteraction: function () {
      var px = this.player.x, py = this.player.y, best = null, bd = 52;
      var list = this.nearProps(px, py - 4, 66, function (p) {
        return !p.gone && p.hp > 0 && SV.World.TYPES[p.type].yield && p.type !== 'lily' && p.type !== 'reeds';
      });
      for (var i = 0; i < list.length; i++) {
        var d = SV.dist(px, py, list[i].x, list[i].y);
        if (d < bd) { bd = d; best = { kind: 'prop', prop: list[i] }; }
      }
      for (var s = 0; s < this.structures.length; s++) {
        var so = this.structures[s];
        var ds = SV.dist(px, py, so.x, so.y + (so.promptY || 0));
        if (ds < (so.radius || 44) && ds < bd) { bd = ds; best = { kind: 'structure', obj: so }; }
      }
      var def = this.equippedDef();
      if (def && def.tool === 'container' && !this.placing) {
        var ps = this.playerState;
        var fx = px + (ps.dir === 'side' ? (ps.flip ? -28 : 28) : 0), fy = py + (ps.dir === 'up' ? -28 : ps.dir === 'down' ? 28 : 10);
        // encostar na água vale mais que a margem próxima; mas nunca tapa uma construção ao lado
        var dw = (this.shape.waterAt(fx, fy) > 0.02 || this.shape.waterAt(px, py + 10) > 0.02)
          ? 0 : (this.nearWater(46) ? 46 : Infinity);
        if (dw < bd) { bd = dw; best = { kind: 'water' }; }
      }
      this.interactTarget = best;

      var text = '';
      if (best) {
        if (best.kind === 'prop') {
          var p2 = best.prop, S = SV.World.TYPES[p2.type];
          text = S.tool ? 'Use o clique (machado) para coletar ' + SV.Items.name(p2.yield).toLowerCase()
            : 'Pressione E para coletar ' + SV.Items.name(p2.yield).toLowerCase();
        } else if (best.kind === 'water') text = 'Pressione E para encher o cantil na água';
        else text = best.obj.promptText || 'Pressione E';
      }
      if (this.placing) text = 'Clique ou E para posicionar · C cancela';
      if (text !== this._prompt) { this._prompt = text; if (SV.Game.ui) SV.Game.ui.setPrompt(text); }

      var hl = best && best.kind === 'prop' ? best.prop : null;
      if (this.hlProp !== hl) {
        if (this.hlProp && this.hlProp.img) this.hlProp.img.setTint(0xffffff);
        this.hlProp = hl;
        if (hl && hl.img) hl.img.setTint(0xd8ffe0);
      }
    },

    /* ---------------------------------------------------------------- *
     * Simulação e eventos                                              *
     * ---------------------------------------------------------------- */
    updateSim: function (dt) {
      var st = SV.Game.state;
      st.stats.temp = this.sim.ambientTemp();
      var evs = this.sim.update(dt, {
        moving: this.playerState.moving, running: this.playerState.running,
        nearFire: this.nearFire(), inShelter: this.nearShelter(),
        inWater: this.shape.waterAt(this.player.x, this.player.y + 2) > 0.05
      });
      for (var i = 0; i < evs.length; i++) {
        var e = evs[i];
        if (e.t === 'thunder') this.thunder();
        else if (e.t === 'warn') this.toast(e.msg, '#ffd27f');
        else if (e.t === 'dawn') { this.toast('Amanheceu. Dia ' + st.day + '.', '#8affb0'); this.missionEvent('dawn', 1); this.save(); }
        else if (e.t === 'dusk') this.toast('A noite cai. Mantenha o fogo aceso.', '#bfe8ff');
        else if (e.t === 'weather') this.toast('O tempo mudou: ' + SV.WEATHER[e.kind].label.toLowerCase() + '.', '#bfe8ff');
        else if (e.t === 'death') this.die();
      }
    },

    missionEvent: function (key, n) {
      var m = SV.Game.state.mission, cur = SV.Missions.current(m);
      if (cur && cur.goal && cur.goal[key]) {
        if (SV.Missions.progress(m, key, n || 1)) this.onMissionComplete();
      }
    },

    nearFire: function () {
      for (var i = 0; i < this.structures.length; i++) {
        var s = this.structures[i];
        if (s.type === 'campfire' && s.lit && s.fuel > 0 && SV.dist(this.player.x, this.player.y, s.x, s.y) < 95) return true;
      }
      return false;
    },
    nearShelter: function () {
      for (var i = 0; i < this.structures.length; i++) {
        var s = this.structures[i];
        if (s.type === 'shelter' && SV.dist(this.player.x, this.player.y, s.x, s.y) < 60) return true;
      }
      return false;
    },

    thunder: function () {
      SV.Audio.play('thunder');
      var f = this.flash;
      f.setAlpha(0.5);
      this.tweens.add({ targets: f, alpha: 0, duration: 750, ease: 'Sine.easeOut' });
    },

    die: function () {
      if (this._dying) return;
      this._dying = true;
      SV.Audio.play('death');
      SV.Game.state.deaths++;
      this.save();
      if (SV.Game.ui) SV.Game.ui.showDeath();
    },

    respawn: function () {
      var st = SV.Game.state;
      st.stats.hp = 58; st.stats.food = Math.max(35, st.stats.food); st.stats.water = Math.max(35, st.stats.water);
      st.stats.energy = 65; st.bodyTemp = 36.2; st.stats.wet = 0;
      st.clock = 8; st.weather.kind = 'clear'; st.weather.timer = 120;
      this.player.setPosition(SV.Game.world.camp.x, SV.Game.world.camp.y + 30);
      this._dying = false;
      if (SV.Game.ui) SV.Game.ui.hideDeath();
      this.toast('Você acordou perto do acampamento.', '#bfe8ff');
      this.save();
    },

    /* ---------------------------------------------------------------- *
     * Clima visual                                                     *
     * ---------------------------------------------------------------- */
    updateWeather: function (dt) {
      var w = this.sim.weatherDef();
      var count = Math.round(this.rainGroup.length * w.rain);
      var vw = SV.Game.viewW, vh = SV.Game.viewH;
      for (var i = 0; i < this.rainGroup.length; i++) {
        var d = this.rainGroup[i];
        if (i >= count) { d.setVisible(false); continue; }
        d.setVisible(true);
        d.y += d.sp * dt;
        d.x -= d.sp * 0.3 * dt;
        if (d.y > vh + 20) {
          d.y = -20 - Math.random() * 80;
          d.x = Math.random() * (vw + 220) - 80;
          if (Math.random() < 0.3) {
            var sp = this.splashes[this.splashIdx++ % this.splashes.length];
            sp.setPosition(d.x, vh - 30 - Math.random() * 150).setVisible(true).setAlpha(0.85).setScale(1);
            this.tweens.add({ targets: sp, alpha: 0, scale: 1.9, duration: 300, onComplete: function () { sp.setVisible(false); } });
          }
        }
        if (d.x < -30) d.x = vw + 20;
      }
      for (var r = 0; r < this.ripples.length; r++) {
        var ri = this.ripples[r];
        if (Math.random() < dt * 1.2) { ri.ri = (ri.ri + 1) % 3; ri.setTexture('ripple_' + ri.ri); }
      }
    },

    /* ---------------------------------------------------------------- *
     * Iluminação dinâmica (noite, chuva, fogueira, tocha)              *
     * ---------------------------------------------------------------- */
    updateLighting: function () {
      var dark = this.sim.darkness();
      var w = this.sim.weatherDef();
      if (w.light < 0) dark = Math.max(dark, -w.light * 0.8);
      if (dark < 0.02) { this.lightImg.setVisible(false); return; }
      this.lightImg.setVisible(true).setPosition(0, 0).setOrigin(0, 0)
        .setDisplaySize(SV.Game.viewW, SV.Game.viewH);

      var tex = this.lightTex, ctx = tex.getContext();
      var tw = tex.width, th = tex.height;
      var view = this.cameras.main.worldView;
      var sx = tw / view.width, sy = th / view.height;
      /* a escala pode sair não-finita durante um resize (janela com altura 0 no
         celular); um NaN aqui estoura no createRadialGradient e derruba o loop */
      if (!isFinite(sx) || !isFinite(sy) || sx <= 0 || sy <= 0) return;

      ctx.clearRect(0, 0, tw, th);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(' + (dark > 0.5 ? '8,14,42' : '26,32,46') + ',' + (dark * 0.86).toFixed(3) + ')';
      ctx.fillRect(0, 0, tw, th);

      var lights = this.lightList();
      ctx.globalCompositeOperation = 'destination-out';
      for (var i = 0; i < lights.length; i++) {
        var L = lights[i];
        var u = (L.x - view.x) * sx, v = (L.y - view.y) * sy, rr = L.r * sx;
        if (!isFinite(u) || !isFinite(v) || !isFinite(rr) || rr <= 0) continue;
        var g = ctx.createRadialGradient(u, v, 0, u, v, rr);
        g.addColorStop(0, 'rgba(0,0,0,' + Math.min(1, L.i) + ')');
        g.addColorStop(0.5, 'rgba(0,0,0,' + (Math.min(1, L.i) * 0.6).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(u - rr, v - rr, rr * 2, rr * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (var j = 0; j < lights.length; j++) {
        var L2 = lights[j];
        if (!L2.warm) continue;
        var u2 = (L2.x - view.x) * sx, v2 = (L2.y - view.y) * sy, rr2 = L2.r * sx;
        if (!isFinite(u2) || !isFinite(v2) || !isFinite(rr2) || rr2 <= 0) continue;
        var g2 = ctx.createRadialGradient(u2, v2, 0, u2, v2, rr2);
        g2.addColorStop(0, 'rgba(255,150,60,' + (0.25 * dark).toFixed(3) + ')');
        g2.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(u2 - rr2, v2 - rr2, rr2 * 2, rr2 * 2);
      }
      tex.refresh();
    },

    /** Fontes de luz dinâmica (fogueiras acesas e tochas equipadas). */
    lightList: function () {
      var out = [];
      for (var i = 0; i < this.structures.length; i++) {
        var s = this.structures[i];
        if (s.type === 'campfire' && s.lit && s.fuel > 0) {
          out.push({ x: s.x, y: s.y - 12, r: 140 + Math.sin(this.time.now / 220) * 10 + Math.min(40, s.fuel * 0.2), i: 1, warm: true });
        }
      }
      var slot = this.inv.slot(SV.Game.state.equipped);
      if (slot && slot.lit && SV.Items.get(slot.id).tool === 'torch') {
        out.push({ x: this.player.x, y: this.player.y - 16, r: 120, i: 0.95, warm: true });
      }
      /* luar fraco em volta do personagem: sem isso a noite fica 100% escura
         e não dá para ver nem o próprio boneco */
      out.push({ x: this.player.x, y: this.player.y - 14, r: 104, i: 0.46, warm: false });
      return out;
    },

    updateAmbience: function (dt) {
      var w = this.sim.weatherDef();
      SV.Audio.setAmbience({ rain: w.rain, fire: this.nearFire() ? 1 : 0, night: this.sim.darkness() });
      SV.Audio.musicTick(dt, this.sim.darkness() > 0.5);
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 6 + Math.random() * 14;
        if (this.sim.darkness() < 0.5) SV.Audio.play(Math.random() < 0.7 ? 'bird' : 'toucan');
      }
    },

    /* ---------------------------------------------------------------- *
     * Construções                                                      *
     * ---------------------------------------------------------------- */
    addStructure: function (type, x, y, saved) {
      var s = { type: type, x: x, y: y, fuel: saved ? (saved.fuel || 0) : 0, lit: saved ? !!saved.lit : false };
      if (type === 'campfire') {
        s.img = this.add.image(x, y, 'firePit_0').setOrigin(0.5, 0.8).setDepth(y);
        s.flame = this.add.image(x, y - 6, 'flame_0').setOrigin(0.5, 1).setDepth(y + 1).setVisible(false);
        s.radius = 42; s.promptY = -6;
      } else if (type === 'shelter') {
        s.img = this.add.image(x, y, 'shelter_0').setOrigin(0.5, 0.95).setDepth(y - 30);
        s.radius = 56; s.promptY = -24;
        this.solids.push({ x: x, y: y - 12, r: 26, structure: s });
      } else if (type === 'wall') {
        s.img = this.add.image(x, y, 'wall_0').setOrigin(0.5, 0.95).setDepth(y);
        s.radius = 30;
        this.solids.push({ x: x, y: y - 14, r: 15, structure: s });
      } else {
        s.img = this.add.image(x, y, 'bed_0').setOrigin(0.5, 0.9).setDepth(y);
        s.radius = 36;
      }
      s.promptText = 'Pressione E';
      this.updateStructurePrompt(s);
      this.structures.push(s);
      if (type !== 'campfire') SV.Game.state.built[type] = true;
      return s;
    },

    updateStructures: function (dt) {
      for (var i = 0; i < this.structures.length; i++) {
        var s = this.structures[i];
        if (s.type !== 'campfire') continue;
        if (s.lit) {
          s.fuel -= dt;
          if (s.fuel <= 0) {
            s.fuel = 0; s.lit = false; s.flame.setVisible(false);
            this.toast('A fogueira apagou.', '#ffd27f');
            this.updateStructurePrompt(s);
          } else {
            s.flame.setVisible(true).setTexture('flame_' + (Math.floor(this.time.now / 90) % 5))
              .setScale(1 + Math.sin(this.time.now / 300) * 0.07);
            this.smokeTick(s, dt);
          }
        }
        if (SV.dist(this.player.x, this.player.y, s.x, s.y) < 130) this.updateStructurePrompt(s);
      }
      // respawn de recursos coletados
      var ps = SV.Game.state.propState;
      for (var uid in ps) {
        var e = ps[uid];
        if (!e.gone) continue;
        e.t = (e.t || 0) - dt;
        if (e.t > 0) continue;
        var p = this.props[uid];
        if (p) {
          p.gone = false; p.hp = SV.World.TYPES[p.type].hp;
          if (p.img) p.img.setVisible(true);
          if (p.cap) p.cap.setVisible(true);
          if (p.shadow) p.shadow.setVisible(true);
          if (p.solid) this.solids.push(p);
          this.particles(p.x, p.y - 6, 'p_leaf', 5);
        }
        delete ps[uid];
      }
    },

    smokeTick: function (s, dt) {
      this._smokeT = (this._smokeT || 0) - dt;
      if (this._smokeT > 0) return;
      this._smokeT = 0.32;
      var drift = this.sim.weatherDef().rain > 0 ? -22 : -12;
      var im = this.add.image(s.x + Phaser.Math.Between(-3, 3), s.y - 16, 'smoke_0')
        .setDepth(1e6 + s.y).setAlpha(0.5).setScale(0.7);
      this.tweens.add({
        targets: im, y: im.y - 80, x: im.x + drift, alpha: 0, scale: 2.5,
        duration: 3200, ease: 'Sine.easeOut',
        onComplete: function () { im.destroy(); }
      });
    },

    updateStructurePrompt: function (s) {
      if (s.type === 'campfire') {
        if (!s.lit) s.promptText = 'Pressione E para acender a fogueira (1 graveto ou fibra)';
        else if (this.inv.count('wood') > 0) s.promptText = 'Pressione E para alimentar o fogo (Madeira)';
        else s.promptText = 'Fogueira acesa — cozinhe com C';
      } else if (s.type === 'shelter') s.promptText = 'Pressione E para descansar no abrigo';
      else if (s.type === 'bed') s.promptText = this.sim.darkness() > 0.35 ? 'Pressione E para dormir até o amanhecer' : 'Cama de folhas — use durante a noite';
      else if (s.type === 'wall') s.promptText = 'Pressione E para desmontar a barreira';
    },

    useStructure: function (s) {
      var st = SV.Game.state;
      if (s.type === 'campfire') {
        var ti = this.inv.findTool('torch');
        if (!s.lit) {
          if (this.inv.remove('branch', 1) || this.inv.remove('fiber', 1)) {
            s.lit = true; s.fuel = 75;
            SV.Audio.play('fireLight');
            this.toast('Você acendeu a fogueira!', '#ffb02e');
            st.built.campfire = true;
            this.missionEvent('campfireLit', 1);
            this.save();
          } else this.toast('Precisa de 1 graveto ou fibra para acender.', '#ffd27f');
        } else {
          if (this.inv.count('wood') > 0) {
            this.inv.remove('wood', 1);
            s.fuel = Math.min(260, s.fuel + 55);
            SV.Audio.play('build');
            this.toast('Lenha adicionada ao fogo.', '#ffb02e');
          }
          if (ti >= 0 && !this.inv.slot(ti).lit) {
            this.inv.slot(ti).lit = true;
            this.toast('Tocha acesa no fogo.', '#ffb02e');
          }
        }
        this.updateStructurePrompt(s);
        this.syncHud();
      } else if (s.type === 'shelter') this.rest();
      else if (s.type === 'bed') { if (this.sim.darkness() > 0.3) this.sleep(); else this.toast('Ainda é cedo para dormir.', '#bfe8ff'); }
      else if (s.type === 'wall') this.removeStructure(s);
    },

    /** Descanso curto no abrigo: recupera energia e passa um pouco do tempo. */
    rest: function () {
      var st = SV.Game.state;
      if (st.stats.energy > 96) { this.toast('Você não está cansado.', '#bfe8ff'); return; }
      st.stats.energy = SV.clamp(st.stats.energy + 45, 0, 100);
      st.stats.food = SV.clamp(st.stats.food - 4, 0, 100);
      st.stats.water = SV.clamp(st.stats.water - 3, 0, 100);
      this.sim.s.clock += 90 / SV.Sim.DAY_SECONDS * 24;
      SV.Audio.play('ui');
      this.toast('Você descansou ao abrigo da chuva.', '#8affb0');
    },

    sleep: function () {
      var self = this, st = SV.Game.state;
      SV.Game.paused = true;
      this.cameras.main.fadeOut(900, 6, 10, 22);
      this.time.delayedCall(950, function () {
        st.clock = 6.5;
        st.stats.energy = 100;
        st.stats.food = SV.clamp(st.stats.food - 14, 0, 100);
        st.stats.water = SV.clamp(st.stats.water - 12, 0, 100);
        st.bodyTemp = 36.4;
        self.cameras.main.fadeIn(900, 6, 10, 22);
        SV.Game.paused = false;
        self.toast('Você dormiu até o amanhecer.', '#8affb0');
        self.save();
      });
    },

    removeStructure: function (s) {
      var idx = this.structures.indexOf(s);
      if (idx >= 0) this.structures.splice(idx, 1);
      if (s.img) s.img.destroy();
      if (s.flame) s.flame.destroy();
      this.solids = this.solids.filter(function (o) { return o.structure !== s; });
      this.toast('Estrutura desmontada.', '#bfe8ff');
    },

    /* ---------------------------------------------------------------- *
     * Posicionamento de construções                                    *
     * ---------------------------------------------------------------- */
    beginPlace: function (slotIndex, type) {
      var tex = type === 'campfire' ? 'firePit_0' : type === 'shelter' ? 'shelter_0' : type === 'bed' ? 'bed_0' : 'wall_0';
      this.placing = { slot: slotIndex, type: type };
      this.ghost = this.add.image(this.player.x, this.player.y + 34, tex).setOrigin(0.5, 0.9).setAlpha(0.6).setDepth(1e6);
      this.input.on('pointermove', this.moveGhost, this);
      if (SV.Game.ui) SV.Game.ui.setPrompt('Clique ou E para posicionar · C cancela');
    },

    moveGhost: function (ptr) {
      if (!this.ghost) return;
      var wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.ghost.setPosition(wp.x, wp.y);
      this.ghost.setTint(this.canPlace(wp.x, wp.y) ? 0x9fe8a0 : 0xff8080);
    },

    canPlace: function (x, y) {
      if (this.shape.waterAt(x, y) > 0.02) return false;
      if (x < 40 || y < 60 || x > SV.World.W - 40 || y > SV.World.H - 24) return false;
      if (this.nearProps(x, y, 34, function (p) { return !p.gone && (p.solid || p.hp > 0); }).length) return false;
      for (var i = 0; i < this.structures.length; i++) {
        if (SV.dist(x, y, this.structures[i].x, this.structures[i].y) < 46) return false;
      }
      return true;
    },

    placeStructure: function () {
      var pl = this.placing;
      if (!pl) return;
      var x = this.ghost.x, y = this.ghost.y;
      if (!this.canPlace(x, y)) { this.toast('Não há espaço livre aqui.', '#ff8a6a'); SV.Audio.play('hurt'); return; }
      var slot = this.inv.slot(pl.slot);
      if (!slot) { this.cancelPlace(); return; }
      slot.n -= 1;
      if (slot.n <= 0) this.inv.slots[pl.slot] = null;
      this.addStructure(pl.type, x, y);
      SV.Audio.play('build');
      this.toast(SV.Items.name(pl.type) + ' construído!', '#8affb0');
      if (pl.type === 'shelter') this.missionEvent('shelter', 1);
      if (pl.type === 'campfire') this.missionEvent('campfireBuilt', 1);
      this.cancelPlace();
      this.syncHud();
      this.save();
    },

    cancelPlace: function () {
      this.placing = null;
      if (this.ghost) { this.ghost.destroy(); this.ghost = null; }
      this.input.off('pointermove', this.moveGhost, this);
      if (SV.Game.ui) SV.Game.ui.setPrompt('');
    },

    fillContainer: function () {
      var def = this.equippedDef();
      if (!def || def.tool !== 'container') { this.toast('Equipe o cantil para pegar água.', '#ffd27f'); return; }
      if (this.give('dirty_water', 1) > 0) {
        SV.Audio.play('drink');
        this.toast('Cantil cheio com água do rio. Ferva antes de beber!', '#9fd4ff');
      }
    },

    /* ---------------------------------------------------------------- *
     * IA da fauna                                                      *
     * ---------------------------------------------------------------- */
    updateAnimals: function (dt) {
      var dark = this.sim.darkness();
      var night = dark > 0.5;
      for (var i = 0; i < this.animals.length; i++) {
        var a = this.animals[i];
        if (!a.alive) continue;
        if (a.spec.habitat === 'air') this.updateBird(a, dt, dark);
        else if (a.spec.predator) this.updatePredator(a, dt, night);
        else this.updatePrey(a, dt, night);
      }
      for (var b = 0; b < this.butterflies.length; b++) {
        var f = this.butterflies[b];
        if (night) { f.img.setVisible(false); continue; }
        f.t += dt;
        f.x += Math.cos(f.t * 0.9) * f.sp * dt;
        f.y += Math.sin(f.t * 1.7) * f.sp * dt * 0.6;
        f.img.setVisible(true).setPosition(f.x, f.y - 14 + Math.sin(f.t * 3) * 4);
        f.img.setTexture('butterfly_' + (Math.floor(f.t * 9) % 2)).setDepth(1e6 + f.y);
      }
      this.respawnFauna();
    },

    /** Animais caçados voltam a aparecer dois dias depois, em outro lugar. */
    respawnFauna: function () {
      var st = SV.Game.state;
      if (this.lastFaunaDay === st.day) return;
      this.lastFaunaDay = st.day;
      for (var i = 0; i < this.animals.length; i++) {
        var a = this.animals[i];
        if (a.alive || st.day - (a.deadDay || 0) < 2) continue;
        var spot = this.findSpawn(a.kind, SV.Game.world, SV.rng((st.seed + st.day * 37 + i * 7) | 0));
        if (!spot) continue;
        a.x = spot.x; a.y = spot.y; a.home = { x: spot.x, y: spot.y };
        a.hp = a.spec.hp; a.alive = true; a.state = 'idle'; a.timer = 2; a.hitCd = 0;
        a.img.setVisible(true).setPosition(a.x, a.y);
        if (a.solid && this.solids.indexOf(a.solid) < 0) this.solids.push(a.solid);
        delete st.animalState[a.id];
      }
    },

    /** Presa: pastar, descansar e fugir quando o jogador chega perto. */
    updatePrey: function (a, dt, night) {
      var g = a.spec, pd = SV.dist(a.x, a.y, this.player.x, this.player.y);
      var alarm = g.fleeAt * (this.playerState.running ? 1.3 : 1) * (g.skittish || 1);
      a.timer -= dt;
      if (pd < alarm && a.state !== 'flee') {
        a.state = 'flee'; a.timer = 2.8;
        if (g.sound && Math.random() < 0.5) SV.Audio.play(g.sound);
      }
      if (a.timer <= 0) {
        var dorminhoco = night && !g.nocturnal;
        a.state = (dorminhoco || Math.random() < g.rest) ? 'rest' : (Math.random() < 0.62 ? 'walk' : 'idle');
        a.timer = dorminhoco ? 7 + Math.random() * 8 : 1.5 + Math.random() * 4;
        a.ang = Math.random() * 6.283;
      }
      var sp = a.state === 'flee' ? g.flee : (a.state === 'walk' ? g.walk : 0);
      var ang = a.ang;
      if (a.state === 'flee') ang = Math.atan2(a.y - this.player.y, a.x - this.player.x);
      else if (SV.dist(a.x, a.y, a.home.x, a.home.y) > 200) {
        ang = Math.atan2(a.home.y - a.y, a.home.x - a.x); a.state = 'walk'; sp = g.walk;
      }
      if (sp > 0) this.moveAnimal(a, ang, sp, dt);
      this.renderAnimal(a, dt, sp);
    },

    /**
     * Predador: rondar → observar → perseguir → morder.
     * Foge de fogo aceso (fogueira ou tocha) e se estiver muito ferido.
     */
    updatePredator: function (a, dt, night) {
      var g = a.spec, px = this.player.x, py = this.player.y;
      var pd = SV.dist(a.x, a.y, px, py);
      a.hitCd = Math.max(0, a.hitCd - dt);
      a.timer -= dt;

      var fire = g.fearFire ? this.nearestFire(a.x, a.y) : null;
      if (fire && fire.d < g.fearFire) { a.state = 'flee'; a.timer = 3; a.fleeFrom = fire; }
      else if (a.hp <= g.hp * 0.34 && pd < 150) { a.state = 'flee'; a.timer = 5; a.fleeFrom = { x: px, y: py }; }
      else {
        var sight = g.sight * (night ? (g.nocturnal ? 1.3 : 0.55) : 1);
        if (a.state !== 'flee') {
          /* só morde com a mordida pronta; no intervalo continua perseguindo */
          if (pd < g.bite && a.hitCd <= 0) a.state = 'bite';
          /* perseguição tem inércia: uma vez que corre, só volta a observar longe */
          else if (pd < g.stalk || (a.prevState === 'chase' && pd < sight)) a.state = 'chase';
          else if (pd < sight) a.state = 'stalk';
          else if (a.timer <= 0) { a.state = 'roam'; a.timer = 4 + Math.random() * 6; a.ang = Math.random() * 6.283; }
        }
      }
      if (a.state === 'chase' && a.prevState !== 'chase' && g.growl && Math.random() < 0.7) SV.Audio.play(g.growl);
      a.prevState = a.state;

      var sp = 0, ang = a.ang;
      if (a.state === 'flee') { sp = g.chase * 0.85; ang = Math.atan2(a.y - a.fleeFrom.y, a.x - a.fleeFrom.x); }
      else if (a.state === 'chase') { sp = g.chase; ang = Math.atan2(py - a.y, px - a.x); }
      else if (a.state === 'stalk') { sp = g.walk * 0.8; ang = Math.atan2(py - a.y, px - a.x); }
      else if (a.state === 'roam') { sp = g.walk * 0.5; }
      else if (a.state === 'bite') { this.bite(a, pd); }

      if (a.state !== 'flee' && SV.dist(a.x, a.y, a.home.x, a.home.y) > 280) {
        ang = Math.atan2(a.home.y - a.y, a.home.x - a.x); sp = Math.max(sp, g.walk);
      }
      if (sp > 0) this.moveAnimal(a, ang, sp, dt);
      this.renderAnimal(a, dt, sp);
    },

    bite: function (a, pd) {
      var g = a.spec;
      if (a.hitCd > 0 || pd > g.bite + 6) return;
      a.hitCd = 2.4;
      var self = this;
      this.tweens.add({
        targets: a.img, x: this.player.x - (this.player.x - a.x) * 0.35,
        duration: 130, yoyo: true, repeat: 0, onComplete: function () { a.img.setPosition(a.x, a.y); }
      });
      this.damagePlayer(g.dmg, a.x, a.y);
      if (g.sound && Math.random() < 0.6) SV.Audio.play(g.sound);
      this.time.delayedCall(500, function () { if (a.alive) a.state = 'chase'; });
      if (self._dying) a.state = 'roam';
    },

    /** Dano de animal selvagem: invulnerabilidade curta, knockback e aviso. */
    damagePlayer: function (amount, fx, fy) {
      var ps = this.playerState, st = SV.Game.state;
      if (ps.invuln > 0 || this._dying) return;
      st.stats.hp = SV.clamp(st.stats.hp - amount, 0, 100);
      ps.invuln = 1.2; ps.hurt = 0.5; ps.act = 'hurt';
      var ang = Math.atan2(this.player.y - fy, this.player.x - fx);
      this.movePlayer(this.player.x + Math.cos(ang) * 18, this.player.y + Math.sin(ang) * 18);
      SV.Audio.play('hurt');
      this.particles(this.player.x, this.player.y - 14, 'p_blood', 10);
      this.cameras.main.shake(160, 0.0075);
      this.toast('Um animal selvagem te atacou! -' + Math.round(amount) + ' de vida.', '#ff8a7a');
      this.syncHud();
    },

    /** Fonte de fogo mais próxima: fogueira acesa ou tocha equipada acesa. */
    nearestFire: function (x, y) {
      var best = null, i;
      for (i = 0; i < this.structures.length; i++) {
        var s = this.structures[i];
        if (s.type !== 'campfire' || !s.lit || s.fuel <= 0) continue;
        var d = SV.dist(x, y, s.x, s.y);
        if (!best || d < best.d) best = { d: d, x: s.x, y: s.y };
      }
      var slot = this.inv.slot(SV.Game.state.equipped);
      if (slot && slot.lit && SV.Items.get(slot.id).tool === 'torch') {
        var dp = SV.dist(x, y, this.player.x, this.player.y);
        if (!best || dp < best.d) best = { d: dp, x: this.player.x, y: this.player.y };
      }
      return best;
    },

    /** Deslocamento comum: respeita margem do rio, bordas do mapa e sólidos. */
    moveAnimal: function (a, wantAng, sp, dt) {
      var g = a.spec, ang = wantAng;
      for (var try_ = 0; try_ < 3; try_++) {
        var nx = a.x + Math.cos(ang) * sp * dt, ny = a.y + Math.sin(ang) * sp * dt * 0.72;
        if (!this.animalCanStand(g, nx, ny)) { ang += 2.1; continue; }
        var blocked = false;
        for (var s = 0; s < this.solids.length; s++) {
          var so = this.solids[s];
          if (so.animal === a || Math.abs(so.x - nx) > 60 || Math.abs(so.y - ny) > 60) continue;
          var rr = (so.r || 10) + 8;
          if (SV.dist2(nx, ny, so.x, so.y) < rr * rr) { blocked = true; break; }
        }
        if (!blocked) { a.x = nx; a.y = ny; break; }
        ang += 1.6;
      }
      a.ang = ang;
      a.dir = Math.cos(ang) < 0 ? -1 : 1;
    },

    /** Onde cada espécie pode pisar: aquática fica no rio, o resto fora d'água. */
    animalCanStand: function (g, x, y) {
      if (x < 30 || x > SV.World.W - 30 || y > SV.World.H - 20) return false;
      if (g.habitat === 'water') {
        if (y > this.shape.shoreY(x) + 70) return false;
        return this.shape.waterAt(x, y) > 0.2 || this.shape.walkable(x, y);
      }
      return y > this.shape.shoreY(x) + 12 && this.shape.walkable(x, y);
    },

    renderAnimal: function (a, dt, sp) {
      a.anim += dt * (sp > 40 ? 9 : 4);
      var fr = sp === 0 ? 0 : Math.floor(a.anim) % a.frames;
      a.img.setTexture((a.dir < 0 ? a.kind + '_f' : a.kind + '_') + fr)
        .setPosition(a.x, a.y)
        .setDepth(a.spec.habitat === 'air' ? 1e6 + a.y : a.y);
      if (a.solid) { a.solid.x = a.x; a.solid.y = a.y; }
    },

    /* ---------------------------- aves ----------------------------- */
    updateBird: function (a, dt, dark) {
      /* na madrugada a ave pousa: fica no poleiro, sem voar nem cantar */
      if (dark > 0.78) { a.state = 'rest'; a.timer = 3; return; }
      a.timer -= dt;
      if (a.state === 'rest') a.timer = Math.min(a.timer, 1.2);   /* levanta do poleiro ao clarear */
      if (a.state === 'fly') return;
      var pd = SV.dist(a.x, a.y, this.player.x, this.player.y - 60);
      a.img.setTexture(a.kind + '_' + (Math.floor(this.time.now / 700) % a.frames))
        .setPosition(a.x, a.y).setDepth(1e6 + a.y);
      if (pd < 80) { this.flyTo(a); return; }
      if (a.timer <= 0) {
        a.timer = 6 + Math.random() * 10;
        if (Math.random() < 0.45) SV.Audio.play(a.spec.sound);
        if (Math.random() < 0.4) this.flyTo(a);
      }
    },

    flyTo: function (a) {
      var self = this;
      var spots = (a.perches || []).filter(function (p) { return SV.dist(p.x, p.y, a.x, a.y) > 130; });
      if (!spots.length) { a.timer = 5; return; }
      var t = spots[(Math.random() * spots.length) | 0];
      a.state = 'fly'; a.dir = t.x < a.x ? -1 : 1;
      SV.Audio.play(a.spec.sound);
      this.tweens.add({
        targets: a.img, x: t.x, y: t.y - 24, duration: 750, ease: 'Sine.easeInOut',
        onUpdate: function () {
          a.img.setDepth(1e6 + a.img.y)
            .setTexture((a.dir < 0 ? a.kind + '_f' : a.kind + '_') + (Math.floor(self.time.now / 110) % a.frames));
        },
        onComplete: function () {
          a.x = t.x; a.y = t.y; a.state = 'perch'; a.timer = 8 + Math.random() * 12;
          a.img.setPosition(t.x, t.y);
        }
      });
    },

    /* --------------------------- caça ------------------------------ */
    meleeAnimal: function (range) {
      var best = null, bd = range;
      for (var i = 0; i < this.animals.length; i++) {
        var a = this.animals[i];
        if (!a.alive || a.spec.habitat === 'air') continue;
        var d = SV.dist(a.x, a.y, this.player.x, this.player.y);
        if (d < bd) { bd = d; best = a; }
      }
      return best;
    },

    killAnimal: function (a) {
      var g = a.spec, st = SV.Game.state, partes = [];
      a.alive = false;
      a.img.setVisible(false);
      this.particles(a.x, a.y - 8, 'p_blood', 12);
      (g.drops || []).forEach(function (d) {
        if (this.give(d[0], d[1]) > 0) partes.push(d[1] + ' ' + SV.Items.name(d[0]).toLowerCase());
      }, this);
      this.missionEvent('hunt', 1);
      this.toast('Você caçou ' + SV.Fauna[a.kind].label.toLowerCase() + '. ' + (partes.length ? '+ ' + partes.join(', ') : ''), '#ffd27f');
      this.solids = this.solids.filter(function (s) { return s.animal !== a; });
      st.animalState[a.id] = { dead: true, day: st.day };
    },

    /* ---------------------------------------------------------------- *
     * Feedback visual                                                  *
     * ---------------------------------------------------------------- */
    shakeProp: function (p) {
      if (!p.img) return;
      var img = p.img, base = p.x;
      this.tweens.add({ targets: img, x: base + 2.5, duration: 55, yoyo: true, repeat: 1, onComplete: function () { img.x = base; } });
      if (p.cap) {
        var cap = p.cap;
        this.tweens.add({ targets: cap, angle: 1.2, duration: 170, yoyo: true, onComplete: function () { cap.angle = 0; } });
      }
    },

    particles: function (x, y, texKey, n) {
      for (var i = 0; i < n; i++) {
        (function (self) {
          var im = self.add.image(x, y - 6, texKey).setDepth(1e6 + y).setScale(0.7 + Math.random() * 0.7);
          self.tweens.add({
            targets: im, x: x + Phaser.Math.Between(-20, 20), y: y - Phaser.Math.Between(4, 28),
            alpha: 0, angle: Phaser.Math.Between(-200, 200), duration: 420 + Math.random() * 320,
            ease: 'Cubic.easeOut', onComplete: function () { im.destroy(); }
          });
        })(this);
      }
    },

    toast: function (msg, color) { if (SV.Game.ui) SV.Game.ui.toast(msg, color); },

    /* ---------------------------------------------------------------- *
     * HUD e persistência                                               *
     * ---------------------------------------------------------------- */
    syncHud: function () {
      if (!SV.Game.ui) return;
      var st = SV.Game.state;
      SV.Game.ui.refresh({
        temp: st.stats.temp, day: st.day, clock: this.sim.hourLabel(), weather: this.sim.weatherDef(),
        hp: st.stats.hp, food: st.stats.food, water: st.stats.water, energy: st.stats.energy,
        bodyTemp: st.bodyTemp, wet: st.stats.wet,
        slots: this.inv.slots.slice(0, this.inv.hotbar), equipped: st.equipped,
        all: this.inv.slots, capacity: this.inv.size,
        mission: SV.Missions.current(st.mission), missionText: SV.Missions.statusText(st.mission),
        nearFire: this.nearFire(), darkness: this.sim.darkness()
      });
    },

    save: function () {
      var st = SV.Game.state;
      if (!st) return;
      st.inv = this.inv.serialize();
      st.player = { x: this.player.x, y: this.player.y, dir: this.playerState.dir };
      st.structures = this.structures.map(function (s) { return { type: s.type, x: s.x, y: s.y, fuel: s.fuel, lit: s.lit }; });
      SV.Save.write(st);
    },

    /** Fabricação chamada pela interface. */
    craft: function (rec) {
      var st = SV.Game.state, inv = this.inv;
      if (rec.station === 'fire' && !this.nearFire()) { this.toast('Precisa de uma fogueira acesa por perto.', '#ffd27f'); return false; }
      var aff = SV.Recipes.affordable(rec, inv);
      if (!aff.ok) { this.toast('Faltam recursos: ' + aff.missing.join(', '), '#ff8a6a'); return false; }
      for (var k in rec.cost) inv.remove(k, rec.cost[k]);
      if (rec.out.repair) {
        inv.repair(rec.out.repair, 0.4);
        this.toast(SV.Items.name(rec.out.repair) + ' reparada.', '#8affb0');
      } else {
        var got = inv.add(rec.out.item, rec.out.n);
        if (got < rec.out.n) this.toast('Mochila quase cheia!', '#ffd27f');
        else this.toast('Fabricado: ' + SV.Items.name(rec.out.item), '#8affb0');
        st.built[rec.out.item] = true;
        var d = SV.Items.get(rec.out.item);
        if (d && d.type === 'buildable' && !this.placing) {
          var at = inv.findFirst(rec.out.item);
          if (at >= inv.hotbar) {
            // fora da barra rápida: traz para um espaço livre (ou troca com o equipado)
            var free = -1;
            for (var q = 0; q < inv.hotbar; q++) if (!inv.slot(q)) { free = q; break; }
            at = free >= 0 ? free : st.equipped;
            inv.move(inv.findFirst(rec.out.item), at);
          }
          this.selectSlot(at);
          this.beginPlace(at, d.build);
        }
      }
      SV.Audio.play('craft');
      this.syncHud();
      this.save();
      return true;
    },

    /** Pausa/retomada controlada pela interface. */
    setPaused: function (p) { SV.Game.paused = p; },

    /** Uso de item do inventário completo (clique duplo / botão usar). */
    useSlot: function (i) {
      var slot = this.inv.slot(i);
      if (!slot) return;
      var d = SV.Items.get(slot.id);
      if (d.type === 'consumable') this.consumeSlot(i);
      else if (d.type === 'buildable') {
        if (i < this.inv.hotbar) { this.selectSlot(i); this.beginPlace(i, d.build); }
        else { this.toast('Mova o item para a barra rápida primeiro.', '#ffd27f'); }
      } else if (d.type === 'tool') {
        if (i < this.inv.hotbar) this.selectSlot(i);
        else { this.inv.move(i, this.inv.findTool(d.tool) >= 0 ? this.inv.findTool(d.tool) : i); this.toast('Ferramenta na barra rápida.', '#bfe8ff'); }
      }
      this.syncHud();
    }
  });

  SV.GameScene = Game;
})(window.SV);
