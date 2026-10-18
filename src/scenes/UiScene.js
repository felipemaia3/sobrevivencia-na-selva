/*
 * UiScene — HUD fiel à referência (painel de sobrevivência à esquerda, missão
 * à direita, hotbar embaixo), inventário completo, fabricação, pausa, ajustes,
 * avisos e controles de toque. Toda a interface é em português do Brasil.
 */
(function (SV) {
  'use strict';
  var UI = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Ui() { Phaser.Scene.call(this, { key: 'Ui' }); },

    create: function () {
      var self = this;
      SV.Game.ui = this;
      this.uiHot = false;
      this.layer = this.add.container(0, 0);
      this.modalLayer = this.add.container(0, 0).setDepth(100);
      this.toastLayer = this.add.container(0, 0).setDepth(200);
      this.toasts = [];
      this.open = null;              // 'inv' | 'craft' | 'pause' | null
      this.selectedSlot = -1;
      this.craftTab = 'Ferramentas';
      var tset = SV.Game.state.settings.touch;
      this.showTouch = (tset === null || tset === undefined)
        ? (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) : !!tset;

      this.buildHud();
      this.relayout();

      /* ---- teclado global ---- */
      var kb = this.input.keyboard;
      kb.on('keydown', function (e) {
        var k = (e && e.key) ? e.key : '';
        var low = k.toLowerCase();
        if (low === 'tab') { if (e) e.preventDefault(); self.toggle('inv'); }
        else if (low === 'c') self.toggle('craft');
        else if (low === 'escape' || k === 'Esc') self.toggle('pause');
        else if (low === 'i') self.toggle('inv');
      });
      kb.addCapture([Phaser.Input.Keyboard.KeyCodes.TAB]);

      /* ---- bloqueia cliques que caem sobre a interface ---- */
      this.input.on('pointermove', function (p) {
        self.uiHot = self.input.hitTestPointer(p).length > 0;
      });
      this.input.on('pointerdown', function (p) {
        if (!SV.Audio.ready) { SV.Audio.init(); SV.Audio.resume(); }
        self.uiHot = self.input.hitTestPointer(p).length > 0;
      });

      this.events.once('shutdown', function () { SV.Game.ui = null; });
      this.refresh(SV.Game.lastHud || {});
    },

    /* ================================================================ *
     * HUD                                                              *
     * ================================================================ */
    buildHud: function () {
      var self = this;
      var g = this.add.graphics();

      /* --- painel superior esquerdo: temperatura / dia / hora / clima --- */
      this.tempPanel = this.add.image(0, 0, SV.panelKey(this, 150, 44, { r: 10 }));
      this.tempIcon = this.add.image(0, 0, 'hud_temp');
      this.tempText = this.mkText(0, 0, '26 °C', 22, '#eaf4fb');
      this.clockPanel = this.add.image(0, 0, SV.panelKey(this, 176, 74, { r: 10 }));
      this.dayIcon = this.add.image(0, 0, 'hud_day');
      this.dayText = this.mkText(0, 0, 'Dia 5', 20, '#eaf4fb');
      this.timeIcon = this.add.image(0, 0, 'hud_clock');
      this.timeText = this.mkText(0, 0, '15:40', 20, '#eaf4fb');
      this.weatherIcon = this.add.image(0, 0, 'hud_rain');

      /* --- barras de necessidade --- */
      this.bars = {};
      [['hp', 'heart', SV.PAL.hp], ['food', 'food', SV.PAL.food], ['water', 'water', SV.PAL.water], ['energy', 'energy', SV.PAL.energy]]
        .forEach(function (b) { self.bars[b[0]] = self.makeBar(b[0], b[1], b[2]); });

      /* --- missão (canto superior direito) --- */
      this.missionPanel = this.add.image(0, 0, SV.panelKey(this, 240, 74, { r: 10 }));
      this.missionIcon = this.add.image(0, 0, 'hud_mission');
      this.missionTitle = this.mkText(0, 0, 'Missão:', 15, '#ffb02e', 'bold');
      this.missionText = this.mkText(0, 0, 'Coletar recursos', 17, '#eaf4fb', 'bold');
      this.missionGoal = this.mkText(0, 0, '', 12, '#9fd4e8');

      /* --- hotbar --- */
      this.hotbar = [];
      this.hotbarBg = this.add.image(0, 0, SV.panelKey(this, 6, 6, { r: 2, noShadow: true })).setVisible(false);
      for (var i = 0; i < 6; i++) {
        var slot = {
          bg: this.add.image(0, 0, SV.slotKey(this, 54, false)),
          icon: this.add.image(0, 0, 'icon_stone').setVisible(false),
          count: this.mkText(0, 0, '', 12, '#ffffff'),
          num: this.mkText(0, 0, String(i + 1), 10, '#8fb8d0'),
          dur: this.add.rectangle(0, 0, 40, 4, 0x000000).setOrigin(0.5, 0.5).setVisible(false),
          durFill: this.add.rectangle(0, 0, 40, 3, 0x8affb0).setOrigin(0, 0.5).setVisible(false),
          hit: null
        };
        slot.bg.setInteractive({ useHandCursor: true });
        (function (idx, s) {
          s.bg.on('pointerdown', function () { SV.Game.scene.selectSlot(idx); SV.Audio.play('ui'); });
        })(i, slot);
        this.hotbar.push(slot);
      }

      /* --- mensagem contextual --- */
      this.promptPanel = this.add.image(0, 0, SV.panelKey(this, 10, 10, { r: 6 }));
      this.promptText = this.mkText(0, 0, '', 14, '#eaf4fb');
      this.promptArrow = this.add.image(0, 0, 'prompt_arrow').setVisible(false);
      this.setPrompt('');

      /* --- aviso de temperatura corporal / estado --- */
      this.statusText = this.mkText(0, 0, '', 12, '#cfe6f5');

      this.buildTouchControls();
    },

    mkText: function (x, y, str, size, color, style) {
      var k = this.s || SV.Game.uiScale || 1;
      var t = this.add.text(x, y, str, {
        fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
        fontSize: Math.max(8, Math.round(size * k)) + 'px', color: color, fontStyle: style || 'bold',
        stroke: '#0b1a26', strokeThickness: 3
      }).setOrigin(0.5, 0.5).setResolution(2);
      return t;
    },

    makeBar: function (key, icon, color) {
      var W = 108, H = 15;
      var bg = this.add.image(0, 0, SV.barKey(this, W, H, color, 0));
      var fill = this.add.rectangle(0, 0, W - 4, H - 4, Phaser.Display.Color.HexStringToColor(color).color).setOrigin(0, 0.5);
      var shine = this.add.rectangle(0, 0, W - 4, 3, 0xffffff, 0.28).setOrigin(0, 0.5);
      var ic = this.add.image(0, 0, 'hud_' + icon);
      var b = {
        W: W, H: H, color: color, bg: bg, fill: fill, shine: shine, icon: ic,
        x: 0, y: 0, s: 1, last: 100,
        layout: function (x, y, s) {
          b.x = x; b.y = y; b.s = s;
          bg.setPosition(x, y).setScale(s);
          ic.setPosition(x - (W / 2 + 18) * s, y).setScale(s * 0.95);
          b.set(b.last);
        },
        set: function (pct) {
          b.last = pct;
          pct = SV.clamp(pct, 0, 100) / 100;
          fill.setVisible(pct > 0.001);
          shine.setVisible(pct > 0.001);
          var w = Math.max(1, (b.W - 4) * b.s * pct);
          var left = b.x - (b.W - 4) * b.s / 2;
          fill.setSize(w, (b.H - 4) * b.s);
          fill.setPosition(left, b.y);
          shine.setSize(w, 3 * b.s);
          shine.setPosition(left, b.y - (b.H - 4) * b.s / 2 + 2 * b.s);
        }
      };
      return b;
    },

    /* ================================================================ *
     * LAYOUT                                                           *
     * ================================================================ */
    relayout: function () {
      var s = SV.Game.uiScale || 1;
      var W = this.scale.width, H = this.scale.height;
      this.s = s;
      var pad = 10 * s;

      function place(obj, x, y, scale) { obj.setPosition(x * 1, y); if (scale !== undefined) obj.setScale(scale); }
      var u = function (v) { return v * s; };

      /* painel de temperatura */
      this.tempPanel.setPosition(pad + u(75), pad + u(22)).setScale(s);
      this.tempIcon.setPosition(pad + u(24), pad + u(22)).setScale(s);
      this.tempText.setPosition(pad + u(92), pad + u(21)).setFontSize(u(22));

      /* painel de dia/hora/clima */
      this.clockPanel.setPosition(pad + u(88), pad + u(90)).setScale(s);
      this.dayIcon.setPosition(pad + u(24), pad + u(66)).setScale(s * 0.95);
      this.dayText.setPosition(pad + u(76), pad + u(66)).setFontSize(u(19));
      this.timeIcon.setPosition(pad + u(24), pad + u(100)).setScale(s * 0.95);
      this.timeText.setPosition(pad + u(72), pad + u(100)).setFontSize(u(19));
      this.weatherIcon.setPosition(pad + u(148), pad + u(84)).setScale(s * 1.35);

      /* barras */
      var keys = ['hp', 'food', 'water', 'energy'];
      for (var i = 0; i < keys.length; i++) {
        var b = this.bars[keys[i]];
        b.layout(pad + u(88), pad + u(140 + i * 30), s);
      }
      this.statusText.setPosition(pad + u(14), pad + u(262)).setFontSize(u(12))
        .setOrigin(0, 0.5).setWordWrapWidth(u(190), false);

      /* missão */
      this.missionPanel.setPosition(W - pad - u(120), pad + u(37)).setScale(s);
      this.missionIcon.setPosition(W - pad - u(210), pad + u(26)).setScale(s);
      this.missionTitle.setPosition(W - pad - u(188), pad + u(14)).setFontSize(u(12)).setOrigin(0, 0.5);
      this.missionText.setPosition(W - pad - u(188), pad + u(32)).setFontSize(u(16)).setOrigin(0, 0.5);
      this.missionGoal.setPosition(W - pad - u(120), pad + u(60)).setFontSize(u(11)).setOrigin(0.5, 0.5).setWordWrapWidth(u(226), false);

      /* hotbar centralizada embaixo */
      var slotSize = 54 * s, gap = 6 * s;
      var totalW = 6 * slotSize + 5 * gap;
      var bx = W / 2 - totalW / 2 + slotSize / 2;
      var by = H - pad - slotSize / 2 - u(4);
      for (var k = 0; k < 6; k++) {
        var sl = this.hotbar[k];
        var x2 = bx + k * (slotSize + gap);
        sl.bg.setPosition(x2, by).setScale(s);
        sl.icon.setPosition(x2, by - 2 * s).setScale(s * 1.5);
        sl.count.setPosition(x2 + slotSize * 0.32, by + slotSize * 0.3).setFontSize(u(12));
        sl.num.setPosition(x2 - slotSize * 0.34, by - slotSize * 0.34).setFontSize(u(10));
        sl.dur.setPosition(x2, by + slotSize * 0.36).setSize(40 * s, 4 * s);
        sl.durX = x2 - 20 * s; sl.durY = by + slotSize * 0.36; sl.durW = 40 * s;
        sl.durFill.setPosition(sl.durX, sl.durY);
      }
      this.promptPanel.setPosition(W / 2, by - slotSize * 0.9).setScale(s);
      this.promptText.setPosition(W / 2, by - slotSize * 0.9).setFontSize(u(14));
      this.promptArrow.setPosition(W / 2 - this.promptText.width / 2 - u(14), by - slotSize * 0.9).setScale(s);

      /* controles de toque */
      this.layoutTouch(W, H, s);
      if (this.open) this.relayoutModal();
    },

    relayoutModal: function () {
      if (this.invPanel) this.layoutInventory();
      if (this.craftPanel) this.layoutCraft();
      if (this.pausePanel) this.layoutPause();
    },

    /* ================================================================ *
     * ATUALIZAÇÃO                                                      *
     * ================================================================ */
    refresh: function (d) {
      if (!d) return;
      SV.Game.lastHud = d;
      var s = this.s || 1;
      this.tempText.setText(Math.round(d.temp) + ' °C');
      this.tempText.setTint(d.temp < 18 ? 0x9fd4ff : (d.temp > 32 ? 0xffb08a : 0xffffff));
      this.dayText.setText('Dia ' + d.day);
      this.timeText.setText(d.clock);
      var wk = d.weather && d.weather.kind ? d.weather.kind : 'rain';
      var icon = wk === 'clear' ? 'hud_sun' : wk === 'cloudy' ? 'hud_cloud' : wk === 'storm' ? 'hud_storm' : 'hud_rain';
      if (parseInt(d.clock, 10) >= 19 || parseInt(d.clock, 10) < 5.5) icon = 'hud_moon';
      this.weatherIcon.setTexture(icon);

      this.bars.hp.last = d.hp; this.bars.food.last = d.food;
      this.bars.water.last = d.water; this.bars.energy.last = d.energy;
      this.bars.hp.set(d.hp); this.bars.food.set(d.food);
      this.bars.water.set(d.water); this.bars.energy.set(d.energy);

      var st = [];
      if (d.bodyTemp < 35) st.push('Corpo frio: ' + d.bodyTemp.toFixed(1) + ' °C');
      if (d.wet > 0.5) st.push('Roupas molhadas');
      if (d.nearFire) st.push('Aquecido pelo fogo');
      this.statusText.setText(st.join('  ·  '));

      this.missionText.setText(d.mission ? d.mission.title : 'Sobreviver');
      this.missionGoal.setText(d.missionText || (d.mission ? d.mission.hint : ''));
      this.missionGoal.setVisible(!!(d.missionText));

      // hotbar
      for (var i = 0; i < 6; i++) {
        var slot = this.hotbar[i], item = d.slots ? d.slots[i] : null;
        slot.bg.setTexture(SV.slotKey(this, 54, i === d.equipped));
        slot.bg.setAlpha(i === d.equipped ? 1 : 0.92);
        if (item) {
          var def = SV.Items.get(item.id);
          slot.icon.setVisible(true).setTexture('icon_' + (def.icon || 'stone'));
          slot.count.setVisible(def.stack > 1 && item.n > 1).setText('x' + item.n);
          if (def.dur && def.dur < 999) {
            var pct = SV.clamp((item.dur || 0) / def.dur, 0, 1);
            slot.dur.setVisible(true);
            slot.durFill.setVisible(true);
            slot.durFill.setPosition(slot.durX, slot.durY);
            slot.durFill.setSize(Math.max(1, slot.durW * pct), 3 * s);
            slot.durFill.setFillStyle(Phaser.Display.Color.HexStringToColor(pct > 0.5 ? '#8affb0' : pct > 0.25 ? '#ffd23f' : '#ff6a5a').color, 1);
          } else { slot.dur.setVisible(false); slot.durFill.setVisible(false); }
        } else {
          slot.icon.setVisible(false); slot.count.setVisible(false);
          slot.dur.setVisible(false); slot.durFill.setVisible(false);
        }
      }
      if (this.open === 'inv') this.renderInventory(d);
    },

    setPrompt: function (text) {
      var show = !!text;
      this.promptText.setText(text || '');
      this.promptPanel.setVisible(show);
      this.promptArrow.setVisible(show);
      if (show) {
        var w = this.promptText.width + 34 * (this.s || 1);
        this.promptPanel.setTexture(SV.panelKey(this, Math.round(w / (this.s || 1)) + 24, 26, { r: 8, noShadow: true }));
        this.promptPanel.setScale(this.s || 1);
      }
    },

    toast: function (msg, color) {
      var t = this.mkText(this.scale.width / 2, 0, msg, 15, color || '#eaf4fb');
      t.setDepth(300).setWordWrapWidth(Math.max(120, this.scale.width - 26), false);
      this.toasts.push({ obj: t, life: 3.4 });
      if (this.toasts.length > 6) { this.toasts.shift().obj.destroy(); }
      this.arrangeToasts();
      var self = this;
      this.time.delayedCall(3400, function () {
        self.tweens.add({
          targets: t, alpha: 0, y: t.y - 12, duration: 400,
          onComplete: function () {
            t.destroy();
            var i = self.toasts.findIndex(function (x) { return x.obj === t; });
            if (i >= 0) self.toasts.splice(i, 1);
            self.arrangeToasts();
          }
        });
      });
    },

    arrangeToasts: function () {
      var s = this.s || 1, W = this.scale.width;
      var y = 92 * s;
      for (var i = 0; i < this.toasts.length; i++) {
        var t = this.toasts[i].obj;
        var half = Math.min(t.width / 2, W / 2 - 10);
        t.setPosition(SV.clamp(W / 2, half + 6, W - half - 6), y);
        y += Math.max(26 * s, t.height + 6);
      }
    },

    /* ================================================================ *
     * PAINÉIS MODAIS                                                   *
     * ================================================================ */
    toggle: function (which) {
      if (SV.Game.scene && SV.Game.scene._dying) return;
      if (this.open === which) this.close();
      else this.openPanel(which);
      SV.Audio.play('ui');
    },

    close: function () {
      ['invPanel', 'craftPanel', 'pausePanel', 'helpPanel'].forEach(function (k) {
        if (this[k]) { this[k].destroy(); this[k] = null; }
      }, this);
      if (this.dim) { this.dim.destroy(); this.dim = null; }
      this.open = null;
    },

    openPanel: function (which) {
      this.close();
      this.open = which;
      var W = this.scale.width, H = this.scale.height;
      this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x06101a, 0.62).setDepth(110).setInteractive();
      if (which === 'inv') { this.invPanel = this.add.container(0, 0).setDepth(120); this.layoutInventory(); }
      if (which === 'craft') { this.craftPanel = this.add.container(0, 0).setDepth(120); this.layoutCraft(); }
      if (which === 'pause') { this.pausePanel = this.add.container(0, 0).setDepth(120); this.layoutPause(); }
    },

    /** Botão padrão da interface. */
    button: function (x, y, w, h, label, cb, opts) {
      opts = opts || {};
      var s = this.s || 1;
      var key = SV.panelKey(this, Math.round(w / s), Math.round(h / s), { r: 7, noShadow: true, bg: opts.bg || (opts.disabled ? '#243546' : '#1d3b55') });
      var img = this.add.image(x, y, key).setScale(s).setInteractive({ useHandCursor: !opts.disabled });
      img.setAlpha(opts.disabled ? 0.6 : 1);
      var txt = this.mkText(x, y, label, opts.size || 14, opts.disabled ? '#7f95a6' : '#eaf4fb');
      if (cb) img.on('pointerdown', function () { SV.Audio.play('ui'); cb(); });
      var c = this.add.container(0, 0).add([img, txt]);
      c.img = img; c.txt = txt;
      return c;
    },

    /* ---------------- Inventário completo ---------------- */
    layoutInventory: function () {
      var c = this.invPanel;
      c.removeAll(true);
      var s = this.s || 1, W = this.scale.width, H = this.scale.height;
      var cols = 6, rows = 4, size = 56 * s, gap = 8 * s;
      var pw = cols * (size + gap) + gap + 210 * s, ph = rows * (size + gap) + gap + 74 * s;
      var px = W / 2, py = H / 2;
      var bg = this.add.image(px, py, SV.panelKey(this, Math.round(pw / s), Math.round(ph / s), { r: 12 }))
        .setScale(s).setDepth(121);
      var title = this.mkText(px - pw / 2 + 110 * s, py - ph / 2 + 26 * s, 'INVENTÁRIO', 20, '#eaf4fb');
      var hint = this.mkText(px + pw / 2 - 120 * s, py - ph / 2 + 26 * s, 'clique 2× para usar', 12, '#9fd4e8');
      var closeB = this.button(px + pw / 2 - 26 * s, py - ph / 2 + 24 * s, 34 * s, 30 * s, 'X', function () { SV.Game.ui.close(); });
      var info = this.mkText(px + pw / 2 - 105 * s, py + ph / 2 - 60 * s, '', 12, '#cfe6f5').setOrigin(0.5, 0);
      var infoName = this.mkText(px + pw / 2 - 105 * s, py + ph / 2 - 92 * s, '', 15, '#ffb02e');

      this.invCells = [];
      for (var i = 0; i < 24; i++) {
        var col = i % cols, row = (i / cols) | 0;
        var x = px - pw / 2 + gap + col * (size + gap) + size / 2 + 8 * s;
        var y = py - ph / 2 + 56 * s + row * (size + gap) + size / 2;
        var cell = {
          bg: this.add.image(x, y, SV.slotKey(this, 56, false)).setScale(s),
          icon: this.add.image(x, y - 2 * s, 'icon_stone').setScale(s * 1.6).setVisible(false),
          count: this.mkText(x + size * 0.3, y + size * 0.3, '', 12, '#fff')
        };
        cell.bg.setInteractive({ useHandCursor: true });
        (function (idx, cl) {
          cell.bg.on('pointerdown', function () { SV.Game.ui.clickInvSlot(idx); });
          cell.bg.on('pointerover', function () {
            var it = SV.Game.inv.slot(idx);
            if (!it) { infoName.setText(''); info.setText(''); return; }
            var d = SV.Items.get(it.id);
            infoName.setText(d.name + (it.n > 1 ? ' x' + it.n : ''));
            info.setText(d.desc + (d.dur && d.dur < 999 ? '\nDurabilidade: ' + Math.round(it.dur) + '/' + d.dur : ''));
          });
        })(i, cell);
        this.invCells.push(cell);
      }
      var useB = this.button(px - pw / 2 + 90 * s, py + ph / 2 - 34 * s, 150 * s, 34 * s, 'Usar / Equipar', function () {
        var g = SV.Game;
        if (SV.Game.ui.selectedSlot >= 0) g.scene.useSlot(SV.Game.ui.selectedSlot);
      });
      c.add([bg, title, hint, closeB, info, infoName, useB].concat(this.flattenCells()));
      this.renderInventory(SV.Game.lastHud || {});
    },

    flattenCells: function () {
      var out = [];
      for (var i = 0; i < this.invCells.length; i++) out.push(this.invCells[i].bg, this.invCells[i].icon, this.invCells[i].count);
      return out;
    },

    renderInventory: function (d) {
      if (!this.invCells) return;
      for (var i = 0; i < this.invCells.length; i++) {
        var cell = this.invCells[i], it = d.all ? d.all[i] : null;
        cell.bg.setTexture(SV.slotKey(this, 56, i === this.selectedSlot || (i < 6 && i === d.equipped)));
        if (it) {
          cell.icon.setVisible(true).setTexture('icon_' + (SV.Items.get(it.id).icon || 'stone'));
          cell.count.setVisible(SV.Items.get(it.id).stack > 1 && it.n > 1).setText('x' + it.n);
        } else { cell.icon.setVisible(false); cell.count.setVisible(false); }
      }
    },

    clickInvSlot: function (i) {
      var g = SV.Game;
      if (this.selectedSlot === i) { g.scene.useSlot(i); this.selectedSlot = -1; }
      else if (this.selectedSlot < 0) this.selectedSlot = i;
      else { g.inv.move(this.selectedSlot, i); g.scene.selectSlot(Math.min(g.state.equipped, 5)); this.selectedSlot = -1; g.scene.syncHud(); }
      SV.Audio.play('ui');
      this.renderInventory(SV.Game.lastHud || {});
    },

    /* ---------------- Fabricação ---------------- */
    layoutCraft: function () {
      var c = this.craftPanel;
      c.removeAll(true);
      var s = this.s || 1, W = this.scale.width, H = this.scale.height;
      var pw = Math.min(W - 16 * s, 486 * s), ph = Math.min(H - 26 * s, 520 * s);
      var px = W / 2, py = H / 2;
      var bg = this.add.image(px, py, SV.panelKey(this, Math.round(pw / s), Math.round(ph / s), { r: 12 })).setScale(s);
      var title = this.mkText(px - pw / 2 + 100 * s, py - ph / 2 + 26 * s, 'FABRICAÇÃO', 20, '#eaf4fb');
      var closeB = this.button(px + pw / 2 - 26 * s, py - ph / 2 + 24 * s, 34 * s, 30 * s, 'X', function () { SV.Game.ui.close(); });
      var tabs = SV.Recipes.tabs, tabBtns = [];
      var tstep = (pw - 76 * s) / tabs.length;
      for (var t = 0; t < tabs.length; t++) {
        (function (label, idx) {
          var on = label === SV.Game.ui.craftTab;
          var b = SV.Game.ui.button(px - pw / 2 + 38 * s + tstep * (idx + 0.5), py - ph / 2 + 58 * s,
            tstep - 6 * s, 26 * s, label, function () {
              SV.Game.ui.craftTab = label; SV.Game.ui.layoutCraft();
            }, { size: 11, bg: on ? '#2f6f8f' : '#1d3b55' });
          tabBtns.push(b);
        })(tabs[t], t);
      }
      var list = this.add.container(0, 0);
      var self = this;
      var rows = SV.Recipes.filter(function (r) { return r.tab === self.craftTab; });
      var pitch = Phaser.Math.Clamp((ph - 150 * s) / Math.max(1, rows.length), 40 * s, 60 * s);
      var y0 = py - ph / 2 + 84 * s + pitch / 2;
      var txtW = pw - 74 * s - 108 * s;
      for (var i = 0; i < rows.length; i++) {
        (function (rec, idx) {
          var y = y0 + idx * pitch;
          var unlocked = SV.Recipes.unlocked(rec, SV.Game.state);
          var aff = SV.Recipes.affordable(rec, SV.Game.inv);
          var needsFire = rec.station === 'fire' && !(SV.Game.lastHud && SV.Game.lastHud.nearFire);
          var card = self.add.image(px, y, SV.panelKey(self, Math.round((pw - 34 * s) / s), Math.round((pitch - 5 * s) / s), { r: 7, noShadow: true, bg: '#1a2c3e' })).setScale(s);
          var outId = rec.out.item || rec.out.repair;
          var ic = self.add.image(px - pw / 2 + 40 * s, y, 'icon_' + (outId ? (SV.Items.get(outId).icon || 'stone') : 'stone')).setScale(s * 1.6);
          var nm = self.mkText(px - pw / 2 + 68 * s, y - pitch * 0.28,
            rec.out.repair ? ('Reparar ' + SV.Items.name(rec.out.repair)) : SV.Items.name(rec.out.item), 13, '#eaf4fb').setOrigin(0, 0.5);
          var costTxt = [];
          for (var k in rec.cost) costTxt.push(SV.Items.name(k) + ' ' + SV.Game.inv.count(k) + '/' + rec.cost[k]);
          var cost = self.mkText(px - pw / 2 + 68 * s, y + pitch * 0.02,
            costTxt.join(' · ') + (rec.station === 'fire' ? ' (fogueira)' : ''), 10, aff.ok ? '#9fd4e8' : '#ff9a8a')
            .setOrigin(0, 0.5).setWordWrapWidth(txtW, false);
          var ds = self.mkText(px - pw / 2 + 68 * s, y + pitch * 0.28,
            unlocked ? rec.desc : 'Bloqueado: ' + (rec.unlock.built ? 'construa ' + SV.Items.name(rec.unlock.built).toLowerCase() + ' primeiro' : 'em breve'),
            9, '#8fb8d0').setOrigin(0, 0.5).setWordWrapWidth(txtW, false);
          var btn = self.button(px + pw / 2 - 56 * s, y, 92 * s, Math.min(30 * s, pitch * 0.55),
            unlocked ? (needsFire ? 'Sem fogo' : 'Fabricar') : 'Bloqueado',
            function () {
              if (!unlocked) return;
              if (SV.Game.scene.craft(rec)) { SV.Game.ui.layoutCraft(); }
            }, { disabled: !unlocked || needsFire || !aff.ok, size: 11 });
          list.add([card, ic, nm, cost, ds, btn]);
        })(rows[i], i);
      }
      var scrollHint = this.mkText(px, py + ph / 2 - 22 * s, 'Receitas aparecem conforme você evolui no acampamento.', 11, '#7f9fb5');
      c.add([bg, title, closeB].concat(tabBtns).concat([list, scrollHint]));
    },

    /* ---------------- Pausa / ajustes ---------------- */
    layoutPause: function () {
      var self = this, s = this.s || 1, W = this.scale.width, H = this.scale.height;
      var c = this.pausePanel;
      c.removeAll(true);
      var pw = 330 * s, ph = 430 * s;
      var px = W / 2, py = H / 2;
      var bg = this.add.image(px, py, SV.panelKey(this, Math.round(pw / s), Math.round(ph / s), { r: 12 })).setScale(s);
      var title = this.mkText(px, py - ph / 2 + 32 * s, 'PAUSA', 24, '#eaf4fb');
      var sub = this.mkText(px, py - ph / 2 + 56 * s, 'Sua jornada está salva automaticamente', 11, '#9fd4e8');
      var y = py - ph / 2 + 92 * s;
      var b1 = this.button(px, y, 240 * s, 36 * s, 'Continuar', function () { self.close(); SV.Game.scene.setPaused(false); });
      var b2 = this.button(px, y + 44 * s, 240 * s, 36 * s, 'Salvar agora', function () { SV.Game.scene.save(); self.toast('Progresso salvo.', '#8affb0'); });
      var b3 = this.button(px, y + 88 * s, 240 * s, 36 * s, 'Controles', function () { self.showHelp(); });
      var b4 = this.button(px, y + 132 * s, 240 * s, 36 * s, 'Nova partida', function () {
        SV.Save.clear();
        SV.Game.state = null;
        self.scene.stop('Game'); self.scene.stop('Ui');
        self.scene.start('Menu');
      });
      var b5 = this.button(px, y + 176 * s, 240 * s, 36 * s, 'Menu principal', function () {
        SV.Game.scene.save();
        self.scene.stop('Game'); self.scene.stop('Ui'); self.scene.start('Menu');
      });

      /* ajustes de áudio e controles */
      var ay = y + 232 * s;
      var lbl = this.mkText(px - pw / 2 + 30 * s, ay, 'Sons', 13, '#eaf4fb').setOrigin(0, 0.5);
      var vol = this.slider(px + 20 * s, ay, 170 * s, SV.Game.state.settings.sfx, function (v) {
        SV.Game.state.settings.sfx = v; SV.Audio.setVolumes(v, SV.Game.state.settings.music);
      });
      var lbl2 = this.mkText(px - pw / 2 + 30 * s, ay + 30 * s, 'Música', 13, '#eaf4fb').setOrigin(0, 0.5);
      var vol2 = this.slider(px + 20 * s, ay + 30 * s, 170 * s, SV.Game.state.settings.music, function (v) {
        SV.Game.state.settings.music = v; SV.Audio.setVolumes(SV.Game.state.settings.sfx, v);
      });
      var muteB = this.button(px - pw / 2 + 60 * s, ay + 64 * s, 108 * s, 30 * s, SV.Audio.muted ? 'Som: off' : 'Som: on', function () {
        SV.Audio.setMuted(!SV.Audio.muted);
        SV.Game.state.settings.muted = SV.Audio.muted;
        muteB.txt.setText(SV.Audio.muted ? 'Som: off' : 'Som: on');
      }, { size: 12 });
      var touchB = this.button(px + pw / 2 - 78 * s, ay + 64 * s, 130 * s, 30 * s, this.showTouch ? 'Toque: on' : 'Toque: off', function () {
        self.showTouch = !self.showTouch;
        SV.Game.state.settings.touch = self.showTouch;
        touchB.txt.setText(self.showTouch ? 'Toque: on' : 'Toque: off');
        self.layoutTouch(self.scale.width, self.scale.height, self.s);
      }, { size: 12 });

      c.add([bg, title, sub, b1, b2, b3, b4, b5, lbl, vol, lbl2, vol2, muteB, touchB]);
      SV.Game.scene.setPaused(true);
    },

    slider: function (x, y, w, value, cb) {
      var s = this.s || 1;
      var track = this.add.rectangle(x, y, w, 8 * s, 0x0d1a26).setOrigin(0.5, 0.5);
      var fill = this.add.rectangle(x - w / 2, y, w * value, 8 * s, 0x7fc4e8).setOrigin(0, 0.5);
      var hit = this.add.rectangle(x, y, w, 26 * s, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      var knob = this.add.circle(x - w / 2 + w * value, y, 8 * s, 0xeaf4fb);
      function upd(px) {
        var v = SV.clamp((px - (x - w / 2)) / w, 0, 1);
        fill.setSize(Math.max(1, w * v), 8 * s);
        knob.x = x - w / 2 + w * v;
        cb(v);
      }
      hit.on('pointerdown', function (p) { upd(p.x); });
      hit.on('pointermove', function (p) { if (p.isDown) upd(p.x); });
      return this.add.container(0, 0).add([track, fill, knob, hit]);
    },

    showHelp: function () {
      var self = this, s = this.s || 1, W = this.scale.width, H = this.scale.height;
      if (this.helpPanel) this.helpPanel.destroy();
      this.helpPanel = this.add.container(0, 0).setDepth(130);
      var pw = 420 * s, ph = 380 * s;
      var bg = this.add.image(W / 2, H / 2, SV.panelKey(this, Math.round(pw / s), Math.round(ph / s), { r: 12 })).setScale(s);
      var t = this.mkText(W / 2, H / 2 - ph / 2 + 30 * s, 'COMO JOGAR', 20, '#eaf4fb');
      var lines = [
        'W A S D / setas — mover        Shift — correr',
        'E — coletar e interagir         Espaço — rolar / esquivar',
        'Clique esquerdo — usar ferramenta equipada',
        '1 a 6 — escolher item da barra  Tab — inventário',
        'C — fabricação                  Esc — pausa',
        '',
        'Sobrevivência: coma frutas e carne, beba água potável',
        '(ferva a água do rio na fogueira) e mantenha-se aquecido.',
        'Noite e chuva derrubam a temperatura; perto do fogo você',
        'recupera energia e cozinha alimentos.',
        'Corte árvores com o machado, fabrique lança para caçar',
        'capivaras e construa um abrigo para descansar da chuva.'
      ].join('\n');
      var body = this.mkText(W / 2, H / 2 + 8 * s, lines, 13, '#cfe6f5').setOrigin(0.5).setLineSpacing(6 * s);
      body.setAlign('center');
      var closeB = this.button(W / 2, H / 2 + ph / 2 - 34 * s, 150 * s, 34 * s, 'Fechar', function () {
        self.helpPanel.destroy(); self.helpPanel = null;
      });
      this.helpPanel.add([bg, t, body, closeB]);
    },

    /* ================================================================ *
     * CONTROLES DE TOQUE                                               *
     * ================================================================ */
    buildTouchControls: function () {
      var self = this;
      this.touch = this.add.container(0, 0).setDepth(90);
      this.joyBase = this.add.circle(0, 0, 52, 0x0d1a26, 0.42).setStrokeStyle(3, 0x7fc4e8, 0.6);
      this.joyKnob = this.add.circle(0, 0, 24, 0x16283c, 0.85).setStrokeStyle(3, 0xbfe8ff, 0.9);
      this.joyHit = this.add.rectangle(0, 0, 190, 190, 0xffffff, 0.001).setInteractive();
      this.touch.add([this.joyHit, this.joyBase, this.joyKnob]);

      this.joyHit.on('pointerdown', function (p) { self.joyActive = p.id; self.joyMove(p); });
      this.joyHit.on('pointermove', function (p) { if (self.joyActive === p.id) self.joyMove(p); });
      this.joyHit.on('pointerup', function (p) { if (self.joyActive === p.id) self.joyRelease(); });
      this.joyHit.on('pointerout', function (p) { if (self.joyActive === p.id) self.joyRelease(); });

      this.touchBtns = [];
      var defs = [
        ['Ação', function () { SV.Game.scene.interact(); }],
        ['Ataque', function () { SV.Game.scene.attack(); }],
        ['Correr', function () { SV.Game.touch.run = !SV.Game.touch.run; self.updateRunBtn(); }, 'run'],
        ['Inv.', function () { self.toggle('inv'); }],
        ['Fab.', function () { self.toggle('craft'); }]
      ];
      defs.forEach(function (d) {
        var b = self.button(0, 0, 66, 66, d[0], d[1], { size: 13 });
        b.tag = d[2];
        self.touch.add(b);
        self.touchBtns.push(b);
      });
      this.layoutTouch(this.scale.width, this.scale.height, this.s || 1);
    },

    updateRunBtn: function () {
      var b = this.touchBtns.filter(function (x) { return x.tag === 'run'; })[0];
      if (b) b.txt.setText(SV.Game.touch.run ? 'Corr.' : 'Andar');
    },

    joyMove: function (p) {
      var dx = p.x - this.joyBase.x, dy = p.y - this.joyBase.y;
      var len = Math.hypot(dx, dy), max = 52 * (this.s || 1);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.joyKnob.setPosition(this.joyBase.x + dx, this.joyBase.y + dy);
      SV.Game.touch.x = SV.clamp(dx / max, -1, 1);
      SV.Game.touch.y = SV.clamp(dy / max, -1, 1);
    },

    joyRelease: function () {
      this.joyActive = null;
      this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
      SV.Game.touch.x = 0; SV.Game.touch.y = 0;
    },

    layoutTouch: function (W, H, s) {
      if (!this.touch) return;
      var show = this.showTouch;
      this.touch.setVisible(show);
      if (!show) return;
      this.joyBase.setPosition(96 * s, H - 116 * s);
      this.joyKnob.setPosition(96 * s, H - 116 * s);
      this.joyHit.setPosition(96 * s, H - 116 * s).setSize(210 * s, 210 * s);
      var order = ['Ação', 'Ataque', 'Correr', 'Inv.', 'Fab.'];
      var pos = [[W - 74 * s, H - 96 * s], [W - 158 * s, H - 150 * s], [W - 66 * s, H - 208 * s], [W - 152 * s, H - 34 * s], [W - 60 * s, H - 30 * s]];
      for (var i = 0; i < this.touchBtns.length; i++) {
        var b = this.touchBtns[i];
        b.img.setPosition(pos[i][0], pos[i][1]).setScale(s * 0.9);
        b.txt.setPosition(pos[i][0], pos[i][1]).setFontSize(13 * s);
      }
      this.updateRunBtn();
    },

    /* ================================================================ *
     * MORTE                                                            *
     * ================================================================ */
    showDeath: function () {
      var self = this, s = this.s || 1, W = this.scale.width, H = this.scale.height;
      if (this.deathPanel) return;
      SV.Game.paused = true;
      this.deathPanel = this.add.container(0, 0).setDepth(400);
      var bg = this.add.rectangle(W / 2, H / 2, W, H, 0x120a0a, 0.8).setInteractive();
      var t = this.mkText(W / 2, H / 2 - 60 * s, 'Você não resistiu', 34, '#ff8a7a');
      var st = SV.Game.state;
      function simStats() {
        return 'Missões concluídas: ' + st.mission.index + ' · Mortes: ' + st.deaths;
      }
      var info = this.mkText(W / 2, H / 2 - 18 * s, 'Sobreviveu até o dia ' + st.day + ' · ' + simStats(), 14, '#cfe6f5');
      var b1 = this.button(W / 2, H / 2 + 40 * s, 220 * s, 40 * s, 'Recomecer perto do acampamento', function () {
        self.deathPanel.destroy(); self.deathPanel = null;
        SV.Game.scene.respawn();
      }, { size: 13 });
      var b2 = this.button(W / 2, H / 2 + 92 * s, 220 * s, 36 * s, 'Carregar último save', function () {
        var saved = SV.Save.read();
        self.deathPanel.destroy(); self.deathPanel = null;
        self.scene.stop('Game'); self.scene.stop('Ui');
        self.scene.start('Game', { state: saved });
      }, { size: 13 });
      this.deathPanel.add([bg, t, info, b1, b2]);
    },

    hideDeath: function () {
      if (this.deathPanel) { this.deathPanel.destroy(); this.deathPanel = null; }
      SV.Game.paused = false;
    }
  });

  SV.UiScene = UI;
})(window.SV);
