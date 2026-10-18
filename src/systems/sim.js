/*
 * sim.js — simulação de tempo, clima, temperatura e estatísticas de
 * sobrevivência. 100% lógica pura: recebe deltas de tempo e um contexto do
 * jogador, devolve eventos. Nenhum acesso a Phaser aqui.
 */
(function (SV) {
  'use strict';

  var DAY_SECONDS = 720;          // duração de um dia completo de jogo
  var HOUR = 24 / DAY_SECONDS;    // horas de jogo por segundo real
  var MAX_DAY = 365;              // a partida completa um ano na floresta

  var WEATHER = {
    clear: { label: 'Sol', temp: 1.6, rain: 0, light: 0, wet: 0.0, next: { cloudy: 0.45, rain: 0.25, clear: 0.3 } },
    cloudy: { label: 'Nublado', temp: -0.8, rain: 0, light: -0.12, wet: 0.0, next: { rain: 0.45, clear: 0.3, storm: 0.1, cloudy: 0.15 } },
    rain: { label: 'Chuva', temp: -4.2, rain: 0.62, light: -0.28, wet: 0.55, next: { storm: 0.22, cloudy: 0.4, rain: 0.28, clear: 0.1 } },
    storm: { label: 'Tempestade', temp: -6.4, rain: 1, light: -0.4, wet: 0.9, next: { rain: 0.5, cloudy: 0.3, storm: 0.15, clear: 0.05 } }
  };
  SV.WEATHER = WEATHER;

  /**
   * Estações de ~91 dias cada: deslocam o clima, a temperatura e o consumo.
   * `rain`/`dry` são multiplicadores de probabilidade (chuva vs. sol),
   * `wear`/`thirst` multiplicam a fome e a sede.
   */
  var SEASONS = [
    { name: 'Estação Chuvosa', temp: -1.5, rain: 1.45, dry: 0.70, wear: 1.00, thirst: 0.85 },
    { name: 'Calor de Verão', temp: 2.4, rain: 0.80, dry: 1.20, wear: 1.05, thirst: 1.30 },
    { name: 'Estação Seca', temp: 1.2, rain: 0.45, dry: 1.35, wear: 1.15, thirst: 1.20 },
    { name: 'Noites Frias', temp: -2.8, rain: 1.00, dry: 1.00, wear: 1.25, thirst: 0.90 }
  ];
  SV.SEASONS = SEASONS;
  var SEASON_LEN = Math.ceil(MAX_DAY / SEASONS.length);

  function Sim(state) {
    this.s = state;
    if (!state.clock) state.clock = 15.666;          // começa às 15:40, como na referência
    if (state.day === undefined) state.day = 1;
    state.day = SV.clamp(state.day, 1, MAX_DAY);
    if (!state.weather) state.weather = { kind: 'rain', timer: 90 };
    if (!state.stats) state.stats = { hp: 78, food: 62, water: 55, energy: 70, temp: 26, wet: 0.35 };
    if (!state.bodyTemp) state.bodyTemp = 36.5;
    this.thunderTimer = 0;
    this.events = [];
  }
  SV.Sim = Sim;

  Sim.prototype.weatherDef = function () { return WEATHER[this.s.weather.kind] || WEATHER.clear; };

  /** Índice da estação atual (0..3) dentro do ano de 365 dias. */
  Sim.prototype.seasonIdx = function () { return Math.floor((this.s.day - 1) / SEASON_LEN) % SEASONS.length; };
  Sim.prototype.season = function () { return SEASONS[this.seasonIdx()]; };

  /** Progresso da partida: 0 no dia 1, 1 no dia 365. */
  Sim.prototype.progress = function () { return SV.clamp((this.s.day - 1) / (MAX_DAY - 1), 0, 1); };

  /** Fração do dia 0..1 (0 = meia-noite). */
  Sim.prototype.dayFraction = function () { return (this.s.clock % 24) / 24; };

  /** Escuridão ambiente 0 (dia) .. 1 (noite fechada). */
  Sim.prototype.darkness = function () {
    var h = this.s.clock % 24;
    // amanhecer 5:30-7:00, anoitecer 17:30-19:30
    if (h >= 7 && h <= 17.5) return 0;
    if (h > 17.5 && h < 19.5) return SV.smoothstep((h - 17.5) / 2) * 0.92;
    if (h >= 19.5 || h < 5.5) return 0.92;
    if (h >= 5.5 && h < 7) return (1 - SV.smoothstep((h - 5.5) / 1.5)) * 0.92;
    return 0;
  };

  Sim.prototype.hourLabel = function () {
    var h = Math.floor(this.s.clock % 24), m = Math.floor((this.s.clock % 1) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };

  /** Temperatura ambiente estimada (o que aparece no termômetro da HUD). */
  Sim.prototype.ambientTemp = function () {
    var w = this.weatherDef();
    var h = this.s.clock % 24;
    // curva diária simples: mínima às 5h, máxima às 14h
    var daily = Math.cos(((h - 14) / 24) * Math.PI * 2) * 4.2;
    var t = 25.5 + daily + w.temp + this.season().temp;
    if (this.nearFire) t += 3.5;
    return Math.round(t * 10) / 10;
  };

  /**
   * Avança a simulação.
   * @param dt segundos reais
   * @param ctx {moving, running, actionCost, nearFire, inShelter, inWater}
   */
  Sim.prototype.update = function (dt, ctx) {
    var s = this.s, st = s.stats, ev = [];
    ctx = ctx || {};
    this.nearFire = !!ctx.nearFire;

    /* ---- relógio ---- */
    var prev = s.clock;
    var sea = this.season(), ramp = 1 + 0.22 * this.progress();
    s.clock += dt * HOUR;
    if (s.clock >= 24) {
      s.clock -= 24;
      /* o ano fecha no dia 365; depois disso o relógio continua,
         mas a partida entra em modo livre sem contar novos dias */
      if (s.day < MAX_DAY) {
        s.day++;
        ev.push({ t: 'dawn' });
        if (s.day >= MAX_DAY) ev.push({ t: 'survived' });
      }
    }
    if (prev < 18 && s.clock >= 18) ev.push({ t: 'dusk' });

    /* ---- clima ---- */
    s.weather.timer -= dt;
    if (s.weather.timer <= 0) {
      var next = this.weatherDef().next, k, acc = 0, bias = {};
      /* a estação inclina a transição: chuvosa empurra para chuva/temporal,
         seca empurra para sol e nuvens */
      for (k in next) {
        var b = (k === 'rain' || k === 'storm') ? sea.rain : (k === 'clear' || k === 'cloudy') ? sea.dry : 1;
        bias[k] = next[k] * b; acc += bias[k];
      }
      var r = Math.random() * acc, pick = s.weather.kind;
      for (k in bias) { r -= bias[k]; if (r <= 0) { pick = k; break; } }
      s.weather.kind = pick;
      s.weather.timer = 70 + Math.random() * 150;
      ev.push({ t: 'weather', kind: pick });
    }
    var w = this.weatherDef();
    if (w.rain > 0.8 && this.thunderTimer <= 0 && Math.random() < dt * 0.06) {
      this.thunderTimer = 3 + Math.random() * 4;
      ev.push({ t: 'thunder' });
    }
    this.thunderTimer = Math.max(0, this.thunderTimer - dt);

    /* ---- umidade do corpo (roupa molhada) ---- */
    var wetTarget = (w.wet * (ctx.inShelter ? 0.15 : 1)) + (ctx.inWater ? 0.6 : 0);
    st.wet = SV.clamp(st.wet + (wetTarget - st.wet) * dt * (wetTarget > st.wet ? 0.09 : 0.05), 0, 1);

    /* ---- temperatura corporal ---- */
    var ambient = this.ambientTemp();
    var target = 36.6;
    var cold = (Math.max(0, 20 - ambient) * 0.16 + st.wet * 1.6 - (ctx.nearFire ? 2.4 : 0)) * ramp;
    target -= cold;
    s.bodyTemp = SV.lerp(s.bodyTemp, SV.clamp(target, 30, 37.2), Math.min(1, dt * 0.25));

    /* ---- consumo ---- */
    var activity = ctx.running ? 2.1 : (ctx.moving ? 1.35 : 1);
    st.food = SV.clamp(st.food - dt * 0.19 * activity * sea.wear * ramp, 0, 100);
    st.water = SV.clamp(st.water - dt * (0.24 * activity * sea.thirst * ramp + st.wet * 0.02), 0, 100);
    var energyDrain = ctx.running ? 2.6 : (ctx.moving ? 0.55 : 0.16);
    if (ctx.nearFire && !ctx.moving) energyDrain = -1.1;         // descansar junto do fogo recupera
    if (ctx.inShelter && !ctx.moving) energyDrain = -2.2;
    st.energy = SV.clamp(st.energy - dt * energyDrain + (ctx.actionCost || 0), 0, 100);

    /* ---- vida ---- */
    var dmg = 0;
    if (st.food <= 0) dmg += 0.9;
    if (st.water <= 0) dmg += 1.5;
    if (s.bodyTemp < 34) dmg += (34 - s.bodyTemp) * 0.42;
    if (st.energy <= 0 && ctx.running) dmg += 0.4;
    if (dmg > 0) st.hp = SV.clamp(st.hp - dmg * dt, 0, 100);
    /* comer/beber regenera, mas nunca levanta quem já chegou a zero:
       assim um ataque de animal pode realmente causar a morte */
    else if (st.hp > 0 && st.food > 55 && st.water > 45 && st.hp < 100) st.hp = SV.clamp(st.hp + dt * 0.35, 0, 100);

    if (st.hp <= 0) ev.push({ t: 'death' });
    if (st.food < 15 && !this._hungryWarned) { this._hungryWarned = true; ev.push({ t: 'warn', msg: 'Você está com fome.' }); }
    if (st.food > 30) this._hungryWarned = false;
    if (st.water < 15 && !this._thirstWarned) { this._thirstWarned = true; ev.push({ t: 'warn', msg: 'Você está com sede.' }); }
    if (st.water > 30) this._thirstWarned = false;
    if (s.bodyTemp < 34.2 && !this._coldWarned) { this._coldWarned = true; ev.push({ t: 'warn', msg: 'Hipotermia! Aproxime-se do fogo.' }); }
    if (s.bodyTemp > 35.4) this._coldWarned = false;

    this.events = ev;
    return ev;
  };

  Sim.DAY_SECONDS = DAY_SECONDS;
  Sim.MAX_DAY = MAX_DAY;
  Sim.SEASON_LEN = SEASON_LEN;
})(window.SV);
