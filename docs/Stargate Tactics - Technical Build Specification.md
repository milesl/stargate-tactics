# Stargate Tactics - Vanilla JS Technical Specification

## Overview
This document provides a step-by-step implementation guide for building Stargate Tactics MVP using pure HTML5, CSS3, and vanilla JavaScript with a lightweight reactive state management system.

---

## 1. Tech Stack

### Core Technologies
- **HTML5** - Structure and SVG for hex grid
- **CSS3** - Styling and animations
- **Vanilla JavaScript (ES6+)** - All game logic
- **No build tools** - Just files and a browser
- **No dependencies** - Zero npm packages

### Development Tools
- **Any modern browser** - Chrome/Firefox/Safari recommended
- **VS Code** or any text editor
- **Live Server** extension (optional) - For auto-refresh during development
- **Browser DevTools** - For debugging

---

## 2. Project Setup

### Initial Structure

```bash
# Create project directory
mkdir stargate-tactics
cd stargate-tactics

# Create folder structure
mkdir css js data
touch index.html
touch css/styles.css
touch js/store.js
touch js/hexMath.js
touch js/pathfinding.js
touch js/enemyAI.js
touch js/combat.js
touch js/ui.js
touch js/game.js
touch js/data.js
```

### Complete File Structure

```
stargate-tactics/
├── index.html              # Main HTML file
├── css/
│   └── styles.css          # All styles
├── js/
│   ├── store.js            # "Poor man's Pinia" - reactive state
│   ├── hexMath.js          # Hex coordinate math
│   ├── pathfinding.js      # A* pathfinding
│   ├── enemyAI.js          # Enemy decision logic
│   ├── combat.js           # Combat resolution
│   ├── ui.js               # DOM manipulation & rendering
│   ├── data.js             # Cards, characters, enemies, rooms
│   └── game.js             # Main game orchestration
└── README.md
```

---

## 3. Poor Man's Pinia (Reactive State System)

### File: `js/store.js`

```javascript
/**
 * Simple reactive state management
 * Provides Pinia-like functionality without the framework
 */

class Store {
  constructor(initialState) {
    this._state = initialState;
    this._listeners = [];
    this._history = [];
    this._maxHistory = 50;
  }

  /**
   * Get current state (read-only)
   */
  get state() {
    return this._state;
  }

  /**
   * Update state and notify listeners
   * Usage: store.setState({ enemies: newEnemies })
   */
  setState(updates) {
    // Save to history for undo functionality (future feature)
    this._history.push(JSON.parse(JSON.stringify(this._state)));
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Merge updates into state
    this._state = this._deepMerge(this._state, updates);

    // Notify all listeners
    this._notify();
  }

  /**
   * Subscribe to state changes
   * Usage: store.subscribe((state) => { console.log(state); })
   */
  subscribe(listener) {
    this._listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  _notify() {
    this._listeners.forEach(listener => {
      listener(this._state);
    });
  }

  /**
   * Deep merge objects (handles nested updates)
   */
  _deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }

  /**
   * Reset state to initial value
   */
  reset(newState) {
    this._state = newState;
    this._history = [];
    this._notify();
  }

  /**
   * Get previous state (for undo)
   */
  undo() {
    if (this._history.length === 0) return false;
    
    this._state = this._history.pop();
    this._notify();
    return true;
  }
}

/**
 * Create a store with actions (Pinia-like)
 */
function createStore(config) {
  const store = new Store(config.state());
  
  // Bind actions to store
  const actions = {};
  for (const [name, fn] of Object.entries(config.actions || {})) {
    actions[name] = (...args) => {
      return fn.call({
        state: store.state,
        setState: (updates) => store.setState(updates),
      }, ...args);
    };
  }

  // Bind getters to store
  const getters = {};
  for (const [name, fn] of Object.entries(config.getters || {})) {
    Object.defineProperty(getters, name, {
      get: () => fn(store.state),
    });
  }

  return {
    state: store.state,
    setState: (updates) => store.setState(updates),
    subscribe: (listener) => store.subscribe(listener),
    reset: (newState) => store.reset(newState),
    undo: () => store.undo(),
    ...actions,
    getters,
  };
}
```

