
## 1. Core Concept
Single-player, turn-based tactical combat game where you control SG-1 team through one mission: gate to an alien planet, clear three rooms of Jaffa enemies, and retrieve a gate address artifact.

---

## 2. Characters (Player Units)

### Jack O'Neill (Tactical Leader)
- **Role**: Damage dealer with tactical support
- **Health**: 10
- **Starting Hand Size**: 10 cards
- **Card Examples**:
  - "Suppressing Fire" - Attack 3, Push 1
  - "Tactical Positioning" - Move 4, Grant ally +1 attack this turn
  - "P90 Burst" - Attack 4, range 3
  - "Fall Back!" - Move 3, All allies move 2
  - "Grenade" - Attack 2, range 3, hit all enemies in radius 1

### Samantha Carter (Engineer/Scientist)
- **Role**: Support/utility with ranged damage
- **Health**: 8
- **Starting Hand Size**: 10 cards
- **Card Examples**:
  - "Technical Analysis" - Grant ally advantage on next attack
  - "Zat Gun" - Attack 2, range 2, Stun
  - "C4 Placement" - Set trap: 4 damage when enemy enters
  - "Shield Modulation" - Grant ally +2 shield this round
  - "Covering Fire" - Attack 3, range 4

### Daniel Jackson (Archaeologist/Linguist)
- **Role**: Healer/support
- **Health**: 7
- **Starting Hand Size**: 10 cards
- **Card Examples**:
  - "Field Medicine" - Heal 3, range 2
  - "Ancient Knowledge" - Draw 2 cards
  - "Distraction" - Enemy moves 2 away from you
  - "Defensive Shot" - Attack 2, range 2, gain shield 1
  - "Inspiring Words" - All allies heal 1

### Tealc (Heavy Warrior)
- **Role**: Tank/melee damage
- **Health**: 12
- **Starting Hand Size**: 10 cards
- **Card Examples**:
  - "Staff Weapon Blast" - Attack 4, range 2
  - "Indeed" - Attack 5, melee
  - "Jaffa Training" - Move 3, +2 shield
  - "Kel'no'reem" - Heal 2, cannot be damaged this turn
  - "Cleaving Strike" - Attack 3, hit 2 adjacent enemies

---

## 3. Enemies

### Jaffa Warrior
- **Health**: 6
- **Move**: 2
- **Attack**: 3 (melee, range 1)
- **AI Behavior**: 
  1. If adjacent to player: Attack
  2. Else: Move toward nearest player
- **Quantity**: 4-5 per room

### Jaffa Serpent Guard (Elite)
- **Health**: 10
- **Move**: 3
- **Attack**: 4 (range 2)
- **AI Behavior**:
  1. If within range 2: Attack
  2. If adjacent: Move away 1, then attack
  3. Else: Move toward nearest player
- **Quantity**: 1 per room (rooms 2 & 3)

---

## 4. Map Layout

### Room 1 (Stargate Arrival)
- 7x7 hex grid
- Stargate on one side (players start here)
- 4 Jaffa Warriors
- One exit door (locked until enemies cleared)

### Room 2 (Temple Corridor)
- 8x6 hex grid
- Entrance from Room 1
- 5 Jaffa Warriors, 1 Serpent Guard
- Some cover hexes (pillars, rubble)
- Exit door to Room 3

### Room 3 (Artifact Chamber)
- 9x8 hex grid
- 4 Jaffa Warriors, 1 Serpent Guard
- Central pedestal with artifact (chest/tablet)
- More complex terrain with cover

---

## 5. Core Mechanics

### Turn Structure
1. **Player Selection Phase**: Choose 2 cards for each character (top action from one, bottom action from other)
2. **Initiative**: Characters and enemies act in initiative order (cards have initiative values 01-99)
3. **Action Resolution**: Execute moves/attacks in initiative order
4. **End of Round**: Discard used cards, check for short rest option

### Card System (Simplified Gloomhaven)
- Each character has a deck of 10 cards
- Each card has:
  - **Top Action**: Primary ability (attack/move/special)
  - **Bottom Action**: Secondary ability (usually move or utility)
  - **Initiative Number**: Determines turn order
- Players select 2 cards per round, use top of one and bottom of other
- Used cards go to discard pile
- When hand is empty: **Short Rest** (recover all but one random card) or **Long Rest** (recover all, heal 2, skip turn)

### Combat Mechanics
- **Attack**: Roll d20 + attack value vs. target defense (base 10)
  - Simplified: Or just use flat damage values (no dice) for MVP
