/**
 * Game constants - single source of truth for magic values
 */

const CONSTANTS = Object.freeze({
  HEX: Object.freeze({
    SIZE: 40,
  }),

  GRID: Object.freeze({
    OFFSET: Object.freeze({ x: 100, y: 80 }),
  }),

  SVG: Object.freeze({
    NAMESPACE: 'http://www.w3.org/2000/svg',
  }),

  TIMING: Object.freeze({
    ACTION_DELAY: 300,
    ENEMY_TURN_DELAY: 500,
  }),

  ACTION_TYPES: Object.freeze({
    MOVE: 'move',
    ATTACK: 'attack',
    HEAL: 'heal',
    SHIELD: 'shield',
    BUFF: 'buff',
    SPECIAL: 'special',
    PUSH: 'push',
    TRAP: 'trap',
  }),

  PHASES: Object.freeze({
    BRIEFING: 'briefing',
    SELECTION: 'selection',
    EXECUTION: 'execution',
    PLAYING: 'playing',
    VICTORY: 'victory',
    DEFEAT: 'defeat',
  }),

  UNIT_TYPES: Object.freeze({
    CHARACTER: 'character',
    ENEMY: 'enemy',
  }),

  AI_TYPES: Object.freeze({
    MELEE: 'melee',
    RANGED: 'ranged',
  }),

  ENEMY_IDS: Object.freeze({
    JAFFA_WARRIOR: 'jaffa_warrior',
    JAFFA_SERPENT_GUARD: 'jaffa_serpent_guard',
  }),

  CHARACTER_IDS: Object.freeze({
    JACK: 'jack',
    SAM: 'sam',
    DANIEL: 'daniel',
    TEALC: 'tealc',
  }),

  HIGHLIGHT_TYPES: Object.freeze({
    REACHABLE: 'reachable',
    ATTACKABLE: 'attackable',
  }),

  LOG_TYPES: Object.freeze({
    MOVE: 'move',
    ATTACK: 'attack',
    HEAL: 'heal',
  }),

  GAME: Object.freeze({
    TOTAL_ROOMS: 3,
    CARDS_TO_PLAY: 2,
    LONG_REST_HEAL: 2,
  }),

  LIMITS: Object.freeze({
    MAX_HISTORY: 50,
    MAX_LOG_MESSAGES: 50,
  }),

  UI: Object.freeze({
    UNIT_TOKEN_RADIUS_FRACTION: 0.6,
    LOW_HEALTH_THRESHOLD: 30,
  }),

  COLORS: Object.freeze({
    ARTIFACT_FILL: '#d4af37',
    ARTIFACT_STROKE: '#fff',
    REST_TEXT: '#d69e2e',
    ENEMY_TURN_TEXT: '#f56565',
    MUTED_TEXT: '#9ca3af',
  }),
});
