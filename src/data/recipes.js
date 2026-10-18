/*
 * recipes.js — receitas de fabricação, construção e cozimento.
 * station 'hand' = em qualquer lugar | 'fire' = exige fogueira acesa por perto
 * unlock = condição de progressão registrada no estado do jogador
 */
(function (SV) {
  'use strict';

  SV.Recipes = [
    /* --- ferramentas básicas --- */
    { id: 'r_axe', out: { item: 'axe', n: 1 }, cost: { stone: 2, branch: 3, fiber: 2 }, station: 'hand',
      unlock: null, tab: 'Ferramentas', desc: 'Permite cortar árvores e troncos caídos.' },
    { id: 'r_spear', out: { item: 'spear', n: 1 }, cost: { branch: 4, stone: 2, fiber: 2 }, station: 'hand',
      unlock: null, tab: 'Ferramentas', desc: 'Defesa contra animais e caça.' },
    { id: 'r_spear2', out: { item: 'spear2', n: 1 }, cost: { branch: 4, flint: 2, fiber: 3, rope: 1 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Ferramentas', desc: 'Lança de caça: mais dano e mais alcance.' },
    { id: 'r_spear3', out: { item: 'spear3', n: 1 }, cost: { wood: 3, flint: 3, fiber: 4, rope: 2 }, station: 'hand',
      unlock: { day: 12 }, tab: 'Ferramentas', desc: 'Farpa de osso: a presa sangra enquanto foge.' },
    { id: 'r_rod', out: { item: 'rod', n: 1 }, cost: { wood: 2, branch: 3, rope: 2, fiber: 2 }, station: 'hand',
      unlock: null, tab: 'Ferramentas', desc: 'Pesque na beira do rio: equipe e pressione E perto da água.' },
    { id: 'r_rope', out: { item: 'rope', n: 1 }, cost: { fiber: 4 }, station: 'hand',
      unlock: null, tab: 'Materiais', desc: 'Fibras trançadas para construções.' },
    { id: 'r_waterskin', out: { item: 'waterskin', n: 1 }, cost: { coconut: 2, fiber: 3, rope: 1 }, station: 'hand',
      unlock: null, tab: 'Ferramentas', desc: 'Recipiente para transportar água do rio.' },
    { id: 'r_axe2', out: { item: 'axe2', n: 1 }, cost: { flint: 2, stone: 2, wood: 4, rope: 1 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Ferramentas', desc: 'Mais durável e corta o dobro por golpe.' },

    /* --- construção --- */
    { id: 'r_campfire', out: { item: 'campfire', n: 1 }, cost: { wood: 4, branch: 4, fiber: 3, stone: 2 }, station: 'hand',
      unlock: null, tab: 'Construção', desc: 'Fogo, luz, calor e cozinha.' },
    { id: 'r_firecover', out: { item: 'firecover', n: 1 }, cost: { branch: 6, leaf: 6, rope: 2, wood: 2 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Construção', desc: 'Telhado sobre a fogueira: a chuva não apaga o fogo.' },
    { id: 'r_shelter', out: { item: 'shelter', n: 1 }, cost: { wood: 8, branch: 6, fiber: 6, rope: 2 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Construção', desc: 'Abrigo contra a chuva; dá bônus de descanso.' },
    { id: 'r_wall', out: { item: 'wall', n: 2 }, cost: { wood: 4, branch: 2, rope: 1 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Construção', desc: 'Barreira que bloqueia animais.' },
    { id: 'r_bed', out: { item: 'bed', n: 1 }, cost: { fiber: 8, leaf: 6, wood: 4, rope: 2 }, station: 'hand',
      unlock: { built: 'shelter' }, tab: 'Construção', desc: 'Dormir recupera energia até o amanhecer.' },
    { id: 'r_torch', out: { item: 'torch', n: 1 }, cost: { branch: 2, fiber: 3, wood: 1 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Ferramentas', desc: 'Ilumina a noite. Precisa ser acesa na fogueira.' },

    /* --- comida e água (exigem fogueira) --- */
    { id: 'r_cook', out: { item: 'cooked_meat', n: 1 }, cost: { raw_meat: 1 }, station: 'fire',
      unlock: null, tab: 'Fogueira', desc: 'Carne assada: mais nutrição e risco zero.' },
    { id: 'r_cookfish', out: { item: 'cooked_fish', n: 1 }, cost: { raw_fish: 1 }, station: 'fire',
      unlock: null, tab: 'Fogueira', desc: 'Peixe assado na brasa: seguro e nutritivo.' },
    { id: 'r_boil', out: { item: 'clean_water', n: 1 }, cost: { dirty_water: 1 }, station: 'fire',
      unlock: null, tab: 'Fogueira', desc: 'Ferve a água suja e a torna potável.' },
    { id: 'r_roast_mush', out: { item: 'cooked_meat', n: 1 }, cost: { mushroom: 3 }, station: 'fire',
      unlock: null, tab: 'Fogueira', desc: 'Refogado de cogumelos comestíveis.' },

    /* --- reparo --- */
    { id: 'r_repair_axe', out: { repair: 'axe' }, cost: { stone: 1, fiber: 1 }, station: 'hand',
      unlock: null, tab: 'Reparo', desc: 'Restaura 40% da durabilidade do machado.' },
    { id: 'r_repair_spear', out: { repair: 'spear' }, cost: { branch: 1, fiber: 1 }, station: 'hand',
      unlock: null, tab: 'Reparo', desc: 'Restaura 40% da durabilidade da lança.' },
    { id: 'r_repair_spear2', out: { repair: 'spear2' }, cost: { flint: 1, fiber: 1 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Reparo', desc: 'Reaponta a lança de caça (40%).' },
    { id: 'r_repair_spear3', out: { repair: 'spear3' }, cost: { flint: 1, rope: 1 }, station: 'hand',
      unlock: { day: 12 }, tab: 'Reparo', desc: 'Recoloca a farpa da lança (40%).' },
    { id: 'r_repair_rod', out: { repair: 'rod' }, cost: { branch: 1, rope: 1 }, station: 'hand',
      unlock: null, tab: 'Reparo', desc: 'Troca a linha da vara de pesca (40%).' },
    { id: 'r_flint', out: { item: 'flint', n: 1 }, cost: { stone: 3 }, station: 'hand',
      unlock: { built: 'campfire' }, tab: 'Materiais', desc: 'Lascas a pedra em um fio cortante.' }
  ];

  /** Abas exibidas no painel de fabricação. */
  SV.Recipes.tabs = ['Ferramentas', 'Construção', 'Fogueira', 'Materiais', 'Reparo'];

  /** Uma receita está disponível se a condição de progressão foi atingida. */
  SV.Recipes.unlocked = function (rec, state) {
    if (!rec.unlock) return true;
    if (rec.unlock.built) return !!state.built[rec.unlock.built];
    if (rec.unlock.day) return state.day >= rec.unlock.day;
    return true;
  };

  /** O jogador tem os recursos necessários? Retorna {ok, missing:[nomes]}. */
  SV.Recipes.affordable = function (rec, inv) {
    var missing = [];
    for (var k in rec.cost) {
      if (inv.count(k) < rec.cost[k]) missing.push(SV.Items.name(k) + ' (' + inv.count(k) + '/' + rec.cost[k] + ')');
    }
    return { ok: missing.length === 0, missing: missing };
  };
})(window.SV);
