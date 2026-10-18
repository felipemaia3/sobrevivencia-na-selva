/*
 * items.js — catálogo de itens (dados puros, sem lógica de cena).
 * type: resource | consumable | tool | buildable
 */
(function (SV) {
  'use strict';

  SV.Items = {
    branch: { name: 'Graveto', icon: 'branch', type: 'resource', stack: 20, desc: 'Serve para ferramentas e fibras.' },
    wood: { name: 'Madeira', icon: 'wood', type: 'resource', stack: 20, desc: 'Tábua de árvore caída.' },
    stone: { name: 'Pedra', icon: 'stone', type: 'resource', stack: 20, desc: 'Base para ferramentas de pedra.' },
    flint: { name: 'Pedernal', icon: 'flint', type: 'resource', stack: 10, desc: 'Faisca e corta melhor que a pedra comum.' },
    fiber: { name: 'Fibra Vegetal', icon: 'fiber', type: 'resource', stack: 20, desc: 'Retirada de touceiras e cascas. Amarra e trança.' },
    rope: { name: 'Corda', icon: 'rope', type: 'resource', stack: 10, desc: 'Fibras trançadas. Necessária para construções.' },
    leaf: { name: 'Folha de Palmeira', icon: 'fern', type: 'resource', stack: 20, desc: 'Cobertura para abrigos.' },
    fruit: { name: 'Frutas Silvestres', icon: 'fruit', type: 'consumable', stack: 10, food: 16, water: 6, energy: 3, desc: 'Doces e suculentas. Recupera fome e sede.' },
    berry: { name: 'Frutas Vermelhas', icon: 'berry', type: 'consumable', stack: 10, food: 10, water: 4, desc: 'Pequenas, mas comestíveis.' },
    mushroom: { name: 'Cogumelo', icon: 'mushroom', type: 'consumable', stack: 10, food: 7, risk: 0.18, desc: 'Cru pode fazer mal. Cozinhe na fogueira.' },
    coconut: { name: 'Coco', icon: 'coconut', type: 'consumable', stack: 8, food: 6, water: 22, energy: 5, desc: 'Água fresca de coco. Mata a sede.' },
    raw_meat: { name: 'Carne Crua', icon: 'raw', type: 'consumable', stack: 8, food: 14, water: -2, risk: 0.35, desc: 'Melhor cozinhar antes de comer.' },
    cooked_meat: { name: 'Carne Assada', icon: 'cooked', type: 'consumable', stack: 8, food: 34, energy: 12, hp: 6, desc: 'Comida de verdade. Recupera bastante.' },
    raw_fish: { name: 'Peixe Cru', icon: 'fish_raw', type: 'consumable', stack: 8, food: 18, water: 4, risk: 0.45, desc: 'Recém-pescado. Assa na fogueira antes de comer.' },
    cooked_fish: { name: 'Peixe Assado', icon: 'fish_cook', type: 'consumable', stack: 8, food: 28, water: 2, energy: 10, hp: 5, desc: 'Leve e seguro. A melhor comida do rio.' },
    dirty_water: { name: 'Água Suja', icon: 'waterskin', type: 'consumable', stack: 4, water: 12, risk: 0.55, desc: 'Perigosa. Ferva na fogueira.' },
    clean_water: { name: 'Água Potável', icon: 'purified', type: 'consumable', stack: 4, water: 34, desc: 'Purificada no fogo. Segura para beber.' },

    axe: { name: 'Machado de Pedra', icon: 'axe', type: 'tool', tool: 'axe', stack: 1, dur: 60, tier: 1, desc: 'Corta árvores e troncos. +dano.' },
    axe2: { name: 'Machado Reforçado', icon: 'axe', type: 'tool', tool: 'axe', stack: 1, dur: 120, tier: 2, desc: 'Pedernal e corda. Corta mais rápido.' },
    spear: { name: 'Lança', icon: 'spear', type: 'tool', tool: 'spear', stack: 1, dur: 45, tier: 1, dmg: 1.5, reach: 52, desc: 'Ataca animais à distância curta. Caça.' },
    spear2: { name: 'Lança de Caça', icon: 'spear2', type: 'tool', tool: 'spear', stack: 1, dur: 90, tier: 2, dmg: 2.6, reach: 60, desc: 'Ponta de pedernal: fura mais e alcança mais longe.' },
    spear3: { name: 'Lança Farpada', icon: 'spear3', type: 'tool', tool: 'spear', stack: 1, dur: 130, tier: 3, dmg: 3.6, reach: 68, barbed: true, desc: 'A farpa fica na carne: o animal sangra ao fugir.' },
    rod: { name: 'Vara de Pesca', icon: 'rod', type: 'tool', tool: 'rod', stack: 1, dur: 70, tier: 2, desc: 'Pesque na beira do rio ou do açude. Equipe e pressione E.' },
    torch: { name: 'Tocha', icon: 'torch', type: 'tool', tool: 'torch', stack: 1, dur: 90, tier: 2, light: 130, desc: 'Ilumina a noite. Aquece um pouco.' },
    waterskin: { name: 'Cantil de Coco', icon: 'waterskin', type: 'tool', tool: 'container', stack: 1, dur: 999, tier: 1, desc: 'Encha no rio e depois ferva na fogueira.' },

    campfire: { name: 'Fogueira', icon: 'campfire', type: 'buildable', build: 'campfire', stack: 4, tier: 1, desc: 'Aquece, ilumina, cozinha e purifica água.' },
    firecover: { name: 'Telhado da Fogueira', icon: 'firecover', type: 'buildable', build: 'firecover', stack: 2, tier: 2, desc: 'Cobertura sobre o fogo. A chuva não apaga mais.' },
    shelter: { name: 'Abrigo de Palmeira', icon: 'shelter', type: 'buildable', build: 'shelter', stack: 2, tier: 2, desc: 'Protege da chuva e permite descansar.' },
    bed: { name: 'Cama de Folhas', icon: 'bed', type: 'buildable', build: 'bed', stack: 1, tier: 3, desc: 'Durma e recupere energia até o amanhecer.' },
    wall: { name: 'Barreira de Madeira', icon: 'wall', type: 'buildable', build: 'wall', stack: 6, tier: 2, desc: 'Bloqueia a passagem de animais.' }
  };

  SV.Items.get = function (id) { return SV.Items[id]; };
  SV.Items.name = function (id) { return (SV.Items[id] || { name: id }).name; };
})(window.SV);