### Usage Example:

```javascript
// Create a game store
const gameStore = createStore({
  state: () => ({
    currentRoom: 1,
    characters: [],
    enemies: [],
  }),

  getters: {
    activeCharacters(state) {
      return state.characters.filter(c => c.health > 0);
    },
    
    allEnemiesDefeated(state) {
      return state.enemies.length === 0;
    },
  },

  actions: {
    damageEnemy(enemyId, amount) {
      const enemies = [...this.state.enemies];
      const enemy = enemies.find(e => e.id === enemyId);
      
      if (enemy) {
        enemy.health -= amount;
        
        // Remove if dead
        if (enemy.health <= 0) {
          this.setState({
            enemies: enemies.filter(e => e.id !== enemyId)
          });
        } else {
          this.setState({ enemies });
        }
      }
    },

    advanceRoom() {
      this.setState({
        currentRoom: this.state.currentRoom + 1
      });
    },
  },
});

// Subscribe to changes
gameStore.subscribe((state) => {
  console.log('State changed:', state);
  UI.render(state);
});

// Use actions
gameStore.damageEnemy('jaffa_1', 5);
```

---

## 4. Core Game Files

### File: `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stargate Tactics</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div id="app">
    <!-- Mission Brief Screen -->
    <div id="mission-brief" class="screen hidden">
      <div class="brief-content">
        <h1>Mission Brief</h1>
        <p id="brief-text">SG-1, you're going to P3X-421. Intel suggests Jaffa presence. Secure the area and retrieve any Ancient artifacts.</p>
        <button id="start-mission" class="btn-primary">Begin Mission</button>
      </div>
    </div>

    <!-- Main Game Screen -->
    <div id="game-screen" class="screen hidden">
      <!-- Game Board (Hex Grid) -->
      <div id="game-board">
        <svg id="hex-grid" width="800" height="600"></svg>
      </div>

      <!-- UI Panel -->
      <div id="ui-panel">
        <!-- Character Portraits -->
        <div id="character-portraits"></div>

        <!-- Card Selection Area -->
        <div id="card-selection">
          <h3>Select Cards</h3>
          <div id="character-tabs"></div>
          <div id="character-hand"></div>
          <button id="confirm-cards" class="btn-primary" disabled>Confirm Selection</button>
        </div>

        <!-- Initiative Tracker -->
        <div id="initiative-tracker">
          <h3>Turn Order</h3>
          <div id="initiative-list"></div>
        </div>

        <!-- Combat Log -->
        <div id="combat-log">
          <h3>Combat Log</h3>
          <div id="log-messages"></div>
        </div>
      </div>
    </div>

    <!-- Victory Screen -->
    <div id="victory-screen" class="screen hidden">
      <div class="screen-content">
        <h1>Mission Successful</h1>
        <p>Gate address acquired: <span id="gate-address"></span></p>
        <p>SGC out.</p>
        <button id="restart-game" class="btn-primary">New Mission</button>
      </div>
    </div>

    <!-- Defeat Screen -->
    <div id="defeat-screen" class="screen hidden">
      <div class="screen-content">
        <h1>Mission Failed</h1>
        <p>SG-1, abort mission! Return to SGC immediately.</p>
        <button id="retry-mission" class="btn-primary">Retry Mission</button>
      </div>
    </div>
  </div>

  <!-- Scripts (order matters!) -->
  <script src="js/store.js"></script>
  <script src="js/hexMath.js"></script>
  <script src="js/data.js"></script>
  <script src="js/pathfinding.js"></script>
  <script src="js/enemyAI.js"></script>
  <script src="js/combat.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/game.js"></script>
  
  <script>
    // Initialize game when DOM is ready
    window.addEventListener('DOMContentLoaded', () => {
      Game.init();
    });
  </script>
</body>
</html>
```

### File: `css/styles.css`

```css
/* Reset and Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Courier New', monospace;
  background: #0a0e14;
  color: #e0e0e0;
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* Screen Management */
.screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0e14;
}

.screen.hidden {
  display: none;
}

