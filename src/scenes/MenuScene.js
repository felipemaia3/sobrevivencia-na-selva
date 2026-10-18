/*
 * MenuScene — tela inicial. O fundo é o próprio gerador de mundo: o terreno e a
 * vegetação reais são pintados numa janela ao redor do acampamento, com chuva,
 * fogueira acesa e o explorador, reproduzindo a composição da imagem de
 * referência. Aqui também é decidido se a partida continua do save ou começa nova.
 */
(function (SV) {
  'use strict';

  var MENU_SEED = 20261017;
  var VW = 880, VH = 520;      // janela do mundo (px de arte) usada como fundo
  var TOP = 330;               // quantos px acima do acampamento a janela alcança

  var Menu = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Menu () { Phaser.Scene.call(this, { key: 'Menu' }); },

    create: function () {
      if (SV.hideLoader) SV.hideLoader();
      SV.Game.menu = this;
      SV.Game.ui = null;
      SV.Game.paused = false;
      SV.Game.scene = null;

      this.world = SV.World.generate(MENU_SEED);
      this.paintBackdrop();

      this.bg = this.add.image(0, 0, 'menu_bg').setOrigin(0, 0).setDepth(0);
      this.dim = this.add.rectangle(0, 0, 10, 10, 0x060e18, 0.42).setOrigin(0, 0).setDepth(1);
      this.glow = this.add.image(0, 0, 'menu_glow').setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
      this.fire = this.add.image(0, 0, 'flame_2').setDepth(3).setOrigin(0.5, 0.85);
      this.smoke = this.add.image(0, 0, 'smoke_0').setDepth(3).setAlpha(0.5);
      this.rain = [];
      for (var i = 0; i < 220; i++) {
        this.rain.push(this.add.image(0, 0, 'rain_' + (i % 3))
          .setDepth(4).setScrollFactor(0).setAlpha(0.75)
          .setPosition(Math.random() * 2000 - 200, Math.random() * 1400 - 200));
      }
      this.vig = this.add.image(0, 0, 'menu_vignette').setDepth(5).setScrollFactor(0);

      /* ---- textos ---- */
      this.title = this.mkText(0, 0, 'SOBREVIVÊNCIA NA FLORESTA', 40, '#eaf4fb');
      this.sub = this.mkText(0, 0, 'Mundo aberto 2D · pixel art · português', 15, '#9fd4e8');

      /* ---- botões ---- */
      var self = this;
      this.hasSave = SV.Save.has();
      this.btns = [];
      if (this.hasSave) {
        this.addBtn('Continuar', function () { self.startGame(SV.Save.read()); });
        this.addBtn('Nova partida', function () { self.confirmNew(); });
      } else {
        this.addBtn('Nova partida', function () { self.startGame(SV.Game.defaultState()); });
      }
      this.addBtn('Controles', function () { self.showHelp(); });
      this.addBtn(this.muteLabel(), function () {
        SV.Audio.setMuted(!SV.Audio.muted);
        self.muteBtn.label.setText(self.muteLabel());
      });
      this.muteBtn = this.btns[this.btns.length - 1];
      this.foot = this.mkText(0, 0, '', 12, '#8fb8d0');
      this.helpLayer = null;

      this.layout();
      this.scale.on('resize', this.layout, this);

      this.events.once('shutdown', function () {
        self.scale.off('resize', self.layout, self);
        SV.Game.menu = null;
      });

      this.input.on('pointerdown', function () {
        if (!SV.Audio.ready) { SV.Audio.init(); SV.Audio.resume(); SV.Audio.setAmbience({ rain: 0.6 }); }
      });
    },

    muteLabel: function () { return SV.Audio.muted ? 'Som: desligado' : 'Som: ligado'; },

    mkText: function (x, y, str, size, color, align) {
      return this.add.text(x, y, str, {
        fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
        fontSize: size + 'px', color: color, fontStyle: 'bold',
        stroke: '#0b1a26', strokeThickness: 4, align: align || 'center'
      }).setOrigin(0.5, 0.5).setResolution(2).setDepth(10);
    },

    /* ================================================================ *
     * FUNDO (recorte real do mundo gerado)                              *
     * ================================================================ */
    paintBackdrop: function () {
      if (this.textures.exists('menu_bg')) return;
      var shape = this.world.shape, camp = this.world.camp;
      var x0 = Math.round(camp.x - VW / 2), y0 = Math.round(camp.y - TOP);
      var p = new SV.P(VW, VH);
      p.fill(SV.hex('#16241c'));
      p.flush();
      var ctx = p.ctx;
      ctx.imageSmoothingEnabled = false;

      /* terreno: chunks reais de 200px amostrados em coordenadas de mundo */
      var cs = 200;
      for (var oy = y0 - (y0 % cs) - cs; oy < y0 + VH + cs; oy += cs) {
        for (var ox = x0 - (x0 % cs) - cs; ox < x0 + VW + cs; ox += cs) {
          ctx.drawImage(SV.Art.groundChunk(cs, ox, oy, MENU_SEED, shape), ox - x0, oy - y0);
        }
      }

      /* sombras no chão + objetos (ordenados por y, como no jogo) */
      var scene = this;
      var props = this.world.props.filter(function (pr) {
        return pr.x > x0 - 140 && pr.x < x0 + VW + 140 && pr.y > y0 - 60 && pr.y < y0 + VH + 30;
      });
      var srcOf = function (key) { return scene.source(key); };
      var draw = function (key, cx, by, scale) {
        var im = srcOf(key);
        if (!im) return;
        ctx.drawImage(im, Math.round(cx - x0 - im.width * scale / 2), Math.round(by - y0 - im.height * scale),
          Math.round(im.width * scale), Math.round(im.height * scale));
      };

      props.forEach(function (pr) {
        if (pr.type === 'tree' || pr.type === 'bush' || pr.type === 'bushEmpty' || pr.type === 'rock' || pr.type === 'palm') {
          draw('shadow_' + (pr.type === 'tree' ? 'big' : '0'), pr.x, pr.y - 1, pr.scale);
        }
      });

      /* fogueira do acampamento + troncos sentado */
      var fx = camp.x, fy = camp.y + 6;
      draw('shadow_0', fx, fy, 1);

      var canopies = [];
      props.forEach(function (pr) {
        var t = SV.World.texFor(pr);
        if (t.solo) draw(t.solo, pr.x, pr.y, pr.scale);
        else { draw(t.trunk, pr.x, pr.y, pr.scale); canopies.push(pr); }
      });
      draw('firePit_0', fx, fy, 1);
      draw('log_0', fx - 46, fy + 16, 1);

      /* personagem com mochila e machado, ao lado do fogo */
      var pl = srcOf('pl_side_idle');
      if (pl) {
        var px = Math.round(fx - x0 - 34), py = Math.round(fy - y0 - 2 + 6);
        ctx.drawImage(pl, px - pl.width, py - pl.height, pl.width, pl.height);
        var ax = srcOf('tool_axe');
        if (ax) ctx.drawImage(ax, px - 14, py - ax.height - 6, ax.width, ax.height);
      }
      draw('capy_1', fx + 96, fy + 40, 1);
      canopies.forEach(function (pr) {
        var t = SV.World.texFor(pr);
        draw(t.canopy, pr.x, pr.y, pr.scale);
      });
      var tou = srcOf('toucan_0');
      if (tou) {
        var perched = null;
        for (var q = 0; q < props.length; q++) {
          var pr2 = props[q];
          if (pr2.type !== 'tree') continue;
          if (!perched || pr2.x < perched.x) perched = pr2;
        }
        if (perched) {
          var h = (this.textures.get('tree_trunk_0').getSourceImage().height) * perched.scale;
          ctx.drawImage(tou, Math.round(perched.x - x0 + 26), Math.round(perched.y - y0 - h * 0.72), tou.width, tou.height);
        } else ctx.drawImage(tou, 24, 26, tou.width, tou.height);
      }

      /* tons de chuva: azul-escuro por cima, brilho quente junto ao fogo */
      var grd = ctx.createLinearGradient(0, 0, 0, VH);
      grd.addColorStop(0, 'rgba(18,34,52,0.40)');
      grd.addColorStop(0.55, 'rgba(22,40,48,0.16)');
      grd.addColorStop(1, 'rgba(10,20,30,0.34)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, VW, VH);

      this.fireLocal = { x: fx - x0, y: fy - y0 };
      this.textures.addCanvas('menu_bg', p.canvas);

      /* halo da fogueira (textura radial) */
      if (!this.textures.exists('menu_glow')) {
        var g = new SV.P(160, 160);
        for (var y = 0; y < 160; y++) for (var x = 0; x < 160; x++) {
          var d = SV.dist(x, y, 80, 80) / 80;
          if (d > 1) continue;
          var a = Math.pow(1 - d, 2.4) * 0.85;
          g.over(x, y, [255, 150, 60], a);
        }
        this.textures.addCanvas('menu_glow', g.toCanvas());
      }
      if (!this.textures.exists('menu_vignette')) {
        var v = new SV.P(320, 200);
        for (var yy = 0; yy < 200; yy++) for (var xx = 0; xx < 320; xx++) {
          var dx = (xx - 160) / 160, dy = (yy - 100) / 100;
          var k = Math.min(1, Math.sqrt(dx * dx * 0.8 + dy * dy * 1.1));
          var a2 = Math.pow(k, 3) * 0.72;
          if (a2 > 0.01) v.over(xx, yy, [6, 12, 20], a2);
        }
        this.textures.addCanvas('menu_vignette', v.toCanvas());
      }
    },

    /** Imagem-fonte de uma textura já registrada (canvas gerado no Boot). */
    source: function (key) {
      if (!this.textures.exists(key)) return null;
      return this.textures.get(key).getSourceImage();
    },

    /* ================================================================ *
     * LAYOUT                                                           *
     * ================================================================ */
    layout: function () {
      var W = this.scale.width, H = this.scale.height;
      var s = Math.max(W / VW, H / VH);
      this.ps = s;
      this.ox = (W - VW * s) / 2;
      this.oy = (H - VH * s) / 2;
      this.bg.setPosition(this.ox, this.oy).setScale(s);
      this.vig.setDisplaySize(W, H).setPosition(W / 2, H / 2);
      this.dim.setPosition(0, 0).setSize(W, H);
      this.rainScale = s * 1.15;
      for (var i = 0; i < this.rain.length; i++) {
        this.rain[i].setScale(this.rainScale * (0.7 + (i % 5) * 0.12));
      }
      var f = this.local(this.fireLocal.x, this.fireLocal.y);
      this.fire.setPosition(f[0], f[1]).setScale(s);
      this.glow.setPosition(f[0], f[1] - 6 * s).setScale(s * 1.5);
      this.smoke.setPosition(f[0] + 3 * s, f[1] - 26 * s).setScale(s);

      var ts = Phaser.Math.Clamp(W / 26, 15, 46);
      this.title.setFontSize(ts).setPosition(W / 2, H * 0.17);
      this.sub.setPosition(W / 2, H * 0.17 + ts * 0.9).setFontSize(Math.max(11, ts * 0.36));

      var bw = Phaser.Math.Clamp(W * 0.24, 190, 320), bh = Phaser.Math.Clamp(H * 0.072, 40, 62);
      var bx = W / 2, by = H * 0.46;
      for (var k = 0; k < this.btns.length; k++) {
        this.btns[k].place(bx, by + k * (bh + 12), bw, bh);
      }
      this.foot.setPosition(W / 2, H - 26).setFontSize(Math.max(11, ts * 0.3));
      this.foot.setText(this.hasSave
        ? 'Seu progresso fica salvo neste navegador.'
        : 'Clique ou toque para começar. Áudio ligado no primeiro toque.');
      if (this.helpLayer) this.clearHelp();
      this.rainW = W; this.rainH = H;
    },

    local: function (lx, ly) { return [this.ox + lx * this.ps, this.oy + ly * this.ps]; },

    addBtn: function (label, cb) {
      var key = SV.panelKey(this, 200, 44, { r: 9, noShadow: true, bg: '#1d3b55' });
      var img = this.add.image(0, 0, key).setDepth(11).setInteractive({ useHandCursor: true });
      var txt = this.add.text(0, 0, label, {
        fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
        fontSize: '20px', color: '#eaf4fb', fontStyle: 'bold',
        stroke: '#0b1a26', strokeThickness: 3
      }).setOrigin(0.5).setDepth(12);
      var b = { img: img, label: txt, cb: cb, w: 200, h: 44 };
      b.place = function (x, y, w, h) {
        b.w = w; b.h = h;
        img.setPosition(x, y).setDisplaySize(w, h);
        txt.setPosition(x, y).setFontSize(Phaser.Math.Clamp(h * 0.4, 13, 24));
      };
      img.on('pointerdown', function () {
        SV.Audio.init(); SV.Audio.resume(); SV.Audio.play('ui');
        img.setTint(0x9fd4e8);
        this.time.delayedCall(90, function () { img.clearTint(); });
        b.cb();
      }, this);
      img.on('pointerover', function () { img.setAlpha(1); });
      img.on('pointerout', function () { img.setAlpha(0.94); });
      img.setAlpha(0.94);
      this.btns.push(b);
      return b;
    },

    /* ================================================================ *
     * AÇÕES                                                            *
     * ================================================================ */
    confirmNew: function () {
      var self = this;
      if (this.confirming) { this.clearHelp(); this.confirming = false; }
      this.showHelp('Há um progresso salvo. "Nova partida" apaga o save atual.', function () {
        SV.Save.clear();
        self.clearHelp();
        self.startGame(SV.Game.defaultState());
      }, function () { self.clearHelp(); });
      this.confirming = true;
    },

    startGame: function (state) {
      SV.Audio.setAmbience({ rain: 0 });
      SV.Game.state = state;
      this.scene.start('Game');
    },

    showHelp: function (msg, okCb, cancelCb) {
      this.clearHelp();
      var self = this;
      var W = this.scale.width, H = this.scale.height;
      var s = Phaser.Math.Clamp(H / 720, 0.7, 1.45);
      this.helpLayer = this.add.container(0, 0).setDepth(30);
      var dim = this.add.rectangle(W / 2, H / 2, W, H, 0x040a12, 0.8);
      var pw = Math.min(W - 40, 520 * s), ph = Math.min(H - 60, 460 * s);
      var panel = this.add.image(W / 2, H / 2, SV.panelKey(this, Math.round(pw / s), Math.round(ph / s), { r: 12 })).setScale(s);
      var title = this.add.text(W / 2, H / 2 - ph / 2 + 34 * s, msg ? 'CONFIRMAR' : 'CONTROLES', {
        fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
        fontSize: Math.round(24 * s) + 'px', color: '#ffb02e', fontStyle: 'bold', stroke: '#0b1a26', strokeThickness: 4
      }).setOrigin(0.5).setResolution(2);
      var body = this.add.text(W / 2, H / 2 - ph / 2 + 66 * s, msg || Menu.CONTROLS, {
        fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
        fontSize: Math.round(15 * s) + 'px', color: '#eaf4fb', lineHeight: Math.round(24 * s), align: 'left'
      }).setOrigin(0.5, 0).setResolution(2);
      var by = H / 2 + ph / 2 - 34 * s;
      var ok = this.add.image(W / 2 - (msg ? 80 * s : 0), by, SV.panelKey(this, 160, 40, { r: 8, noShadow: true, bg: '#245d4a' }))
        .setDisplaySize(160 * s, 40 * s).setInteractive({ useHandCursor: true });
      var okT = this.add.text(W / 2 - (msg ? 80 * s : 0), by, msg ? 'Nova partida' : 'Voltar', {
        fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
        fontSize: Math.round(16 * s) + 'px', color: '#eaf4fb', fontStyle: 'bold', stroke: '#0b1a26', strokeThickness: 3
      }).setOrigin(0.5).setResolution(2);
      ok.on('pointerdown', function () {
        SV.Audio.play('ui');
        if (msg && okCb) okCb(); else self.clearHelp();
      });
      this.helpLayer.add([dim, panel, title, body, ok, okT]);
      if (msg && cancelCb) {
        var cx = W / 2 + 80 * s;
        var no = this.add.image(cx, by, SV.panelKey(this, 160, 40, { r: 8, noShadow: true, bg: '#1d3b55' }))
          .setDisplaySize(160 * s, 40 * s).setInteractive({ useHandCursor: true });
        var noT = this.add.text(cx, by, 'Cancelar', {
          fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
          fontSize: Math.round(16 * s) + 'px', color: '#eaf4fb', fontStyle: 'bold', stroke: '#0b1a26', strokeThickness: 3
        }).setOrigin(0.5).setResolution(2);
        no.on('pointerdown', function () { SV.Audio.play('ui'); cancelCb(); });
        this.helpLayer.add([no, noT]);
      }
    },

    clearHelp: function () {
      if (this.helpLayer) { this.helpLayer.destroy(); this.helpLayer = null; }
      this.confirming = false;
    },

    update: function (time, delta) {
      var dt = Math.min(delta, 50) / 1000;
      var W = this.rainW || this.scale.width, H = this.rainH || this.scale.height;
      for (var i = 0; i < this.rain.length; i++) {
        var d = this.rain[i];
        d.y += (620 + (i % 7) * 60) * dt;
        d.x -= (620 + (i % 7) * 60) * 0.34 * dt;
        if (d.y > H + 20) { d.y = -20 - Math.random() * 120; d.x = Math.random() * (W + 260) - 130; }
        if (d.x < -40) d.x = W + 40;
      }
      var f = this.fireLocal ? this.local(this.fireLocal.x, this.fireLocal.y) : [0, 0];
      var fl = 1 + Math.sin(time / 90) * 0.1 + Math.sin(time / 41) * 0.05;
      this.fire.setScale(this.ps * fl).setTexture('flame_' + (Math.floor(time / 90) % 5));
      this.glow.setScale(this.ps * 1.5 * (fl + Math.sin(time / 27) * 0.06)).setAlpha(0.65 + (fl - 1));
      var sy = (time / 26) % 110;
      this.smoke.setPosition(f[0] + 3 * this.ps + Math.sin(time / 700) * 8, f[1] - (26 + sy) * this.ps)
        .setAlpha(Math.max(0, 0.4 - sy / 300)).setScale(this.ps * (1 + sy / 90))
        .setTexture('smoke_' + (Math.floor(time / 400) % 2));
    }
  });

  Menu.CONTROLS =
    'Mover .............. WASD ou setas\n' +
    'Correr ............. Shift (gasta energia)\n' +
    'Coletar / usar ..... E\n' +
    'Ação do contexto ... Espaço\n' +
    'Atacar ............. Clique esquerdo\n' +
    'Selecionar item .... 1 a 6 ou clique na barra\n' +
    'Inventário ......... Tab (ou I)\n' +
    'Fabricação ......... C\n' +
    'Pausa .............. Esc\n\n' +
    'No celular: joystick à esquerda, botões à direita.';

  SV.MenuScene = Menu;
})(window.SV);
