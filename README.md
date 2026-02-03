# Stargate Tactics

A single-player, turn-based tactical hex grid combat game set in the Stargate universe. Lead SG-1 through enemy-filled rooms using card-based actions to move, attack, and support your team.

## How to Play

**Local**: Open `index.html` in any modern browser - no server or build tools required.

**Online**: Play at [milesl.github.io/stargate-tactics](https://milesl.github.io/stargate-tactics/)

### Basic Gameplay

1. **Mission Brief**: Review objectives and start the mission
2. **Card Selection**: Each turn, select 2 cards from your hand for each character
3. **Initiative**: Cards resolve in initiative order (lowest first)
4. **Actions**: Use one top action + one bottom action from your selected cards
5. **Victory**: Clear all 3 rooms and collect the artifact
6. **Defeat**: Any team member reaches 0 HP

## Game Mechanics

### Characters

| Character | HP | Role |
|-----------|----|----|
| Jack O'Neill | 10 | Damage dealer |
| Samantha Carter | 8 | Support/Engineer |
| Daniel Jackson | 7 | Healer |
| Teal'c | 12 | Tank |

### Card System

Each character has 10 unique cards. Cards have:
- **Top action**: Usually attack, heal, or special ability
- **Bottom action**: Usually movement
- **Initiative value**: Determines action order (1-99, lower goes first)

### Combat

- Hex-based movement and positioning
- Melee and ranged attacks (up to 4 hexes)
- Shield, stun, and AOE effects
- Two enemy types: Jaffa Warriors (melee) and Serpent Guards (ranged)

## Codebase Overview

Pure vanilla JavaScript (ES6+) with no dependencies or build tools.

```
stargate-tactics/
├── index.html          # Entry point
├── css/
│   └── styles.css      # Dark military theme styling
├── js/
│   ├── store.js        # Reactive state management
│   ├── hexMath.js      # Hex coordinate calculations
│   ├── pathfinding.js  # A* movement algorithm
│   ├── enemyAI.js      # Enemy behavior trees
│   ├── combat.js       # Combat resolution
│   ├── ui.js           # SVG rendering and DOM updates
│   ├── data.js         # Characters, cards, enemies, rooms
│   └── game.js         # Main game orchestration
└── docs/               # Design specifications
```

### Key Components

- **State Management** (`store.js`): Custom reactive system inspired by Pinia with subscriptions and history
- **Hex Grid** (`hexMath.js`): Axial coordinate system with distance calculations and pixel conversion
- **AI System** (`enemyAI.js`): Tactical behavior trees - melee units close distance, ranged units maintain it
- **Pathfinding** (`pathfinding.js`): A* algorithm for valid movement paths

## Deployment

Automatic deployment to GitHub Pages via GitHub Actions on push to `main` branch.

The workflow (`.github/workflows/static.yml`) uploads the repository contents and deploys to Pages - no build step required.