.screen-content,
.brief-content {
  text-align: center;
  padding: 40px;
  background: #1a2332;
  border: 2px solid #2d3e50;
  border-radius: 8px;
  max-width: 600px;
}

.screen-content h1,
.brief-content h1 {
  color: #d4af37;
  margin-bottom: 20px;
  font-size: 2em;
}

.screen-content p,
.brief-content p {
  margin: 20px 0;
  line-height: 1.6;
}

/* Buttons */
.btn-primary {
  background: #d4af37;
  color: #0a0e14;
  border: none;
  padding: 12px 24px;
  font-size: 1em;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  border-radius: 4px;
  margin-top: 20px;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #f0c84b;
  transform: translateY(-2px);
}

.btn-primary:disabled {
  background: #4a5568;
  cursor: not-allowed;
  opacity: 0.5;
}

/* Game Screen Layout */
#game-screen {
  display: grid;
  grid-template-columns: 800px 1fr;
  gap: 20px;
  padding: 20px;
}

#game-board {
  background: #0a0e14;
  border: 2px solid #2d3e50;
  border-radius: 8px;
  overflow: hidden;
}

#hex-grid {
  display: block;
  background: #0a0e14;
}

/* UI Panel */
#ui-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

#ui-panel > div {
  background: #1a2332;
  border: 2px solid #2d3e50;
  border-radius: 8px;
  padding: 16px;
}

#ui-panel h3 {
  color: #d4af37;
  margin-bottom: 12px;
  font-size: 1.2em;
  border-bottom: 1px solid #2d3e50;
  padding-bottom: 8px;
}

/* Character Portraits */
#character-portraits {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.character-portrait {
  background: #2d3e50;
  padding: 12px;
  border-radius: 4px;
  text-align: center;
}

.character-portrait.active {
  border: 2px solid #d4af37;
}

.character-name {
  font-weight: bold;
  color: #d4af37;
  margin-bottom: 8px;
}

.character-health {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.health-bar-container {
  flex: 1;
  height: 8px;
  background: #0a0e14;
  border-radius: 4px;
  overflow: hidden;
}

.health-bar {
  height: 100%;
  background: #38a169;
  transition: width 0.3s;
}

.health-bar.low {
  background: #c53030;
}

.health-text {
  font-size: 0.9em;
  min-width: 50px;
}

/* Card Selection */
#character-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.character-tab {
  padding: 8px 16px;
  background: #2d3e50;
  border: none;
  color: #e0e0e0;
  cursor: pointer;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.character-tab.active {
  background: #d4af37;
  color: #0a0e14;
}

#character-hand {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  min-height: 300px;
}

/* Card Styles */
.card {
  background: #2d3e50;
  border: 2px solid #4a5568;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.card:hover:not(.disabled) {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card.selected {
  border-color: #d4af37;
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.5);
}

.card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #4a5568;
}

.card-name {
  font-weight: bold;
  color: #d4af37;
  font-size: 0.95em;
}

.card-initiative {
  background: #1a2332;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.card-action {
  margin: 8px 0;
  padding: 8px;
  background: #1a2332;
  border-radius: 4px;
}

.action-label {
  font-size: 0.7em;
  color: #9ca3af;
  margin-bottom: 4px;
}

.action-text {
  font-size: 0.9em;
  line-height: 1.4;
}

/* Initiative Tracker */
#initiative-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.initiative-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: #2d3e50;
  border-radius: 4px;
}

.initiative-item.active {
  border: 2px solid #d4af37;
  background: #3d4e60;
}

.initiative-number {
  font-weight: bold;
  color: #d4af37;
  min-width: 30px;
}

.initiative-name {
  flex: 1;
}

.initiative-type {
  font-size: 0.8em;
  color: #9ca3af;
}

/* Combat Log */
#log-messages {
  max-height: 200px;
  overflow-y: auto;
  font-size: 0.9em;
}

.log-message {
  padding: 4px 0;
  border-bottom: 1px solid #2d3e50;
}

.log-message:last-child {
  border-bottom: none;
}

.log-message.attack {
  color: #f56565;
}

.log-message.heal {
  color: #48bb78;
}

.log-message.move {
  color: #4299e1;
}

