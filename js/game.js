/**
 * Main game orchestration
 * Manages game state, turn flow, and coordinates all systems
 */

const Game = {
  store: null,

  /**
   * Initialize the game
   */
  init() {
    console.log('Stargate Tactics initializing...');

    // Initialize UI
    UI.init();

    // Create game store
    this.store = createStore({
      state: () => ({
        // Game phase: 'menu', 'briefing', 'playing', 'victory', 'defeat'
        phase: 'briefing',

        // Current room (1-3)
        currentRoom: 1,

        // Player characters
        characters: [],

        // Enemies in current room
        enemies: [],

        // Current turn state
        turn: {
          phase: 'selection', // 'selection', 'execution', 'enemy'
          selectedCards: {}, // { characterId: { cardA, cardB, useTopOfA } }
          turnOrder: [],
          currentTurnIndex: 0,
          // Current action being executed
          currentAction: null, // { type, data, actionIndex }
        },

        // UI state
        ui: {
          selectedCharacter: null,
          highlightedHexes: [],
          selectedUnit: null,
        },
      }),

      getters: {
        activeCharacters(state) {
          return state.characters.filter(c => c.health > 0);
        },

        allEnemiesDefeated(state) {
          return state.enemies.length === 0;
        },

        currentTurnUnit(state) {
          return state.turn.turnOrder[state.turn.currentTurnIndex] || null;
        },

        allCardsSelected(state) {
          // Check each character
          for (const char of state.characters) {
            // Skip characters who can't play (need rest or exhausted)
            if (char.hand.length < 2) {
              // If they have discard, they need to rest first
              if (char.discard.length > 0) {
                return false; // Need to rest
              }
              // If no hand and no discard, they're exhausted - skip them
              continue;
            }

            // Character can play - check if they selected cards
            const selection = state.turn.selectedCards[char.id];
            if (!selection?.cardA || !selection?.cardB) {
              return false;
            }
          }
          return true;
        },
      },

      actions: {
        initializeCharacters() {
          const characters = GameData.characters.map((charDef, index) => ({
            ...charDef,
            health: charDef.maxHealth,
            position: { ...GameData.rooms[0].startPositions[index] },
            hand: [...GameData.cards[charDef.deck]],
            discard: [],
            shield: 0,
            effects: [],
          }));

          this.setState({ characters });
        },

        initializeEnemies(roomIndex) {
          const room = GameData.rooms[roomIndex];
          let enemyId = 0;

          const enemies = room.enemies.map(enemyDef => {
            const template = GameData.enemies[enemyDef.type];
            return {
              id: `enemy_${enemyId++}`,
              type: enemyDef.type,
              name: template.name,
              health: template.maxHealth,
              maxHealth: template.maxHealth,
              position: { ...enemyDef.position },
              move: template.move,
              attack: template.attack,
              range: template.range,
              ai: template.ai,
              stunned: false,
            };
          });

          this.setState({ enemies });
        },

        setPhase(phase) {
          this.setState({ phase });
        },

        setSelectedCharacter(characterId) {
          this.setState({
            ui: { ...this.state.ui, selectedCharacter: characterId },
          });
        },

        setHighlightedHexes(hexes) {
          this.setState({
            ui: { ...this.state.ui, highlightedHexes: hexes },
          });
        },

        setCurrentAction(action) {
          this.setState({
            turn: { ...this.state.turn, currentAction: action },
          });
        },

        selectCard(characterId, card) {
          const currentSelection = this.state.turn.selectedCards[characterId] || {
            cardA: null,
            cardB: null,
            useTopOfA: true,
          };

          let newSelection;

          if (currentSelection.cardA?.id === card.id) {
            newSelection = {
              ...currentSelection,
              cardA: currentSelection.cardB,
              cardB: null,
            };
          } else if (currentSelection.cardB?.id === card.id) {
            newSelection = {
              ...currentSelection,
              cardB: null,
            };
          } else if (!currentSelection.cardA) {
            newSelection = {
              ...currentSelection,
              cardA: card,
            };
          } else if (!currentSelection.cardB) {
            newSelection = {
              ...currentSelection,
              cardB: card,
            };
          } else {
            newSelection = {
              cardA: currentSelection.cardB,
              cardB: card,
              useTopOfA: true,
            };
          }

          this.setState({
            turn: {
              ...this.state.turn,
              selectedCards: {
                ...this.state.turn.selectedCards,
                [characterId]: newSelection,
              },
            },
          });
        },

        damageCharacter(characterId, amount) {
          const characters = [...this.state.characters];
          const char = characters.find(c => c.id === characterId);

          if (char) {
            const shieldAbsorb = Math.min(char.shield, amount);
            char.shield -= shieldAbsorb;
            const remainingDamage = amount - shieldAbsorb;

            char.health = Math.max(0, char.health - remainingDamage);
            this.setState({ characters });

            if (char.health <= 0) {
              this.setState({ phase: 'defeat' });
            }
          }
        },

        damageEnemy(enemyId, amount) {
          const enemies = [...this.state.enemies];
          const enemy = enemies.find(e => e.id === enemyId);

          if (enemy) {
            enemy.health -= amount;

            if (enemy.health <= 0) {
              this.setState({
                enemies: enemies.filter(e => e.id !== enemyId),
              });
            } else {
              this.setState({ enemies });
            }
          }
        },

        advanceRoom() {
          const nextRoom = this.state.currentRoom + 1;

          if (nextRoom > 3) {
            this.setState({ phase: 'victory' });
          } else {
            // Move characters to new starting positions
            const room = GameData.rooms[nextRoom - 1];
            const characters = this.state.characters.map((char, index) => ({
              ...char,
              position: { ...room.startPositions[index] },
            }));

            this.setState({
              currentRoom: nextRoom,
              characters,
            });
            this.initializeEnemies(nextRoom - 1);
          }
        },

        clearCardSelections() {
          this.setState({
            turn: {
              ...this.state.turn,
              selectedCards: {},
              phase: 'selection',
              currentAction: null,
            },
          });
        },

        discardUsedCards() {
          const characters = this.state.characters.map(char => {
            const selection = this.state.turn.selectedCards[char.id];
            if (!selection) return char;

            const usedCardIds = [selection.cardA?.id, selection.cardB?.id].filter(Boolean);
            const newHand = char.hand.filter(c => !usedCardIds.includes(c.id));
            const newDiscard = [...char.discard, ...char.hand.filter(c => usedCardIds.includes(c.id))];

            return {
              ...char,
              hand: newHand,
              discard: newDiscard,
            };
          });

          this.setState({ characters });
        },
      },
    });

    // Subscribe to state changes for rendering
    this.store.subscribe((state) => {
      this.render(state);
    });

    // Bind UI events
    this.bindEvents();

    // Set up hex click handler
    UI.onHexClick = (hex) => this.onHexClick(hex);
    UI.onUnitClick = (unit, type) => this.onUnitClick(unit, type);

    // Show briefing screen
    UI.showScreen('mission-brief');

    console.log('Stargate Tactics initialized!');
  },

  /**
   * Bind UI event handlers
   */
  bindEvents() {
    UI.elements.startMission?.addEventListener('click', () => {
      this.startMission();
    });

    UI.elements.restartGame?.addEventListener('click', () => {
      this.restartGame();
    });

    UI.elements.retryMission?.addEventListener('click', () => {
      this.restartGame();
    });

    UI.elements.confirmCards?.addEventListener('click', () => {
      this.confirmCardSelection();
    });

    // Skip action button
    UI.elements.skipAction?.addEventListener('click', () => {
      this.skipCurrentAction();
    });

    // Short rest button
    UI.elements.shortRest?.addEventListener('click', () => {
      this.performShortRest();
    });

    // Long rest button
    UI.elements.longRest?.addEventListener('click', () => {
      this.performLongRest();
    });
  },

  /**
   * Skip the current action
   */
  skipCurrentAction() {
    const state = this.store.state;
    const currentAction = state.turn.currentAction;

    if (!currentAction) return;

    UI.addLogMessage('Action skipped', '');
    this.store.setHighlightedHexes([]);
    UI.showSkipButton(false);
    this.completeCurrentAction();
  },

  /**
   * Perform a short rest for the selected character
   */
  performShortRest() {
    const state = this.store.state;
    const charId = state.ui.selectedCharacter;
    const char = state.characters.find(c => c.id === charId);

    if (!char || char.hand.length >= 2) return;

    // Recover all discarded cards except one random
    const discardCount = char.discard.length;
    if (discardCount === 0) {
      UI.addLogMessage(`${char.shortName} has no cards to recover!`, '');
      return;
    }

    // Pick a random card to lose
    const lostIndex = Math.floor(Math.random() * discardCount);
    const lostCard = char.discard[lostIndex];
    const recoveredCards = char.discard.filter((_, i) => i !== lostIndex);

    const characters = state.characters.map(c => {
      if (c.id === charId) {
        return {
          ...c,
          hand: [...c.hand, ...recoveredCards],
          discard: [],
        };
      }
      return c;
    });

    this.store.setState({ characters });
    UI.addLogMessage(`${char.shortName} takes a short rest, loses "${lostCard.name}", recovers ${recoveredCards.length} cards`, 'heal');
    UI.showRestButtons(false);
  },

  /**
   * Perform a long rest for the selected character
   */
  performLongRest() {
    const state = this.store.state;
    const charId = state.ui.selectedCharacter;
    const char = state.characters.find(c => c.id === charId);

    if (!char || char.hand.length >= 2) return;

    // Recover all discarded cards and heal 2
    const recoveredCards = [...char.discard];

    const characters = state.characters.map(c => {
      if (c.id === charId) {
        const newHealth = Math.min(c.maxHealth, c.health + 2);
        return {
          ...c,
          hand: [...c.hand, ...recoveredCards],
          discard: [],
          health: newHealth,
        };
      }
      return c;
    });

    this.store.setState({ characters });
    UI.addLogMessage(`${char.shortName} takes a long rest, heals 2, recovers ${recoveredCards.length} cards (skips this round)`, 'heal');
    UI.showRestButtons(false);

    // Mark character as resting (they skip this round's card selection)
    // For MVP simplicity, we just recover their cards and they can select normally
  },

  /**
   * Start a new mission
   */
  startMission() {
    console.log('Starting mission...');

    this.store.initializeCharacters();
    this.store.initializeEnemies(0);
    this.store.setPhase('playing');
    this.store.setSelectedCharacter('jack');

    UI.showScreen('game-screen');
    UI.updateRoomIndicator(1, GameData.rooms[0].name);
    UI.addLogMessage(`Mission started: ${GameData.rooms[0].name}`, 'move');
    UI.hideActionButtons();

    this.render(this.store.state);
  },

  /**
   * Restart the game
   */
  restartGame() {
    this.store.reset({
      phase: 'briefing',
      currentRoom: 1,
      characters: [],
      enemies: [],
      turn: {
        phase: 'selection',
        selectedCards: {},
        turnOrder: [],
        currentTurnIndex: 0,
        currentAction: null,
      },
      ui: {
        selectedCharacter: null,
        highlightedHexes: [],
        selectedUnit: null,
      },
    });

    UI.showScreen('mission-brief');
    UI.clearLog();
  },

  /**
   * Handle character tab click
   */
  onTabClick(characterId) {
    this.store.setSelectedCharacter(characterId);
  },

  /**
   * Handle card click
   */
  onCardClick(card, characterId) {
    this.store.selectCard(characterId, card);
  },

  /**
   * Handle hex click during gameplay
   */
  onHexClick(hex) {
    const state = this.store.state;
    const currentAction = state.turn.currentAction;

    if (!currentAction) return;

    if (currentAction.type === 'move') {
      // Check if hex is in reachable list
      const isReachable = currentAction.reachableHexes.some(
        rh => HexMath.equals(rh.hex, hex)
      );

      if (isReachable) {
        const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];
        Combat.executeMove(currentTurn.unit, hex, state, this.store);
        this.store.setHighlightedHexes([]);
        this.completeCurrentAction();
      }
    }
  },

  /**
   * Handle unit click during gameplay
   */
  onUnitClick(unit, type) {
    const state = this.store.state;
    const currentAction = state.turn.currentAction;

    if (!currentAction) return;

    if (currentAction.type === 'attack' && type === 'enemy') {
      // Check if enemy is a valid target
      const isValidTarget = currentAction.targets.some(t => t.unit.id === unit.id);

      if (isValidTarget) {
        const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];
        Combat.executeAttack(currentTurn.unit, unit, currentAction.damage, state, this.store);
        this.store.setHighlightedHexes([]);
        this.completeCurrentAction();
      }
    } else if (currentAction.type === 'heal' && type === 'character') {
      const isValidTarget = currentAction.targets.some(t => t.unit.id === unit.id);

      if (isValidTarget) {
        const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];
        Combat.executeHeal(currentTurn.unit, unit, currentAction.amount, state, this.store);
        this.store.setHighlightedHexes([]);
        this.completeCurrentAction();
      }
    } else if (currentAction.type === 'shield' && type === 'character') {
      const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];
      Combat.executeShield(currentTurn.unit, unit, currentAction.amount, state, this.store);
      this.store.setHighlightedHexes([]);
      this.completeCurrentAction();
    }
  },

  /**
   * Complete the current action and proceed
   */
  completeCurrentAction() {
    const state = this.store.state;
    const currentAction = state.turn.currentAction;

    if (currentAction.actionIndex === 0) {
      // First action done, execute second
      this.store.setCurrentAction(null);
      setTimeout(() => {
        this.executeCharacterAction(1);
      }, 300);
    } else {
      // Both actions done, advance turn
      this.store.setCurrentAction(null);
      setTimeout(() => {
        this.advanceTurn();
      }, 300);
    }
  },

  /**
   * Confirm card selection and start round execution
   */
  confirmCardSelection() {
    if (!this.store.getters.allCardsSelected) {
      UI.addLogMessage('Select 2 cards for each character first!', '');
      return;
    }

    UI.addLogMessage('Cards confirmed! Calculating initiative...', 'move');

    const turnOrder = this.buildTurnOrder();

    this.store.setState({
      turn: {
        ...this.store.state.turn,
        phase: 'execution',
        turnOrder: turnOrder,
        currentTurnIndex: 0,
        currentAction: null,
      },
    });

    setTimeout(() => {
      this.executeNextTurn();
    }, 500);
  },

  /**
   * Build turn order from selected cards and enemies
   */
  buildTurnOrder() {
    const order = [];

    for (const char of this.store.state.characters) {
      const selection = this.store.state.turn.selectedCards[char.id];
      if (selection?.cardA) {
        order.push({
          unit: char,
          type: 'character',
          initiative: selection.cardA.initiative,
          cardA: selection.cardA,
          cardB: selection.cardB,
          useTopOfA: selection.useTopOfA,
        });
      }
    }

    for (const enemy of this.store.state.enemies) {
      order.push({
        unit: enemy,
        type: 'enemy',
        initiative: enemy.type === 'jaffa_serpent_guard' ? 40 : 50,
      });
    }

    order.sort((a, b) => a.initiative - b.initiative);

    return order;
  },

  /**
   * Execute the next turn in the turn order
   */
  executeNextTurn() {
    const state = this.store.state;
    const { turnOrder, currentTurnIndex } = state.turn;

    // Check for victory mid-round
    if (state.enemies.length === 0) {
      this.endRound();
      return;
    }

    if (currentTurnIndex >= turnOrder.length) {
      this.endRound();
      return;
    }

    const currentTurn = turnOrder[currentTurnIndex];

    // Check if unit is still alive
    if (currentTurn.type === 'character') {
      const char = state.characters.find(c => c.id === currentTurn.unit.id);
      if (!char || char.health <= 0) {
        this.advanceTurn();
        return;
      }
    } else {
      const enemy = state.enemies.find(e => e.id === currentTurn.unit.id);
      if (!enemy) {
        this.advanceTurn();
        return;
      }
    }

    if (currentTurn.type === 'character') {
      UI.addLogMessage(`--- ${currentTurn.unit.shortName}'s turn (Initiative: ${currentTurn.initiative}) ---`, 'move');
      this.executeCharacterAction(0);
    } else {
      UI.addLogMessage(`--- ${currentTurn.unit.name}'s turn ---`, 'attack');
      this.executeEnemyTurn(currentTurn);
    }
  },

  /**
   * Execute a character's action (0 = first action, 1 = second action)
   */
  executeCharacterAction(actionIndex) {
    const state = this.store.state;
    const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];

    // Determine which action to use
    let action;
    if (actionIndex === 0) {
      // First action: top of cardA if useTopOfA, else bottom of cardA
      action = currentTurn.useTopOfA ? currentTurn.cardA.top : currentTurn.cardA.bottom;
    } else {
      // Second action: bottom of cardB if useTopOfA, else top of cardB
      action = currentTurn.useTopOfA ? currentTurn.cardB.bottom : currentTurn.cardB.top;
    }

    // Get fresh unit state
    const unit = state.characters.find(c => c.id === currentTurn.unit.id);
    if (!unit) {
      this.advanceTurn();
      return;
    }

    // Process the action
    const result = Combat.processAction(action, unit, state, this.store);

    if (result.type === 'complete') {
      // Action auto-completed
      if (actionIndex === 0) {
        setTimeout(() => {
          this.executeCharacterAction(1);
        }, 300);
      } else {
        setTimeout(() => {
          this.advanceTurn();
        }, 300);
      }
    } else if (result.type === 'move') {
      // Show movement options
      const hexes = result.reachableHexes.map(rh => ({
        hex: rh.hex,
        type: 'reachable',
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });

      if (hexes.length === 0) {
        UI.addLogMessage(`${unit.shortName} cannot move (blocked)`, 'move');
        if (actionIndex === 0) {
          setTimeout(() => this.executeCharacterAction(1), 300);
        } else {
          setTimeout(() => this.advanceTurn(), 300);
        }
      } else {
        UI.addLogMessage(`Select destination for ${unit.shortName} (Move ${action.value})`, 'move');
      }
    } else if (result.type === 'attack') {
      // Show attack targets
      const hexes = result.targets.map(t => ({
        hex: t.hex,
        type: 'attackable',
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });

      if (hexes.length === 0) {
        UI.addLogMessage(`${unit.shortName} has no targets in range`, 'attack');
        if (actionIndex === 0) {
          setTimeout(() => this.executeCharacterAction(1), 300);
        } else {
          setTimeout(() => this.advanceTurn(), 300);
        }
      } else {
        UI.addLogMessage(`Select target for ${unit.shortName}'s attack (${action.value} damage, range ${result.range})`, 'attack');
      }
    } else if (result.type === 'heal') {
      const hexes = result.targets.map(t => ({
        hex: t.hex,
        type: 'reachable',
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });

      if (hexes.length === 0) {
        UI.addLogMessage(`${unit.shortName} has no heal targets`, 'heal');
        if (actionIndex === 0) {
          setTimeout(() => this.executeCharacterAction(1), 300);
        } else {
          setTimeout(() => this.advanceTurn(), 300);
        }
      } else {
        UI.addLogMessage(`Select heal target for ${unit.shortName} (Heal ${result.amount})`, 'heal');
      }
    } else if (result.type === 'shield') {
      const hexes = result.targets.map(t => ({
        hex: t.hex,
        type: 'reachable',
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });
      UI.addLogMessage(`Select shield target for ${unit.shortName} (Shield ${result.amount})`, 'heal');
    }
  },

  /**
   * Execute an enemy's turn
   */
  executeEnemyTurn(turnEntry) {
    const state = this.store.state;
    const enemy = state.enemies.find(e => e.id === turnEntry.unit.id);

    if (!enemy) {
      this.advanceTurn();
      return;
    }

    // Use enemy AI to decide action
    const action = EnemyAI.decideAction(enemy, state);

    if (action.type === 'attack') {
      Combat.executeAttack(enemy, action.target, enemy.attack, state, this.store);
      setTimeout(() => {
        this.advanceTurn();
      }, 500);
    } else if (action.type === 'move') {
      Combat.executeMove(enemy, action.position, state, this.store);
      setTimeout(() => {
        this.advanceTurn();
      }, 500);
    } else if (action.type === 'moveAndAttack') {
      Combat.executeMove(enemy, action.position, state, this.store);
      setTimeout(() => {
        // Re-fetch state after move
        const newState = this.store.state;
        const movedEnemy = newState.enemies.find(e => e.id === enemy.id);
        if (movedEnemy && action.target) {
          Combat.executeAttack(movedEnemy, action.target, enemy.attack, newState, this.store);
        }
        setTimeout(() => {
          this.advanceTurn();
        }, 500);
      }, 300);
    } else {
      // Wait/skip
      UI.addLogMessage(`${enemy.name} waits`, '');
      setTimeout(() => {
        this.advanceTurn();
      }, 300);
    }
  },

  /**
   * Advance to next turn
   */
  advanceTurn() {
    const newIndex = this.store.state.turn.currentTurnIndex + 1;

    this.store.setState({
      turn: {
        ...this.store.state.turn,
        currentTurnIndex: newIndex,
        currentAction: null,
      },
    });
    this.store.setHighlightedHexes([]);

    this.executeNextTurn();
  },

  /**
   * End the current round
   */
  endRound() {
    UI.addLogMessage('=== Round Complete ===', '');

    // Discard used cards
    this.store.discardUsedCards();

    // Clear shields
    Combat.clearShields(this.store.state, this.store);

    // Check win condition
    if (this.store.state.enemies.length === 0) {
      const currentRoom = this.store.state.currentRoom;
      if (currentRoom < 3) {
        UI.addLogMessage(`Room ${currentRoom} cleared! Advancing...`, 'heal');
        this.store.advanceRoom();
        this.store.clearCardSelections();
        UI.addLogMessage(`Entering: ${GameData.rooms[currentRoom].name}`, 'move');
      } else {
        UI.addLogMessage('All rooms cleared! Mission successful!', 'heal');
        this.store.setPhase('victory');
      }
    } else {
      // Check if any character can still play (has cards)
      const canContinue = this.store.state.characters.some(c => c.hand.length >= 2);
      if (!canContinue) {
        UI.addLogMessage('No cards remaining! Mission failed!', 'attack');
        this.store.setPhase('defeat');
      } else {
        this.store.clearCardSelections();
        UI.addLogMessage('Select cards for next round.', '');
      }
    }
  },

  /**
   * Main render function
   */
  render(state) {
    if (state.phase === 'playing') {
      const room = GameData.rooms[state.currentRoom - 1];

      // Update room indicator
      UI.updateRoomIndicator(state.currentRoom, room.name);

      UI.renderHexGrid(room, state.characters, state.enemies, state.ui.highlightedHexes);
      UI.renderCharacterPortraits(state.characters);

      if (state.turn.phase === 'selection') {
        UI.renderCharacterTabs(
          state.characters,
          state.ui.selectedCharacter,
          state.turn.selectedCards,
          (charId) => this.onTabClick(charId)
        );

        const selectedChar = state.characters.find(c => c.id === state.ui.selectedCharacter);
        if (selectedChar) {
          const charSelection = state.turn.selectedCards[selectedChar.id] || {};

          // Check if character needs rest
          if (selectedChar.hand.length < 2 && selectedChar.discard.length > 0) {
            UI.showRestButtons(true);
            if (UI.elements.characterHand) {
              UI.elements.characterHand.innerHTML = `
                <p style="color: #d69e2e; text-align: center; padding: 20px;">
                  ${selectedChar.shortName} needs to rest!<br>
                  <small>Hand: ${selectedChar.hand.length} cards | Discard: ${selectedChar.discard.length} cards</small>
                </p>
              `;
            }
          } else {
            UI.showRestButtons(false);
            UI.renderCardHand(
              selectedChar,
              charSelection,
              (card, charId) => this.onCardClick(card, charId)
            );
          }
        }

        UI.setConfirmButtonEnabled(this.store.getters.allCardsSelected);
        UI.showSkipButton(false);
      } else {
        // During execution phase - show current turn's cards
        const currentTurnEntry = state.turn.turnOrder[state.turn.currentTurnIndex];

        if (currentTurnEntry && currentTurnEntry.type === 'character') {
          // Show the selected cards for current character
          UI.renderSelectedCardsDisplay(
            currentTurnEntry.unit,
            currentTurnEntry.cardA,
            currentTurnEntry.cardB,
            currentTurnEntry.useTopOfA,
            state.turn.currentAction?.actionIndex
          );
        } else if (currentTurnEntry && currentTurnEntry.type === 'enemy') {
          if (UI.elements.characterHand) {
            UI.elements.characterHand.innerHTML = `
              <div style="text-align: center; padding: 20px; color: #f56565;">
                <div style="font-size: 1.2em; margin-bottom: 8px;">${currentTurnEntry.unit.name}'s Turn</div>
                <div style="color: #9ca3af;">Enemy acting...</div>
              </div>
            `;
          }
        } else {
          if (UI.elements.characterHand) {
            UI.elements.characterHand.innerHTML = '<p style="color: #9ca3af; text-align: center;">Executing turn...</p>';
          }
        }

        if (UI.elements.characterTabs) {
          UI.elements.characterTabs.innerHTML = '';
        }
        UI.setConfirmButtonEnabled(false);
        UI.showRestButtons(false);

        // Show skip button if waiting for player input
        const hasCurrentAction = state.turn.currentAction !== null;
        UI.showSkipButton(hasCurrentAction);
      }

      if (state.turn.phase === 'execution') {
        UI.renderInitiativeTracker(state.turn.turnOrder, state.turn.currentTurnIndex);
      }

    } else if (state.phase === 'victory') {
      UI.showScreen('victory-screen');
      const symbols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let address = '';
      for (let i = 0; i < 7; i++) {
        address += symbols[Math.floor(Math.random() * symbols.length)];
        if (i < 6) address += '-';
      }
      if (UI.elements.gateAddress) {
        UI.elements.gateAddress.textContent = address;
      }
    } else if (state.phase === 'defeat') {
      UI.showScreen('defeat-screen');
    }
  },
};
