# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stargate Tactics is a single-player, turn-based tactical hex grid combat game. Built with pure vanilla JavaScript (ES6+), HTML5, and CSS3 - no frameworks, no dependencies, no build tools.

## Development

**Local Development**: Open `index.html` directly in a browser - no server required.

**Deployment**: Automatic via GitHub Actions to GitHub Pages on push to main branch.

## Architecture

### Script Loading Order (Critical)
Scripts must load in this order due to dependencies (see `index.html`):
1. constants.js → store.js → hexMath.js
2. data/characters.js → data/cards.js → data/enemies.js → data/rooms.js
3. pathfinding.js → enemyAI.js → combat.js
4. ui/core.js → ui/grid.js → ui/cards.js
5. game/core.js → game/turns.js → game/actions.js

Split files use the global object pattern: the base file defines the object (e.g., `const Game = {}`), then subsequent files use `Object.assign(Game, {...})` to add methods.

### Core Systems

| File | Purpose |
|------|---------|
| `js/store.js` | "Poor Man's Pinia" - reactive state management with deep merge, history, subscriptions |
| `js/game/core.js` | Game object, init, store config, rendering, start/restart |
| `js/game/turns.js` | Turn order building, character/enemy action execution |
| `js/game/actions.js` | Click handlers, rest actions, artifact pickup, round end |
| `js/combat.js` | Movement, attacks, damage resolution, range checks |
| `js/enemyAI.js` | Behavior trees for melee (Jaffa) and ranged (Serpent Guard) enemies |
| `js/pathfinding.js` | A* algorithm for unit movement |
| `js/hexMath.js` | Axial coordinate math, distance calculations, pixel conversion |
| `js/ui/core.js` | UI object, init, DOM refs, screen management, log, button helpers |
| `js/ui/grid.js` | SVG hex grid rendering, unit tokens, artifact rendering |
| `js/ui/cards.js` | Card hand, portraits, tabs, initiative tracker, tooltips |
| `js/data/characters.js` | Character definitions (4) |
| `js/data/cards.js` | Card decks (10 per character) |
| `js/data/enemies.js` | Enemy definitions (2 types) |
| `js/data/rooms.js` | Room definitions (3 rooms) |

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