- **Damage**: Reduce target health
- **Move**: Move up to X hexes
- **Range**: Melee (adjacent), or ranged (X hexes away, line of sight)
- **Shield**: Temporary damage reduction for one round
- **Stun**: Enemy loses next turn
- **Heal**: Restore health (max = starting health)

### Win/Lose Conditions
- **Win**: All enemies defeated in Room 3, artifact collected
- **Lose**: Any character reaches 0 health (mission failed)

---

## 6. UI/UX Requirements

### Main Game Screen
- **Hex Grid**: Central play area showing current room
- **Character Portraits**: Shows health, active effects, position indicator
- **Enemy Status**: Health bars, position indicators
- **Hand Display**: Shows player's current hand of cards
- **Selected Cards**: Highlights the 2 cards chosen for this round
- **Initiative Track**: Shows turn order for current round
- **Action Log**: Recent actions/events
- **End Turn Button**: Confirms card selection

### Card Selection Interface
- Click card to select (first selection = Card A, second = Card B)
- Highlight which action (top/bottom) will be used from each
- Show initiative number for the selected pair
- Confirm/Cancel buttons

### Game Flow Screens
- **Mission Brief**: "SG-1, you're going to P3X-421. Intel suggests Jaffa presence. Secure the area and retrieve any Ancient artifacts."
- **Victory Screen**: "Mission successful. Gate address acquired: [procedural address]. SGC out."
- **Defeat Screen**: "SG-1, abort mission! Return to SGC immediately."

---

## 7. Technical Implementation Suggestions

### Tech Stack
- **Frontend**: Vue.js (since you're familiar)
- **Hex Grid**: SVG or Canvas for rendering
- **State Management**: Vuex or Pinia
- **Styling**: Tailwind CSS or basic CSS

### Key Components
- `GameBoard.vue` - Hex grid and unit rendering
- `CharacterHand.vue` - Card selection interface
- `InitiativeTracker.vue` - Turn order display
- `UnitCard.vue` - Character/enemy status display
- `CombatLog.vue` - Action history

### State Structure
```javascript
{
  mission: {
    currentRoom: 1,
    roomsCleared: [false, false, false]
  },
  characters: [
    {
      id: 'jack',
      name: 'Jack O\'Neill',
      health: 10,
      maxHealth: 10,
      position: {q: 0, r: 0}, // hex coordinates
      hand: [...cards],
      discard: [...cards],
      exhausted: false
    },
    // ... other characters
  ],
  enemies: [
    {
      id: 'jaffa_1',
      type: 'warrior',
      health: 6,
      position: {q: 5, r: 3}
    },
    // ... other enemies
  ],
  turnOrder: [], // calculated each round
  selectedCards: {
    cardA: null,
    cardB: null,
    useTopOfA: true
  }
}
```

---

## 8. MVP Scope Limitations

### Included
- 4 playable characters with 10 cards each
- 2 enemy types with basic AI
- 3 connected rooms (linear progression)
- Card-based action system
- Turn-based hex grid combat
- Win/lose conditions

### Excluded (for future iterations)
- Leveling/progression
- Equipment/items
- Multiple missions/campaign
- Persistent character state
- Multiplayer
- Advanced abilities (summons, complicated status effects)
- Save/load functionality
- Sound effects/music
- Animations (keep it simple - instant actions)
- Enemy ability cards (enemies use fixed actions)

---

## 9. Success Metrics

For the MVP to "prove mechanics," it should:
- Demonstrate tactical decision-making (card selection matters)
- Show character differentiation (roles feel distinct)
- Create tension (health/resources are meaningful)
- Feel like both Gloomhaven (card play) and Stargate (theme/setting)
- Be completable in 15-30 minutes

---

## 10. Art/Asset Requirements (Lo-fi)

- Character tokens: Simple colored hexagons with initials or icons
- Enemy tokens: Different colored hexagons (red for Jaffa, gold for Serpent Guards)
- Hex tiles: Basic colors (floor, wall, cover, door)
- Cards: Simple rectangular cards with text and numbers (minimal graphics)
- UI: Clean, functional, space/military theme (dark blues, grays)

---

## Next Steps

1. Set up Vue.js project structure
2. Implement hex grid rendering system
3. Create game state management (Pinia/Vuex)
4. Build card data structures and character decks
5. Implement card selection UI
6. Create combat resolution system
7. Build enemy AI
8. Add win/lose conditions
9. Polish UI and playtest
