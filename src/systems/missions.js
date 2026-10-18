/*
 * missions.js — cadeia de missões (progressão guiada). Cada missão observa
 * eventos vindos do GameScene e guarda progresso em state.mission.
 */
(function (SV) {
  'use strict';

  SV.Missions = [
    {
      id: 'coletar', title: 'Coletar recursos', hint: 'Recolha madeira, pedra e fibra pela floresta.',
      goal: { wood: 6, stone: 3, fiber: 3 },
      reward: 'Aprende a fazer uma fogueira.'
    },
    {
      id: 'fogo', title: 'Dominar o fogo', hint: 'Acenda o anel de pedras do acampamento (E) com 1 graveto ou fibra.',
      goal: { campfireLit: 1 },
      reward: 'Libera receitas de abrigo e tocha.'
    },
    {
      id: 'agua', title: 'Encontrar água potável', hint: 'Encha o cantil no rio e ferva a água na fogueira.',
      goal: { cleanWater: 1 },
      reward: 'Hidratação segura.'
    },
    {
      id: 'comida', title: 'Comer algo cozido', hint: 'Cozinhe carne, peixe ou cogumelos na fogueira.',
      goal: { cookedMeal: 1 },
      reward: 'Nutrição completa.'
    },
    {
      id: 'noite', title: 'Sobreviver à noite', hint: 'Chegue vivo ao próximo amanhecer. Use o fogo contra o frio.',
      goal: { dawn: 1 },
      reward: 'Libera a cama de folhas.'
    },
    {
      id: 'abrigo', title: 'Construir um abrigo', hint: 'Levante um abrigo de palmeira para descansar da chuva.',
      goal: { shelter: 1 },
      reward: 'Descanso protegido.'
    },
    {
      id: 'caca', title: 'Defender-se da fauna', hint: 'Obtenha carne crua usando uma lança.',
      goal: { hunt: 1 },
      reward: 'Fonte estável de comida.'
    },
    {
      id: 'pesca', title: 'Pescar no rio', hint: 'Fabrique a vara, equipe e pressione E na beira do rio.',
      goal: { fish: 2 },
      reward: 'Comida segura direto do rio.'
    },
    {
      id: 'livre', title: 'Sobreviver', hint: 'Explore, colete e resista o máximo de dias que conseguir.',
      goal: null, reward: null
    }
  ];

  /** Estado inicial de progresso de missão. */
  SV.Missions.newState = function () {
    return { index: 0, progress: {}, done: {} };
  };

  /** Registra um evento de progresso. Retorna true se a missão foi concluída. */
  SV.Missions.progress = function (mstate, key, amount) {
    var m = SV.Missions[mstate.index];
    if (!m || !m.goal || !m.goal[key]) return false;
    mstate.progress[key] = (mstate.progress[key] || 0) + (amount === undefined ? 1 : amount);
    return SV.Missions.complete(mstate);
  };

  /** Verifica todas as metas da missão atual. */
  SV.Missions.complete = function (mstate) {
    var m = SV.Missions[mstate.index];
    if (!m || !m.goal) return false;
    for (var k in m.goal) {
      if ((mstate.progress[k] || 0) < m.goal[k]) return false;
    }
    mstate.done[m.id] = true;
    mstate.index = Math.min(mstate.index + 1, SV.Missions.length - 1);
    mstate.progress = {};
    return true;
  };

  SV.Missions.current = function (mstate) { return SV.Missions[Math.min(mstate.index, SV.Missions.length - 1)]; };

  /** Texto de progresso para a HUD, ex.: "Madeira 3/6". */
  SV.Missions.statusText = function (mstate) {
    var m = SV.Missions.current(mstate);
    if (!m.goal) return '';
    var parts = [];
    var names = { wood: 'Madeira', stone: 'Pedra', fiber: 'Fibra', campfireLit: 'Fogueira acesa', cleanWater: 'Água potável', cookedMeal: 'Refeição cozida', dawn: 'Amanhecer', shelter: 'Abrigo', hunt: 'Caça', fish: 'Peixe' };
    for (var k in m.goal) parts.push((names[k] || k) + ' ' + Math.min(mstate.progress[k] || 0, m.goal[k]) + '/' + m.goal[k]);
    return parts.join('  ·  ');
  };
})(window.SV);
