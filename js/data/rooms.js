/**
 * Game data: Room definitions
 */

GameData.rooms = [
  {
    id: 1,
    name: 'Stargate Arrival',
    width: 7,
    height: 7,
    startPositions: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    enemies: [
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 5, r: 3 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 4, r: 4 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 6, r: 3 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 5, r: 5 } },
    ],
    walls: [
      // Define wall hexes (perimeter)
    ],
  },
  {
    id: 2,
    name: 'Temple Corridor',
    width: 8,
    height: 6,
    startPositions: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    enemies: [
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 5, r: 2 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 6, r: 3 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 5, r: 4 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 7, r: 2 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_SERPENT_GUARD, position: { q: 6, r: 4 } },
    ],
    walls: [],
  },
  {
    id: 3,
    name: 'Artifact Chamber',
    width: 9,
    height: 8,
    startPositions: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    enemies: [
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 6, r: 3 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 7, r: 4 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 6, r: 5 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_WARRIOR, position: { q: 8, r: 4 } },
      { type: CONSTANTS.ENEMY_IDS.JAFFA_SERPENT_GUARD, position: { q: 7, r: 6 } },
    ],
    artifactPosition: { q: 7, r: 5 },
    walls: [],
  },
];
