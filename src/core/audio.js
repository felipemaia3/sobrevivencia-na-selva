/*
 * audio.js — áudio 100% procedural (WebAudio): chuva, trovão, fogueira,
 * passos, coleta, golpes, animais, interface e trilha ambiente.
 * Nenhum arquivo de som é carregado.
 */
(function (SV) {
  'use strict';

  var A = {
    ctx: null, master: null, sfxGain: null, musGain: null, noise: null,
    ready: false, muted: false,
    loops: {}
  };
  SV.Audio = A;

  A.init = function () {
    if (A.ready) return;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    A.ctx = new C();
    A.master = A.ctx.createGain(); A.master.gain.value = 0.9; A.master.connect(A.ctx.destination);
    A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = 0.85; A.sfxGain.connect(A.master);
    A.musGain = A.ctx.createGain(); A.musGain.gain.value = 0.28; A.musGain.connect(A.master);

    // buffer de ruído branco reutilizável (2 s)
    var len = A.ctx.sampleRate * 2;
    A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    var d = A.noise.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    A.ready = true;
    A.buildAmbience();
  };

  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

  function src(loop) {
    var s = A.ctx.createBufferSource();
    s.buffer = A.noise; s.loop = !!loop; return s;
  }
  function gain(v) { var g = A.ctx.createGain(); g.gain.value = v; return g; }
  function filter(type, freq, q) {
    var f = A.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f;
  }
  function env(g, t0, peak, dur, hold) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (hold || 0) + dur);
  }
  var now = function () { return A.ctx.currentTime; };

  /* ------------------------------------------------------------------ *
   * Ambientes contínuos                                                 *
   * ------------------------------------------------------------------ */
  A.buildAmbience = function () {
    var c = A.ctx;

    // chuva: ruído filtrado em duas camadas
    var rainG = gain(0.0);
    var rf1 = filter('bandpass', 1800, 0.6), rf2 = filter('highpass', 4200);
    var r1 = src(true), r2 = src(true);
    r1.connect(rf1); rf1.connect(rainG);
    r2.connect(rf2); rf2.connect(gain(0.35)).connect(rainG);
    rainG.connect(A.sfxGain);
    r1.start(); r2.start();
    A.loops.rain = rainG;

    // vento/floresta: ruído grave modulado
    var windG = gain(0.05);
    var wf = filter('lowpass', 420, 0.7);
    var w = src(true); w.connect(wf); wf.connect(windG); windG.connect(A.sfxGain); w.start();
    var lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    var lfoG = gain(0.035); lfo.connect(lfoG); lfoG.connect(windG.gain); lfo.start();
    A.loops.wind = windG;

    // fogueira: ruído passa-baixa + estalos
    var fireG = gain(0.0);
    var ff = filter('lowpass', 620, 1.4);
    var fs = src(true); fs.connect(ff); ff.connect(fireG); fireG.connect(A.sfxGain); fs.start();
    A.loops.fire = fireG;

    // trilha ambiente: pads lentos em escala pentatônica
    A.music = { playing: false, timer: 0 };
    A.loops.music = gain(0.0);
    A.loops.music.connect(A.musGain);
  };

  /** Intensidade 0..1 dos ambientes (chamado pelo GameScene a cada frame). */
  A.setAmbience = function (opts) {
    if (!A.ready) return;
    var t = now();
    A.loops.rain.gain.setTargetAtTime((opts.rain || 0) * 0.22, t, 0.6);
    A.loops.fire.gain.setTargetAtTime((opts.fire || 0) * 0.16, t, 0.4);
    A.loops.wind.gain.setTargetAtTime(0.03 + (opts.night || 0) * 0.05, t, 1.2);
  };

  /* ------------------------------------------------------------------ *
   * Efeitos                                                             *
   * ------------------------------------------------------------------ */
  var SFX = {
    ui: function () {
      var o = A.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 880;
      var g = gain(0.05); o.connect(g); g.connect(A.sfxGain);
      env(g, now(), 0.05, 0.06); o.start(); o.stop(now() + 0.09);
    },
    step: function (p) {
      p = p || 'grass';
      var s = src(false), g = gain(0), f = filter(p === 'mud' ? 'lowpass' : 'bandpass', p === 'mud' ? 320 : (p === 'stone' ? 2600 : 1200), 1.2);
      var amp = p === 'mud' ? 0.12 : 0.07;
      s.connect(f); f.connect(g); g.connect(A.sfxGain);
      env(g, now(), amp, 0.09);
      s.start(); s.stop(now() + 0.12);
    },
    chop: function () {
      var t = now();
      var s = src(false), f = filter('bandpass', 900, 2), g = gain(0);
      s.connect(f); f.connect(g); g.connect(A.sfxGain);
      env(g, t, 0.28, 0.13); s.start(t); s.stop(t + 0.16);
      var o = A.ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.14);
      var og = gain(0); o.connect(og); og.connect(A.sfxGain); env(og, t, 0.2, 0.16); o.start(t); o.stop(t + 0.2);
    },
    pick: function () {
      var t = now(), o = A.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(940, t + 0.1);
      var g = gain(0); o.connect(g); g.connect(A.sfxGain); env(g, t, 0.14, 0.14); o.start(t); o.stop(t + 0.2);
    },
    craft: function () {
      var t = now();
      for (var i = 0; i < 3; i++) {
        var s = src(false), f = filter('bandpass', 1400 + i * 700, 3), g = gain(0);
        s.connect(f); f.connect(g); g.connect(A.sfxGain);
        env(g, t + i * 0.11, 0.16, 0.08); s.start(t + i * 0.11); s.stop(t + i * 0.11 + 0.1);
      }
    },
    hit: function () {
      var t = now(), s = src(false), f = filter('lowpass', 700, 1), g = gain(0);
      s.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.3, 0.11); s.start(t); s.stop(t + 0.14);
      var o = A.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      var og = gain(0); o.connect(og); og.connect(A.sfxGain); env(og, t, 0.14, 0.14); o.start(t); o.stop(t + 0.18);
    },
    hurt: function () {
      var t = now(), o = A.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
      var f = filter('lowpass', 900, 1), g = gain(0);
      o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.2, 0.3); o.start(t); o.stop(t + 0.35);
    },
    eat: function () {
      var t = now();
      for (var i = 0; i < 2; i++) {
        var s = src(false), f = filter('bandpass', 700 + i * 300, 4), g = gain(0);
        s.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t + i * 0.14, 0.14, 0.1); s.start(t + i * 0.14); s.stop(t + i * 0.14 + 0.12);
      }
    },
    drink: function () {
      var t = now();
      for (var i = 0; i < 3; i++) {
        var o = A.ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(300 + i * 90, t + i * 0.1);
        o.frequency.exponentialRampToValueAtTime(160, t + i * 0.1 + 0.09);
        var g = gain(0); o.connect(g); g.connect(A.sfxGain); env(g, t + i * 0.1, 0.1, 0.09); o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.12);
      }
    },
    fireLight: function () {
      var t = now(), s = src(false), f = filter('bandpass', 500, 0.8), g = gain(0);
      s.connect(f); f.connect(g); g.connect(A.sfxGain);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      f.frequency.exponentialRampToValueAtTime(2400, t + 0.8);
      s.start(t); s.stop(t + 1);
    },
    thunder: function () {
      var t = now(), s = src(false), f = filter('lowpass', 260, 0.7), g = gain(0);
      s.connect(f); f.connect(g); g.connect(A.master);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(70, t + 2.5);
      s.start(t); s.stop(t + 2.8);
    },
    capybara: function () {
      var t = now(), o = A.ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(320, t + 0.12);
      var f = filter('lowpass', 1400, 2), g = gain(0);
      o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.06, 0.16); o.start(t); o.stop(t + 0.2);
    },
    bird: function () {
      var t = now();
      for (var i = 0; i < 3; i++) {
        var o = A.ctx.createOscillator(); o.type = 'sine';
        var f0 = 1600 + Math.random() * 1400;
        o.frequency.setValueAtTime(f0, t + i * 0.09);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + i * 0.09 + 0.06);
        var g = gain(0); o.connect(g); g.connect(A.sfxGain); env(g, t + i * 0.09, 0.05, 0.07); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.09);
      }
    },
    toucan: function () {
      var t = now();
      for (var i = 0; i < 4; i++) {
        var o = A.ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(900 - i * 90, t + i * 0.07);
        var f = filter('bandpass', 1200, 6), g = gain(0);
        o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t + i * 0.07, 0.05, 0.05); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.07);
      }
    },

    /* ---- vozes da fauna brasileira ---------------------------------- *
     * Cada espécie tem um chamado curto (contato) e os predadores têm um
     * rosnado longo usado quando começam a perseguir o jogador.         *
     * ------------------------------------------------------------------ */
    tapir: function () {
      var t = now();
      for (var i = 0; i < 2; i++) {
        var t0 = t + i * 0.26, o = A.ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(300, t0);
        o.frequency.exponentialRampToValueAtTime(168, t0 + 0.2);
        var f = filter('lowpass', 900, 1.2), g = gain(0);
        o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t0, 0.16, 0.24);
        o.start(t0); o.stop(t0 + 0.28);
      }
    },
    deer: function () {
      var t = now(), s = src(false), f = filter('bandpass', 1100, 1.1), g = gain(0);
      s.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.14, 0.18);
      f.frequency.setValueAtTime(1300, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.18);
      s.start(t); s.stop(t + 0.22);
    },
    peccary: function () {
      var t = now();
      for (var i = 0; i < 2; i++) {
        var t0 = t + i * 0.13, o = A.ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(180 - i * 30, t0);
        var f = filter('lowpass', 620, 2.5), g = gain(0);
        o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t0, 0.13, 0.13);
        o.start(t0); o.stop(t0 + 0.16);
      }
    },
    armadillo: function () {
      var t = now(), o = A.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.07);
      var g = gain(0); o.connect(g); g.connect(A.sfxGain); env(g, t, 0.07, 0.09);
      o.start(t); o.stop(t + 0.11);
    },
    coati: function () {
      var t = now();
      for (var i = 0; i < 5; i++) {
        var t0 = t + i * 0.055, o = A.ctx.createOscillator(); o.type = 'square';
        o.frequency.setValueAtTime(1200 + (i % 2) * 380, t0);
        var f = filter('bandpass', 1800, 5), g = gain(0);
        o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t0, 0.06, 0.045);
        o.start(t0); o.stop(t0 + 0.05);
      }
    },
    jaguar: function () {
      var t = now(), o = A.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(72, t + 0.42);
      var f = filter('lowpass', 700, 3), g = gain(0);
      o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.2, 0.45);
      var s = src(false), nf = filter('lowpass', 500, 1.4), ng = gain(0);
      s.connect(nf); nf.connect(ng); ng.connect(A.sfxGain); env(ng, t, 0.1, 0.4);
      o.start(t); o.stop(t + 0.5); s.start(t); s.stop(t + 0.45);
    },
    jaguarGrowl: function () {
      var t = now(), o = A.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(96, t); o.frequency.linearRampToValueAtTime(74, t + 1.1);
      var lfo = A.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 24;
      var lg = gain(26); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.2);
      var f = filter('lowpass', 420, 2.2), g = gain(0);
      o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.2, 1.15);
      o.start(t); o.stop(t + 1.2);
    },
    caiman: function () {
      var t = now(), o = A.ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.5);
      var f = filter('lowpass', 380, 3), g = gain(0);
      o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.18, 0.55);
      var s = src(false), hf = filter('highpass', 2600), hg = gain(0);
      s.connect(hf); hf.connect(hg); hg.connect(A.sfxGain); env(hg, t + 0.1, 0.05, 0.3);
      o.start(t); o.stop(t + 0.6); s.start(t); s.stop(t + 0.45);
    },
    macaw: function () {
      var t = now();
      for (var i = 0; i < 2; i++) {
        var t0 = t + i * 0.22, o = A.ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(1500, t0);
        o.frequency.exponentialRampToValueAtTime(620, t0 + 0.18);
        var f = filter('bandpass', 1500, 3), g = gain(0);
        o.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t0, 0.14, 0.2);
        o.start(t0); o.stop(t0 + 0.22);
      }
    },
    levelup: function () {
      var t = now();
      [523, 659, 784, 1046].forEach(function (f0, i) {
        var o = A.ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = f0;
        var g = gain(0); o.connect(g); g.connect(A.sfxGain);
        env(g, t + i * 0.09, 0.12, 0.3); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.4);
      });
    },
    death: function () {
      var t = now();
      [400, 300, 220, 150].forEach(function (f0, i) {
        var o = A.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f0;
        var g = gain(0); o.connect(g); g.connect(A.sfxGain); env(g, t + i * 0.18, 0.16, 0.5); o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.6);
      });
    },
    splash: function () {
      var t = now(), s = src(false), f = filter('bandpass', 1200, 1), g = gain(0);
      s.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t, 0.18, 0.22);
      f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.25);
      s.start(t); s.stop(t + 0.3);
    },
    build: function () {
      var t = now();
      for (var i = 0; i < 2; i++) {
        var s = src(false), f = filter('bandpass', 500, 2), g = gain(0);
        s.connect(f); f.connect(g); g.connect(A.sfxGain); env(g, t + i * 0.16, 0.22, 0.12); s.start(t + i * 0.16); s.stop(t + i * 0.16 + 0.14);
      }
    }
  };

  A.play = function (name, arg) {
    if (!A.ready || A.muted) return;
    var fn = SFX[name];
    if (fn) { try { fn(arg); } catch (e) { /* ignora picos de áudio */ } }
  };

  /* ---- trilha ambiente (opcional, controlada pelo menu) ---- */
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  A.musicTick = function (dt, night) {
    if (!A.ready || !A.musicOn) return;
    A.music.timer -= dt;
    if (A.music.timer > 0) return;
    A.music.timer = 1.6 + Math.random() * 1.6;
    var t = now();
    var base = night ? 174 : 196;
    var n = SCALE[Math.floor(Math.random() * SCALE.length)];
    var f0 = base * Math.pow(2, n / 12);
    [1, 2.001, 3].forEach(function (mult, i) {
      var o = A.ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f0 * mult;
      var g = gain(0); o.connect(g); g.connect(A.loops.music);
      env(g, t, (i === 0 ? 0.3 : 0.09) / (i + 1), 2.4, 0.15);
      o.start(t); o.stop(t + 3);
    });
  };
  A.setMusic = function (on) { A.musicOn = on; };
  A.setVolumes = function (sfx, music) {
    if (!A.ready) return;
    A.sfxGain.gain.value = sfx; A.musGain.gain.value = music * 0.6;
  };
  A.setMuted = function (m) { A.muted = m; if (A.ready) A.master.gain.value = m ? 0 : 0.9; };
})(window.SV);