/* Hex Tile Styles (SVG) */
.hex-tile {
  cursor: pointer;
  transition: all 0.2s;
}

.hex-tile:hover .hex-polygon {
  filter: brightness(1.2);
}

.hex-polygon {
  stroke: #2d3e50;
  stroke-width: 1;
}

.hex-polygon.floor {
  fill: #1a2332;
}

.hex-polygon.wall {
  fill: #2d2d2d;
}

.hex-polygon.door {
  fill: #8b7355;
}

.hex-polygon.cover {
  fill: #4a4a4a;
}

.hex-polygon.highlighted {
  fill: #4a90e2;
  stroke: #ffffff;
  stroke-width: 3;
}

.hex-polygon.reachable {
  fill: #48bb78;
  opacity: 0.3;
}

.hex-polygon.attackable {
  fill: #f56565;
  opacity: 0.3;
}

/* Unit Tokens */
.unit-token {
  cursor: pointer;
}

.unit-circle {
  stroke: #ffffff;
  stroke-width: 2;
}

.unit-circle.character {
  fill: #4299e1;
}

.unit-circle.enemy {
  fill: #f56565;
}

.unit-circle.selected {
  stroke: #d4af37;
  stroke-width: 4;
}

.unit-label {
  fill: #ffffff;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  font-weight: bold;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}

.unit-health {
  fill: #ffffff;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  text-anchor: middle;
  pointer-events: none;
}

/* Responsive */
@media (max-width: 1400px) {
  #game-screen {
    grid-template-columns: 600px 1fr;
  }
  
  #hex-grid {
    width: 600px;
    height: 450px;
  }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1a2332;
}

::-webkit-scrollbar-thumb {
  background: #2d3e50;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4a5568;
}
```

---

## 5. Hex Math (Same as Vue Version)

### File: `js/hexMath.js`

```javascript
/**
 * Hex coordinate system and math utilities
 * Using axial coordinates (q, r)
 */

const HexMath = {
  /**
   * Calculate distance between two hexes
   */
  distance(a, b) {
    const ac = this.toCube(a);
    const bc = this.toCube(b);
    return (Math.abs(ac.q - bc.q) + Math.abs(ac.r - bc.r) + Math.abs(ac.s - bc.s)) / 2;
  },

  /**
   * Convert axial to cube coordinates
   */
  toCube(hex) {
    return {
      q: hex.q,
      r: hex.r,
      s: -hex.q - hex.r,
    };
  },

  /**
   * Get all neighboring hexes
   */
  neighbors(hex) {
    const directions = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    return directions.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
  },

  /**
   * Convert hex coordinates to pixel coordinates
   */
  toPixel(hex, size = 40) {
    const x = size * (3 / 2 * hex.q);
    const y = size * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
    return { x, y };
  },

  /**
   * Convert pixel coordinates to hex coordinates
   */
  fromPixel(point, size = 40) {
    const q = (2 / 3 * point.x) / size;
    const r = (-1 / 3 * point.x + Math.sqrt(3) / 3 * point.y) / size;
    return this.round(q, r);
  },

  /**
   * Round fractional hex coordinates to nearest hex
   */
  round(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  },

  /**
   * Get all hexes within range
   */
  hexesInRange(center, range) {
    const results = [];
    for (let q = -range; q <= range; q++) {
      for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
        results.push({ q: center.q + q, r: center.r + r });
      }
    }
    return results;
  },

  /**
   * Check if two hexes are equal
   */
  equals(a, b) {
    return a.q === b.q && a.r === b.r;
  },

  /**
   * Create hex key for maps/sets
   */
  key(hex) {
    return `${hex.q},${hex.r}`;
  },

  /**
   * Parse hex key back to coordinates
   */
  fromKey(key) {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  },

  /**
   * Get polygon points for SVG rendering
   */
  polygonPoints(hex, size = 40) {
    const { x, y } = this.toPixel(hex, size);
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  },
};
```

---

## 6. Data Definitions

### File: `js/data.js`

```javascript
/**
 * Game data: Characters, Cards, Enemies, Rooms
 */

