/*
 * fauna.js — tabela de espécies (dados puros, sem Phaser).
 *
 * Cada entrada define duas coisas:
 *   `game`  comportamento e jogabilidade (dieta, vida, velocidades, gotas)
 *   `draw`  receita visual lida por SV.Art.quadruped() em art_entities.js
 *
 * Manter os dois juntos é o que permite adicionar uma espécie nova escrevendo
 * um único bloco aqui — a arte, o spawn e a IA já sabem lidar com ela.
 */
(function (SV) {
  'use strict';

  var F = {

    /* ======================= HERBÍVOROS / OMNÍVOROS =================== */

    capy: {
      label: 'Capivara', order: 'Rosalia',
      game: {
        diet: 'herb', habitat: 'land', hp: 3, dmg: 0,
        walk: 20, flee: 78, fleeAt: 96, rest: 0.7, group: 1,
        drops: [['raw_meat', 2]], sound: 'capybara', meat: 'carne de capivara',
        shadow: 'shadow_0', scale: 1
      },
      draw: {
        w: 42, h: 27,
        body: [21, 14, 13.2, 7.6], belly: [21, 18, 11.4, 4.2],
        legs: { thick: 3.2, front: 30, back: 12, paw: '#3a2416' },
        neck: [31, 12, 5.2], head: [35, 11.6, 5.6, 5.0],
        snout: [39.4, 13.4, 3.4, 3.4], nose: '#241708',
        ear: { type: 'round', at: [32.4, 6.8], r: 2.2 },
        eye: [35.6, 10.4],
        tail: { type: 'none' },
        coat: {
          body: '#8a6a45', dark: '#5f4630', light: '#a58560', belly: '#7d6142',
          pattern: 'none'
        }
      }
    },

    tapir: {
      label: 'Anta', order: 'Perissodactyla',
      game: {
        diet: 'herb', habitat: 'land', hp: 5, dmg: 0,
        walk: 22, flee: 92, fleeAt: 110, rest: 0.5, group: 1,
        drops: [['raw_meat', 4]], sound: 'tapir', meat: 'carne de anta',
        shadow: 'shadow_big', scale: 1.16
      },
      draw: {
        w: 54, h: 38,
        body: [26, 16, 16.5, 9.8], belly: [26, 22, 14, 4.4],
        legs: { thick: 4.2, front: 39, back: 14, paw: '#2b2118' },
        neck: [39, 13, 6.6], head: [44.5, 11.4, 6.2, 5.4],
        snout: [50, 14, 4.6, 4.4], nose: '#20160f', trunk: true,
        ear: { type: 'round', at: [41.4, 5.4], r: 2.9, tip: '#f0e6d2' },
        eye: [44.4, 9.8],
        tail: { type: 'short', len: 3 },
        coat: {
          body: '#5f4d3e', dark: '#3b2e24', light: '#7d6754', belly: '#4a3a2d',
          pattern: 'none'
        }
      }
    },

    deer: {
      label: 'Veado-campeiro', order: 'Artiodactyla',
      game: {
        diet: 'herb', habitat: 'land', hp: 3, dmg: 0,
        walk: 30, flee: 132, fleeAt: 140, rest: 0.4, group: 2, skittish: 1.4,
        drops: [['raw_meat', 3]], sound: 'deer', meat: 'carne de veado',
        shadow: 'shadow_0', scale: 1.02
      },
      draw: {
        w: 48, h: 38,
        body: [23, 19, 11.6, 6.6], belly: [23, 23.8, 8.8, 2.2],
        legs: { thick: 2.6, front: 33, back: 13, paw: '#4a3a24' },
        neck: [32, 14, 4.4], head: [36.5, 11.4, 4.4, 4.0],
        snout: [40.6, 12.8, 2.8, 2.4], nose: '#2a1c10',
        ear: { type: 'point', at: [34.2, 6.8], r: 2.8 },
        horn: { type: 'antler' },
        eye: [37.4, 10.2],
        tail: { type: 'short', len: 4, up: true },
        coat: {
          body: '#b07c4a', dark: '#7d5430', light: '#c99a67', belly: '#dcc9a8',
          pattern: 'spots', density: 9
        }
      }
    },

    peccary: {
      label: 'Queixada', order: 'Artiodactyla',
      game: {
        diet: 'omni', habitat: 'land', hp: 4, dmg: 9, cornered: true,
        walk: 24, flee: 74, fleeAt: 70, rest: 0.5, group: 4,
        drops: [['raw_meat', 3]], sound: 'peccary', meat: 'carne de queixada',
        shadow: 'shadow_0', scale: 1.0
      },
      draw: {
        w: 42, h: 27,
        body: [21, 15, 12.6, 7.4], belly: [21, 19.5, 10.8, 3.8],
        legs: { thick: 3.4, front: 30, back: 12, paw: '#1f1a16' },
        neck: [30, 13, 5.0], head: [35, 12.6, 5.4, 4.8],
        snout: [39.6, 14.4, 3.2, 3.0], nose: '#171310',
        ear: { type: 'point', at: [32.6, 7.2], r: 2.4 },
        eye: [35.6, 11.0],
        tail: { type: 'short', len: 2.4 },
        coat: {
          body: '#4a423b', dark: '#2e2925', light: '#5f564d', belly: '#332d28',
          pattern: 'saddle', saddle: '#8a7b5c'
        }
      }
    },

    armadillo: {
      label: 'Tatu-galinha', order: 'Cingulata',
      game: {
        diet: 'insect', habitat: 'burrow', hp: 2, dmg: 0,
        walk: 16, flee: 46, fleeAt: 62, rest: 0.4, group: 1, digs: true,
        drops: [['raw_meat', 1], ['fiber', 1]], sound: 'armadillo', meat: 'carne de tatu',
        shadow: 'shadow_small', scale: 0.9
      },
      draw: {
        w: 36, h: 20,
        body: [18, 12, 11.0, 5.6], belly: [18, 15.5, 9.2, 2.6],
        legs: { thick: 2.6, front: 26, back: 10, paw: '#3a2c1c' },
        neck: [26, 11, 3.6], head: [29.6, 11.2, 3.8, 3.2],
        snout: [32.8, 12.2, 2.6, 1.8], nose: '#241a10',
        ear: { type: 'tiny', at: [27.8, 7.6], r: 1.6 },
        eye: [30.0, 10.2],
        tail: { type: 'taper', len: 7 },
        coat: {
          body: '#9a8264', dark: '#6a563f', light: '#b8a079', belly: '#7a664c',
          pattern: 'shell', shell: '#c4ad86'
        }
      }
    },

    coati: {
      label: 'Quati', order: 'Carnivora',
      game: {
        diet: 'omni', habitat: 'land', hp: 2, dmg: 0,
        walk: 34, flee: 88, fleeAt: 62, rest: 0.3, group: 3, curious: true,
        drops: [['raw_meat', 1]], sound: 'coati', meat: 'carne de quati',
        shadow: 'shadow_small', scale: 0.86
      },
      draw: {
        w: 40, h: 22,
        body: [19, 13, 10.4, 5.0], belly: [19, 16, 8.6, 2.6],
        legs: { thick: 2.6, front: 27, back: 11, paw: '#2f2418' },
        neck: [27, 11.6, 4.0], head: [31, 10.6, 4.0, 3.4],
        snout: [35.4, 12.0, 3.6, 2.0], nose: '#1d150e', longSnout: true,
        ear: { type: 'round', at: [29.2, 6.8], r: 2.0, tip: '#e8dcc0' },
        eye: [31.6, 9.4],
        tail: { type: 'ringed', len: 13, up: true },
        coat: {
          body: '#9c5f30', dark: '#6d4020', light: '#bd7d47', belly: '#7d4c26',
          pattern: 'none'
        }
      }
    },

    /* ============================ PREDADORES ========================== */

    jaguar: {
      label: 'Onça-pintada', order: 'Carnivora',
      game: {
        diet: 'carn', habitat: 'land', hp: 6, dmg: 17, predator: true,
        walk: 26, stalk: 62, chase: 104, fleeAt: 0,
        sight: 190, bite: 46, rest: 0.35, group: 1, nocturnal: true,
        fearFire: 175, drops: [['raw_meat', 3]], sound: 'jaguar', growl: 'jaguarGrowl',
        meat: 'carne de onça', shadow: 'shadow_big', scale: 1.1
      },
      draw: {
        w: 54, h: 30,
        body: [26, 16, 14.0, 7.6], belly: [26, 22.4, 10.6, 2.4],
        legs: { thick: 3.8, front: 38, back: 14, paw: '#4a3a1e' },
        neck: [37, 13, 5.8], head: [42.5, 12.4, 6.0, 5.2],
        snout: [47.6, 14.6, 3.6, 3.2], nose: '#2a1a10',
        ear: { type: 'round', at: [39.6, 7.0], r: 2.6, back: '#1c1409' },
        eye: [43.4, 10.6], eyeColor: '#d8c244',
        tail: { type: 'long', len: 15 },
        coat: {
          body: '#c99a4e', dark: '#96682c', light: '#e0b770', belly: '#e0cfae',
          pattern: 'rosettes', density: 18, rosette: '#2b1d0e'
        }
      }
    },

    caiman: {
      label: 'Jacaré-do-pantanal', order: 'Crocodilia',
      game: {
        diet: 'carn', habitat: 'water', hp: 5, dmg: 15, predator: true,
        walk: 14, stalk: 0, chase: 96, fleeAt: 0,
        sight: 120, bite: 34, rest: 0.8, group: 1, aquatic: true, ambush: true,
        fearFire: 0, drops: [['raw_meat', 3], ['fiber', 2]], sound: 'caiman',
        meat: 'carne de jacaré', shadow: 'shadow_0', scale: 1
      },
      draw: {
        w: 62, h: 22, reptile: true,
        body: [30, 13, 17.0, 5.2], belly: [30, 16.6, 15.0, 2.8],
        legs: { thick: 2.8, front: 42, back: 18, paw: '#2f3a22' },
        neck: [44, 12, 5.0], head: [49.5, 12.4, 6.4, 4.0],
        snout: [56.5, 13.2, 6.0, 2.6], nose: '#1d2414', jaws: true,
        ear: { type: 'none' },
        eye: [50.4, 9.4], eyeColor: '#e0c23c', ridge: true,
        tail: { type: 'reptile', len: 16 },
        coat: {
          body: '#4a5a34', dark: '#2f3a22', light: '#6a7a48', belly: '#a8a878',
          pattern: 'scales', scale: '#26301a'
        }
      }
    },

    /* ============================= AVES ============================== */

    toucan: {
      label: 'Tucano-toco', order: 'Piciformes',
      game: { diet: 'frugivore', habitat: 'air', group: 1, sound: 'toucan' },
      draw: { w: 28, h: 24, bird: 'toucan' }
    },

    macaw: {
      label: 'Arara-azul', order: 'Psittaciformes',
      game: { diet: 'frugivore', habitat: 'air', group: 2, sound: 'macaw' },
      draw: { w: 34, h: 20, bird: 'macaw' }
    }
  };

  SV.Fauna = F;

  /** Espécies que vivem no chão e podem ser caçadas. */
  SV.Fauna.huntable = function () {
    var out = [];
    for (var k in F) if (F[k].game.habitat !== 'air') out.push(k);
    return out;
  };

  /** Quantas unidades de cada espécie povoam o mapa. */
  SV.Fauna.population = {
    capy: 7, tapir: 3, deer: 5, peccary: 5, armadillo: 4, coati: 5,
    jaguar: 2, caiman: 4, toucan: 5, macaw: 3
  };

  SV.Fauna.get = function (kind) { return F[kind]; };
})(window.SV);
