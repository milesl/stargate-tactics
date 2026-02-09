/**
 * Game data: Enemy definitions
 */

GameData.enemies = {
  [CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR]: {
    name: 'Jaffa Warrior',
    maxHealth: 6,
    move: 2,
    attack: 3,
    range: 1,
    ai: CONSTANTS.AI_TYPES.MELEE,
  },

  [CONSTANTS.ENEMY_IDS.JAFFA_SERPENT_GUARD]: {
    name: 'Serpent Guard',
    maxHealth: 10,
    move: 3,
    attack: 4,
    range: 2,
    ai: CONSTANTS.AI_TYPES.RANGED,
  },
};
