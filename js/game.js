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
        phase: CONSTANTS.PHASES.BRIEFING,

        // Current room (1-3)
        currentRoom: 1,

        // Player characters
        characters: [],

        // Enemies in current room
        enemies: [],

        // Current turn state
        turn: {
          phase: CONSTANTS.PHASES.SELECTION,
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
            // Skip resting characters (long rest skips their turn)
            if (char.resting) {
              continue;
            }

            // Skip characters who can't play (need rest or exhausted)
            if (char.hand.length < CONSTANTS.GAME.CARDS_TO_PLAY) {
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
              this.setState({ phase: CONSTANTS.PHASES.DEFEAT });
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

        stunEnemy(enemyId) {
          const enemies = this.state.enemies.map(e => {
            if (e.id === enemyId) {
              return { ...e, stunned: true };
            }
            return e;
          });
          this.setState({ enemies });
        },

        clearEnemyStun(enemyId) {
          const enemies = this.state.enemies.map(e => {
            if (e.id === enemyId) {
              return { ...e, stunned: false };
            }
            return e;
          });
          this.setState({ enemies });
        },

        advanceRoom() {
          const nextRoom = this.state.currentRoom + 1;

          if (nextRoom > CONSTANTS.GAME.TOTAL_ROOMS) {
            this.setState({ phase: CONSTANTS.PHASES.VICTORY });
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
              phase: CONSTANTS.PHASES.SELECTION,
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

    if (!char || char.hand.length >= CONSTANTS.GAME.CARDS_TO_PLAY) return;

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
    UI.addLogMessage(`${char.shortName} takes a short rest, loses "${lostCard.name}", recovers ${recoveredCards.length} cards`, CONSTANTS.LOG_TYPES.HEAL);
    UI.showRestButtons(false);
  },

  /**
   * Perform a long rest for the selected character
   */
  performLongRest() {
    const state = this.store.state;
    const charId = state.ui.selectedCharacter;
    const char = state.characters.find(c => c.id === charId);

    if (!char || char.hand.length >= CONSTANTS.GAME.CARDS_TO_PLAY) return;

    // Recover all discarded cards and heal 2
    const recoveredCards = [...char.discard];

    const characters = state.characters.map(c => {
      if (c.id === charId) {
        const newHealth = Math.min(c.maxHealth, c.health + CONSTANTS.GAME.LONG_REST_HEAL);
        return {
          ...c,
          hand: [...c.hand, ...recoveredCards],
          discard: [],
          health: newHealth,
        };
      }
      return c;
    });

    // Mark character as resting - they skip this round
    const updatedCharacters = characters.map(c => {
      if (c.id === charId) {
        return { ...c, resting: true };
      }
      return c;
    });

    this.store.setState({ characters: updatedCharacters });
    UI.addLogMessage(`${char.shortName} takes a long rest, heals ${CONSTANTS.GAME.LONG_REST_HEAL}, recovers ${recoveredCards.length} cards (skips this round)`, CONSTANTS.LOG_TYPES.HEAL);
    UI.showRestButtons(false);
  },

  /**
   * Start a new mission
   */
  startMission() {
    console.log('Starting mission...');

    this.store.initializeCharacters();
    this.store.initializeEnemies(0);
    this.store.setPhase(CONSTANTS.PHASES.PLAYING);
    this.store.setSelectedCharacter(CONSTANTS.CHARACTER_IDS.JACK);

    UI.showScreen('game-screen');
    UI.updateRoomIndicator(1, GameData.rooms[0].name);
    UI.addLogMessage(`Mission started: ${GameData.rooms[0].name}`, CONSTANTS.LOG_TYPES.MOVE);
    UI.hideActionButtons();

    this.render(this.store.state);
  },

  /**
   * Restart the game
   */
  restartGame() {
    this.store.reset({
      phase: CONSTANTS.PHASES.BRIEFING,
      currentRoom: 1,
      characters: [],
      enemies: [],
      turn: {
        phase: CONSTANTS.PHASES.SELECTION,
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

    if (currentAction.type === CONSTANTS.ACTION_TYPES.MOVE) {
      // Check if hex is in reachable list
      const isReachable = currentAction.reachableHexes.some(
        rh => HexMath.equals(rh.hex, hex)
      );

      if (isReachable) {
        const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];
        Combat.executeMove(currentTurn.unit, hex, state, this.store);
        this.store.setHighlightedHexes([]);

        // Check for artifact pickup in room 3
        if (this.checkArtifactPickup(hex)) {
          return; // Victory triggered, don't continue turn
        }

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

    if (currentAction.type === CONSTANTS.ACTION_TYPES.ATTACK && type === CONSTANTS.UNIT_TYPES.ENEMY) {
      // Check if enemy is a valid target
      const isValidTarget = currentAction.targets.some(t => t.unit.id === unit.id);

      if (isValidTarget) {
        const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];

        if (currentAction.aoe) {
          // AOE attack - hit primary target and nearby enemies
          // "hit 2 adjacent" style uses maxAdditional of 2
          const maxAdditional = currentAction.aoeRadius === 1 ? 2 : null;
          Combat.executeAoeAttack(currentTurn.unit, unit, currentAction.damage, currentAction.aoeRadius, state, this.store, maxAdditional);
        } else {
          Combat.executeAttack(currentTurn.unit, unit, currentAction.damage, state, this.store, currentAction.stun);
        }

        // Apply push if attack has push property
        if (currentAction.push > 0) {
          const updatedState = this.store.state;
          const updatedTarget = updatedState.enemies.find(e => e.id === unit.id);
          if (updatedTarget && updatedTarget.health > 0) {
            Combat.executePush(currentTurn.unit, updatedTarget, currentAction.push, updatedState, this.store);
          }
        }

        this.store.setHighlightedHexes([]);
        this.completeCurrentAction();
      }
    } else if (currentAction.type === CONSTANTS.ACTION_TYPES.PUSH && type === CONSTANTS.UNIT_TYPES.ENEMY) {
      // Push action - select target to push
      const isValidTarget = currentAction.targets.some(t => t.unit.id === unit.id);

      if (isValidTarget) {
        const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];
        Combat.executePush(currentTurn.unit, unit, currentAction.pushDistance, state, this.store);
        this.store.setHighlightedHexes([]);
        this.completeCurrentAction();
      }
    } else if (currentAction.type === CONSTANTS.ACTION_TYPES.HEAL && type === CONSTANTS.UNIT_TYPES.CHARACTER) {
      const isValidTarget = currentAction.targets.some(t => t.unit.id === unit.id);

      if (isValidTarget) {
        const currentTurn = state.turn.turnOrder[state.turn.currentTurnIndex];
        Combat.executeHeal(currentTurn.unit, unit, currentAction.amount, state, this.store);
        this.store.setHighlightedHexes([]);
        this.completeCurrentAction();
      }
    } else if (currentAction.type === CONSTANTS.ACTION_TYPES.SHIELD && type === CONSTANTS.UNIT_TYPES.CHARACTER) {
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
      }, CONSTANTS.TIMING.ACTION_DELAY);
    } else {
      // Both actions done, advance turn
      this.store.setCurrentAction(null);
      setTimeout(() => {
        this.advanceTurn();
      }, CONSTANTS.TIMING.ACTION_DELAY);
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

    UI.addLogMessage('Cards confirmed! Calculating initiative...', CONSTANTS.LOG_TYPES.MOVE);

    const turnOrder = this.buildTurnOrder();

    this.store.setState({
      turn: {
        ...this.store.state.turn,
        phase: CONSTANTS.PHASES.EXECUTION,
        turnOrder: turnOrder,
        currentTurnIndex: 0,
        currentAction: null,
      },
    });

    setTimeout(() => {
      this.executeNextTurn();
    }, CONSTANTS.TIMING.ENEMY_TURN_DELAY);
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
          type: CONSTANTS.UNIT_TYPES.CHARACTER,
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
        type: CONSTANTS.UNIT_TYPES.ENEMY,
        initiative: enemy.type === CONSTANTS.ENEMY_IDS.JAFFA_SERPENT_GUARD ? 40 : 50,
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

    // Check for defeat (character died)
    if (state.phase === CONSTANTS.PHASES.DEFEAT) {
      return;
    }

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
    if (currentTurn.type === CONSTANTS.UNIT_TYPES.CHARACTER) {
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

    if (currentTurn.type === CONSTANTS.UNIT_TYPES.CHARACTER) {
      UI.addLogMessage(`--- ${currentTurn.unit.shortName}'s turn (Initiative: ${currentTurn.initiative}) ---`, CONSTANTS.LOG_TYPES.MOVE);
      this.executeCharacterAction(0);
    } else {
      UI.addLogMessage(`--- ${currentTurn.unit.name}'s turn ---`, CONSTANTS.LOG_TYPES.ATTACK);
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
        }, CONSTANTS.TIMING.ACTION_DELAY);
      } else {
        setTimeout(() => {
          this.advanceTurn();
        }, CONSTANTS.TIMING.ACTION_DELAY);
      }
    } else if (result.type === CONSTANTS.ACTION_TYPES.MOVE) {
      // Show movement options
      const hexes = result.reachableHexes.map(rh => ({
        hex: rh.hex,
        type: CONSTANTS.HIGHLIGHT_TYPES.REACHABLE,
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });

      if (hexes.length === 0) {
        UI.addLogMessage(`${unit.shortName} cannot move (blocked)`, CONSTANTS.LOG_TYPES.MOVE);
        if (actionIndex === 0) {
          setTimeout(() => this.executeCharacterAction(1), CONSTANTS.TIMING.ACTION_DELAY);
        } else {
          setTimeout(() => this.advanceTurn(), CONSTANTS.TIMING.ACTION_DELAY);
        }
      } else {
        UI.addLogMessage(`Select destination for ${unit.shortName} (Move ${action.value})`, CONSTANTS.LOG_TYPES.MOVE);
      }
    } else if (result.type === CONSTANTS.ACTION_TYPES.ATTACK) {
      // Show attack targets
      const hexes = result.targets.map(t => ({
        hex: t.hex,
        type: CONSTANTS.HIGHLIGHT_TYPES.ATTACKABLE,
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });

      if (hexes.length === 0) {
        UI.addLogMessage(`${unit.shortName} has no targets in range`, CONSTANTS.LOG_TYPES.ATTACK);
        if (actionIndex === 0) {
          setTimeout(() => this.executeCharacterAction(1), CONSTANTS.TIMING.ACTION_DELAY);
        } else {
          setTimeout(() => this.advanceTurn(), CONSTANTS.TIMING.ACTION_DELAY);
        }
      } else {
        const aoeText = result.aoe ? ', AOE' : '';
        UI.addLogMessage(`Select target for ${unit.shortName}'s attack (${action.value} damage, range ${result.range}${aoeText})`, CONSTANTS.LOG_TYPES.ATTACK);
      }
    } else if (result.type === CONSTANTS.ACTION_TYPES.HEAL) {
      const hexes = result.targets.map(t => ({
        hex: t.hex,
        type: CONSTANTS.HIGHLIGHT_TYPES.REACHABLE,
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });

      if (hexes.length === 0) {
        UI.addLogMessage(`${unit.shortName} has no heal targets`, CONSTANTS.LOG_TYPES.HEAL);
        if (actionIndex === 0) {
          setTimeout(() => this.executeCharacterAction(1), CONSTANTS.TIMING.ACTION_DELAY);
        } else {
          setTimeout(() => this.advanceTurn(), CONSTANTS.TIMING.ACTION_DELAY);
        }
      } else {
        UI.addLogMessage(`Select heal target for ${unit.shortName} (Heal ${result.amount})`, CONSTANTS.LOG_TYPES.HEAL);
      }
    } else if (result.type === CONSTANTS.ACTION_TYPES.SHIELD) {
      const hexes = result.targets.map(t => ({
        hex: t.hex,
        type: CONSTANTS.HIGHLIGHT_TYPES.REACHABLE,
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });
      UI.addLogMessage(`Select shield target for ${unit.shortName} (Shield ${result.amount})`, CONSTANTS.LOG_TYPES.HEAL);
    } else if (result.type === CONSTANTS.ACTION_TYPES.PUSH) {
      const hexes = result.targets.map(t => ({
        hex: t.hex,
        type: CONSTANTS.HIGHLIGHT_TYPES.ATTACKABLE,
      }));
      this.store.setHighlightedHexes(hexes);
      this.store.setCurrentAction({ ...result, actionIndex });

      if (hexes.length === 0) {
        UI.addLogMessage(`${unit.shortName} has no push targets in range`, CONSTANTS.LOG_TYPES.MOVE);
        if (actionIndex === 0) {
          setTimeout(() => this.executeCharacterAction(1), CONSTANTS.TIMING.ACTION_DELAY);
        } else {
          setTimeout(() => this.advanceTurn(), CONSTANTS.TIMING.ACTION_DELAY);
        }
      } else {
        UI.addLogMessage(`Select target to push ${result.pushDistance} hex(es)`, CONSTANTS.LOG_TYPES.MOVE);
      }
    }
  },

  /**
   * Execute an enemy's turn
   */
  executeEnemyTurn(turnEntry) {
    const state = this.store.state;

    // Check for defeat before executing
    if (state.phase === CONSTANTS.PHASES.DEFEAT) {
      return;
    }

    const enemy = state.enemies.find(e => e.id === turnEntry.unit.id);

    if (!enemy) {
      this.advanceTurn();
      return;
    }

    // Use enemy AI to decide action
    const action = EnemyAI.decideAction(enemy, state);

    if (action.type === CONSTANTS.ACTION_TYPES.ATTACK) {
      Combat.executeAttack(enemy, action.target, enemy.attack, state, this.store);
      setTimeout(() => {
        this.advanceTurn();
      }, CONSTANTS.TIMING.ENEMY_TURN_DELAY);
    } else if (action.type === CONSTANTS.ACTION_TYPES.MOVE) {
      Combat.executeMove(enemy, action.position, state, this.store);
      setTimeout(() => {
        this.advanceTurn();
      }, CONSTANTS.TIMING.ENEMY_TURN_DELAY);
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
        }, CONSTANTS.TIMING.ENEMY_TURN_DELAY);
      }, CONSTANTS.TIMING.ACTION_DELAY);
    } else {
      // Wait/skip - check if stunned
      if (enemy.stunned) {
        UI.addLogMessage(`${enemy.name} is stunned and cannot act!`, CONSTANTS.LOG_TYPES.ATTACK);
        this.store.clearEnemyStun(enemy.id);
      } else {
        UI.addLogMessage(`${enemy.name} waits`, '');
      }
      setTimeout(() => {
        this.advanceTurn();
      }, CONSTANTS.TIMING.ACTION_DELAY);
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
   * Check if character picked up the artifact (room 3 win condition)
   * @param {Object} hex - The hex position the character moved to
   * @returns {boolean} True if victory was triggered
   */
  checkArtifactPickup(hex) {
    const state = this.store.state;

    // Only check in room 3 when all enemies are defeated
    if (state.currentRoom !== CONSTANTS.GAME.TOTAL_ROOMS || state.enemies.length > 0) {
      return false;
    }

    const room = GameData.rooms[CONSTANTS.GAME.TOTAL_ROOMS - 1];
    const artifactPos = room.artifactPosition;

    if (artifactPos && HexMath.equals(hex, artifactPos)) {
      UI.addLogMessage('Artifact retrieved! Mission successful!', CONSTANTS.LOG_TYPES.HEAL);
      this.store.setPhase(CONSTANTS.PHASES.VICTORY);
      return true;
    }

    return false;
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

    // Clear resting status from characters
    const characters = this.store.state.characters.map(c => ({
      ...c,
      resting: false,
    }));
    this.store.setState({ characters });

    // Check win condition
    if (this.store.state.enemies.length === 0) {
      const currentRoom = this.store.state.currentRoom;
      if (currentRoom < CONSTANTS.GAME.TOTAL_ROOMS) {
        UI.addLogMessage(`Room ${currentRoom} cleared! Advancing...`, CONSTANTS.LOG_TYPES.HEAL);
        this.store.advanceRoom();
        this.store.clearCardSelections();
        UI.addLogMessage(`Entering: ${GameData.rooms[currentRoom].name}`, CONSTANTS.LOG_TYPES.MOVE);
      } else {
        // Room 3 cleared - check if anyone is already on artifact
        const room = GameData.rooms[CONSTANTS.GAME.TOTAL_ROOMS - 1];
        const artifactPos = room.artifactPosition;
        const onArtifact = this.store.state.characters.some(
          c => c.health > 0 && HexMath.equals(c.position, artifactPos)
        );

        if (onArtifact) {
          UI.addLogMessage('Artifact retrieved! Mission successful!', CONSTANTS.LOG_TYPES.HEAL);
          this.store.setPhase(CONSTANTS.PHASES.VICTORY);
        } else {
          UI.addLogMessage('Room cleared! Collect the artifact to complete the mission!', CONSTANTS.LOG_TYPES.HEAL);
          this.store.clearCardSelections();
        }
      }
    } else {
      // Check if any character can still play (has cards)
      const canContinue = this.store.state.characters.some(c => c.hand.length >= CONSTANTS.GAME.CARDS_TO_PLAY);
      if (!canContinue) {
        UI.addLogMessage('No cards remaining! Mission failed!', CONSTANTS.LOG_TYPES.ATTACK);
        this.store.setPhase(CONSTANTS.PHASES.DEFEAT);
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
    if (state.phase === CONSTANTS.PHASES.PLAYING) {
      const room = GameData.rooms[state.currentRoom - 1];

      // Update room indicator
      UI.updateRoomIndicator(state.currentRoom, room.name);

      UI.renderHexGrid(room, state.characters, state.enemies, state.ui.highlightedHexes);
      UI.renderCharacterPortraits(state.characters);

      if (state.turn.phase === CONSTANTS.PHASES.SELECTION) {
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
          if (selectedChar.hand.length < CONSTANTS.GAME.CARDS_TO_PLAY && selectedChar.discard.length > 0) {
            UI.showRestButtons(true);
            if (UI.elements.characterHand) {
              UI.elements.characterHand.innerHTML = `
                <p style="color: ${CONSTANTS.COLORS.REST_TEXT}; text-align: center; padding: 20px;">
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

        if (currentTurnEntry && currentTurnEntry.type === CONSTANTS.UNIT_TYPES.CHARACTER) {
          // Show the selected cards for current character
          UI.renderSelectedCardsDisplay(
            currentTurnEntry.unit,
            currentTurnEntry.cardA,
            currentTurnEntry.cardB,
            currentTurnEntry.useTopOfA,
            state.turn.currentAction?.actionIndex
          );
        } else if (currentTurnEntry && currentTurnEntry.type === CONSTANTS.UNIT_TYPES.ENEMY) {
          if (UI.elements.characterHand) {
            UI.elements.characterHand.innerHTML = `
              <div style="text-align: center; padding: 20px; color: ${CONSTANTS.COLORS.ENEMY_TURN_TEXT};">
                <div style="font-size: 1.2em; margin-bottom: 8px;">${currentTurnEntry.unit.name}'s Turn</div>
                <div style="color: ${CONSTANTS.COLORS.MUTED_TEXT};">Enemy acting...</div>
              </div>
            `;
          }
        } else {
          if (UI.elements.characterHand) {
            UI.elements.characterHand.innerHTML = `<p style="color: ${CONSTANTS.COLORS.MUTED_TEXT}; text-align: center;">Executing turn...</p>`;
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

      if (state.turn.phase === CONSTANTS.PHASES.EXECUTION) {
        UI.renderInitiativeTracker(state.turn.turnOrder, state.turn.currentTurnIndex);
      }

    } else if (state.phase === CONSTANTS.PHASES.VICTORY) {
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
    } else if (state.phase === CONSTANTS.PHASES.DEFEAT) {
      UI.showScreen('defeat-screen');
    }
  },
};
