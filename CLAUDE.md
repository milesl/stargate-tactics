# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stargate Tactics is a single-player, turn-based tactical hex grid combat game. Built with pure vanilla JavaScript (ES6+), HTML5, and CSS3 - no frameworks, no dependencies, no build tools.

## Development

**Local Development**: Open `index.html` directly in a browser - no server required.

**Deployment**: Automatic via GitHub Actions to GitHub Pages on push to main branch.

## Architecture

### Script Loading Order (Critical)
Scripts must load in this order due to dependencies:
1. store.js → hexMath.js → data.js → pathfinding.js → enemyAI.js → combat.js → ui.js → game.js

### Core Systems

| File | Purpose |
|------|---------|
| `js/store.js` | "Poor Man's Pinia" - reactive state management with deep merge, history, subscriptions |
| `js/game.js` | Main orchestration - turn phases, card selection, game flow |
| `js/combat.js` | Movement, attacks, damage resolution, range checks |
| `js/enemyAI.js` | Behavior trees for melee (Jaffa) and ranged (Serpent Guard) enemies |
| `js/pathfinding.js` | A* algorithm for unit movement |
| `js/hexMath.js` | Axial coordinate math, distance calculations, pixel conversion |
| `js/ui.js` | SVG hex grid rendering, character portraits, card UI, combat log |
| `js/data.js` | Character definitions (4), cards (10 per character), enemies (2 types), rooms (3) |

### State Flow
- State accessed via `Game.store.state`
- State changes trigger subscribers via `Game.store.subscribe()`
- UI updates via `UI.render(state)` on state changes

### Game Flow
Mission Brief → Card Selection (2 cards per turn) → Initiative Resolution → Action Execution → Next Turn

Each card has top/bottom actions; player uses one top + one bottom from their two selected cards.

### Entry Points
- **Game initialization**: `Game.init()` on DOMContentLoaded
- **Combat resolution**: `Combat.resolveAction()` and `Combat.executeAction()`
- **Enemy decisions**: `EnemyAI.decideAction()` with melee/ranged tactics
- **Hex math**: `HexMath.distance()`, `HexMath.hexToPixel()`, `HexMath.getHexesInRange()`

## Design Specifications

Detailed game design and technical specs are in `docs/`:
- `Stargate Tactics - MVP Specification.md` - Game mechanics, characters, cards
- `Stargate Tactics - Technical Build Specification.md` - Implementation details