const GameData = {
  // Character definitions
  characters: [
    {
      id: 'jack',
      name: "Jack O'Neill",
      shortName: 'Jack',
      maxHealth: 10,
      deck: 'jack',
    },
    {
      id: 'sam',
      name: 'Samantha Carter',
      shortName: 'Sam',
      maxHealth: 8,
      deck: 'sam',
    },
    {
      id: 'daniel',
      name: 'Daniel Jackson',
      shortName: 'Daniel',
      maxHealth: 7,
      deck: 'daniel',
    },
    {
      id: 'tealc',
      name: "Teal'c",
      shortName: "Teal'c",
      maxHealth: 12,
      deck: 'tealc',
    },
  ],

  // Card decks
  cards: {
    jack: [
      {
        id: 'jack_01',
        name: 'Suppressing Fire',
        initiative: 35,
        top: { type: 'attack', value: 3, range: 2, text: 'Attack 3, Range 2, Push 1' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'jack_02',
        name: 'Tactical Position',
        initiative: 45,
        top: { type: 'move', value: 4, text: 'Move 4' },
        bottom: { type: 'buff', value: 1, text: 'Ally +1 Attack' },
      },
      {
        id: 'jack_03',
        name: 'P90 Burst',
        initiative: 25,
        top: { type: 'attack', value: 4, range: 3, text: 'Attack 4, Range 3' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'jack_04',
        name: 'Fall Back',
        initiative: 18,
        top: { type: 'move', value: 3, text: 'Move 3' },
        bottom: { type: 'special', text: 'All allies Move 2' },
      },
      {
        id: 'jack_05',
        name: 'Grenade',
        initiative: 55,
        top: { type: 'attack', value: 2, range: 3, aoe: true, text: 'Attack 2, Range 3, AOE' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'jack_06',
        name: 'Cover Fire',
        initiative: 30,
        top: { type: 'attack', value: 3, range: 2, text: 'Attack 3, Range 2' },
        bottom: { type: 'move', value: 4, text: 'Move 4' },
      },
      {
        id: 'jack_07',
        name: 'Tactical Advance',
        initiative: 40,
        top: { type: 'move', value: 5, text: 'Move 5' },
        bottom: { type: 'attack', value: 2, range: 1, text: 'Attack 2' },
      },
      {
        id: 'jack_08',
        name: 'Headshot',
        initiative: 60,
        top: { type: 'attack', value: 5, range: 3, text: 'Attack 5, Range 3' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'jack_09',
        name: 'Regroup',
        initiative: 20,
        top: { type: 'move', value: 3, text: 'Move 3' },
        bottom: { type: 'heal', value: 2, text: 'Heal 2 (self)' },
      },
      {
        id: 'jack_10',
        name: 'Suppressive Fire',
        initiative: 50,
        top: { type: 'attack', value: 3, range: 3, text: 'Attack 3, Range 3' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
    ],

    sam: [
      {
        id: 'sam_01',
        name: 'Zat Gun',
        initiative: 28,
        top: { type: 'attack', value: 2, range: 2, stun: true, text: 'Attack 2, Range 2, Stun' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'sam_02',
        name: 'Tech Analysis',
        initiative: 15,
        top: { type: 'buff', text: 'Ally gains Advantage' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'sam_03',
        name: 'C4 Placement',
        initiative: 65,
        top: { type: 'trap', value: 4, text: 'Set trap: 4 damage' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'sam_04',
        name: 'Shield Modulation',
        initiative: 12,
        top: { type: 'shield', value: 2, text: 'Ally gains Shield 2' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'sam_05',
        name: 'Covering Fire',
        initiative: 38,
        top: { type: 'attack', value: 3, range: 4, text: 'Attack 3, Range 4' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'sam_06',
        name: 'Field Repair',
        initiative: 22,
        top: { type: 'heal', value: 3, range: 2, text: 'Heal 3, Range 2' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'sam_07',
        name: 'Precise Shot',
        initiative: 45,
        top: { type: 'attack', value: 4, range: 3, text: 'Attack 4, Range 3' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'sam_08',
        name: 'Naquadah Reactor',
        initiative: 18,
        top: { type: 'special', text: 'Draw 2 cards' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'sam_09',
        name: 'Tactical Retreat',
        initiative: 10,
        top: { type: 'move', value: 5, text: 'Move 5' },
        bottom: { type: 'shield', value: 1, text: 'Shield 1 (self)' },
      },
      {
        id: 'sam_10',
        name: 'Sustained Fire',
        initiative: 42,
        top: { type: 'attack', value: 3, range: 3, text: 'Attack 3, Range 3' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
    ],

    daniel: [
      {
        id: 'daniel_01',
        name: 'Field Medicine',
        initiative: 20,
        top: { type: 'heal', value: 3, range: 2, text: 'Heal 3, Range 2' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'daniel_02',
        name: 'Ancient Knowledge',
        initiative: 8,
        top: { type: 'special', text: 'Draw 2 cards' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'daniel_03',
        name: 'Distraction',
        initiative: 14,
        top: { type: 'push', value: 2, text: 'Push enemy 2' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'daniel_04',
        name: 'Defensive Shot',
        initiative: 32,
        top: { type: 'attack', value: 2, range: 2, text: 'Attack 2, Range 2' },
        bottom: { type: 'shield', value: 1, text: 'Shield 1 (self)' },
      },
      {
        id: 'daniel_05',
        name: 'Inspiring Words',
        initiative: 25,
        top: { type: 'heal', value: 1, aoe: true, text: 'All allies Heal 1' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'daniel_06',
        name: 'Peaceful Resolution',
        initiative: 5,
        top: { type: 'special', text: 'Enemy skips turn' },
        bottom: { type: 'move', value: 4, text: 'Move 4' },
      },
      {
        id: 'daniel_07',
        name: 'Careful Aim',
        initiative: 48,
        top: { type: 'attack', value: 3, range: 3, text: 'Attack 3, Range 3' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'daniel_08',
        name: 'Emergency Heal',
        initiative: 16,
        top: { type: 'heal', value: 4, text: 'Heal 4 (self or ally)' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'daniel_09',
        name: 'Evasive Action',
        initiative: 12,
        top: { type: 'move', value: 5, text: 'Move 5' },
        bottom: { type: 'shield', value: 2, text: 'Shield 2 (self)' },
      },
      {
        id: 'daniel_10',
        name: 'Supporting Fire',
        initiative: 35,
        top: { type: 'attack', value: 2, range: 3, text: 'Attack 2, Range 3' },
        bottom: { type: 'heal', value: 2, text: 'Heal 2 (ally)' },
      },
    ],

    tealc: [
      {
        id: 'tealc_01',
        name: 'Staff Blast',
        initiative: 42,
        top: { type: 'attack', value: 4, range: 2, text: 'Attack 4, Range 2' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'tealc_02',
        name: 'Indeed',
        initiative: 55,
        top: { type: 'attack', value: 5, range: 1, text: 'Attack 5, Melee' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'tealc_03',
        name: 'Jaffa Training',
        initiative: 28,
        top: { type: 'move', value: 3, text: 'Move 3' },
        bottom: { type: 'shield', value: 2, text: 'Shield 2 (self)' },
      },
      {
        id: 'tealc_04',
        name: "Kel'no'reem",
        initiative: 10,
        top: { type: 'heal', value: 2, text: 'Heal 2 (self)' },
        bottom: { type: 'special', text: 'Cannot be damaged' },
      },
      {
        id: 'tealc_05',
        name: 'Cleaving Strike',
        initiative: 48,
        top: { type: 'attack', value: 3, aoe: true, text: 'Attack 3, hit 2 adjacent' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'tealc_06',
        name: 'Warrior Stance',
        initiative: 15,
        top: { type: 'shield', value: 3, text: 'Shield 3 (self)' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'tealc_07',
        name: 'Charge',
        initiative: 38,
        top: { type: 'move', value: 4, text: 'Move 4' },
        bottom: { type: 'attack', value: 3, range: 1, text: 'Attack 3' },
      },
      {
        id: 'tealc_08',
        name: 'Power Strike',
        initiative: 62,
        top: { type: 'attack', value: 6, range: 1, text: 'Attack 6, Melee' },
        bottom: { type: 'move', value: 2, text: 'Move 2' },
      },
      {
        id: 'tealc_09',
        name: 'Defensive Position',
        initiative: 20,
        top: { type: 'shield', value: 2, text: 'Shield 2 (self)' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
      {
        id: 'tealc_10',
        name: 'Staff Sweep',
        initiative: 45,
        top: { type: 'attack', value: 3, range: 2, text: 'Attack 3, Range 2' },
        bottom: { type: 'move', value: 3, text: 'Move 3' },
      },
    ],
  },

  // Enemy definitions
  enemies: {
    jaffa_warrior: {
      name: 'Jaffa Warrior',
      maxHealth: 6,
      move: 2,
      attack: 3,
      range: 1,
      ai: 'melee',
    },
    
    jaffa_serpent_guard: {
      name: 'Serpent Guard',
      maxHealth: 10,
      move: 3,
      attack: 4,
      range: 2,
      ai: 'ranged',
    },
  },

  // Room definitions
  rooms: [
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
        { type: 'jaffa_warrior', position: { q: 5, r: 3 } },
        { type: 'jaffa_warrior', position: { q: 4, r: 4 } },
        { type: 'jaffa_warrior', position: { q: 6, r: 3 } },
        { type: 'jaffa_warrior', position: { q: 5, r: 5 } },
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
        { type: 'jaffa_warrior', position: { q: 5, r: 2 } },
        { type: 'jaffa_warrior', position: { q: 6, r: 3 } },
        { type: 'jaffa_warrior', position: { q: 5, r: 4 } },
        { type: 'jaffa_warrior', position: { q: 7, r: 2 } },
        { type: 'jaffa_serpent_guard', position: { q: 6, r: 4 } },
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
        { type: 'jaffa_warrior', position: { q: 6, r: 3 } },
        { type: 'jaffa_warrior', position: { q: 7, r: 4 } },
        { type: 'jaffa_warrior', position: { q: 6, r: 5 } },
        { type: 'jaffa_warrior', position: { q: 8, r: 4 } },
        { type: 'jaffa_serpent_guard', position: { q: 7, r: 6 } },
      ],
      artifactPosition: { q: 7, r: 5 },
      walls: [],
    },
  ],
};
```

---

## 7. Implementation Phases

### Phase 1: Foundation & Store (2-3 hours)
- [x] Create file structure
- [x] Implement `store.js` (reactive state)
- [x] Set up `index.html` and `styles.css`
- [ ] Test: State changes trigger updates

### Phase 2: Hex Grid Rendering (2-3 hours)
- [ ] Implement `hexMath.js`
- [ ] Create basic hex grid in `ui.js`
- [ ] Render room tiles
- [ ] Test: Can see hex grid on screen

### Phase 3: Game State & Cards (3-4 hours)
- [ ] Implement `game.js` with game store
- [ ] Complete `data.js` with all cards
- [ ] Card selection UI
- [ ] Test: Can select cards and see them

### Phase 4: Combat System (3-4 hours)
- [ ] Implement `combat.js`
- [ ] Movement logic
- [ ] Attack resolution
- [ ] Test: Can move and attack

### Phase 5: Enemy AI (2-3 hours)
- [ ] Implement `pathfinding.js`
- [ ] Implement `enemyAI.js`
- [ ] Enemy turn execution
- [ ] Test: Enemies act intelligently

### Phase 6: Game Flow (2-3 hours)
- [ ] Room progression
- [ ] Win/loss conditions
- [ ] Screen transitions
- [ ] Test: Complete mission start to finish

### Phase 7: Polish (2-4 hours)
- [ ] UI improvements
- [ ] Bug fixes
- [ ] Combat log
- [ ] Test: Playtest and balance

**Total Estimated Time: 16-24 hours**

---

## 8. Next Steps

Ready to start implementation! 

**Recommended approach:**
1. Create all files with skeleton code
2. Implement Phase 1 (store system) first
3. Then build Phase 2 (hex grid) to see something visual
4. Iterate through remaining phases

Would you like me to start generating the complete working code for each file?

