/**
 * Main game orchestration - Core
 * Manages game state, initialization, and rendering
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
          selectedCards: {}, // { characterId: { cardA, cardB } }
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
          };

          let newSelection;

          if (currentSelection.cardA?.id === card.id) {
            newSelection = {
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

    // Set up event bus listeners
    this.setupEventListeners();

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
   * Set up EventBus listeners to route events to UI
   */
  setupEventListeners() {
    EventBus.on('unit:moved', (data) => {
      UI.addLogMessage(`${data.name} moved to (${data.position.q}, ${data.position.r})`, CONSTANTS.LOG_TYPES.MOVE);
    });

    EventBus.on('unit:damaged', (data) => {
      UI.addLogMessage(
        `${data.attackerName} attacks ${data.targetName} for ${data.damage} damage! (${data.newHealth}/${data.maxHealth})`,
        CONSTANTS.LOG_TYPES.ATTACK
      );
      if (data.position) {
        UI.showFloatingNumber(data.position, `-${data.damage}`, 'damage');
      }
    });

    EventBus.on('unit:defeated', (data) => {
      if (data.isCharacter) {
        UI.addLogMessage(`${data.name} has fallen! Mission failed!`, CONSTANTS.LOG_TYPES.ATTACK);
      } else {
        UI.addLogMessage(`${data.name} defeated!`, CONSTANTS.LOG_TYPES.ATTACK);
      }
    });

    EventBus.on('unit:stunned', (data) => {
      UI.addLogMessage(`${data.name} is stunned!`, CONSTANTS.LOG_TYPES.ATTACK);
    });

    EventBus.on('attack:aoe', (data) => {
      UI.addLogMessage(`AOE hits ${data.additionalCount} additional target(s)!`, CONSTANTS.LOG_TYPES.ATTACK);
    });

    EventBus.on('unit:healed', (data) => {
      UI.addLogMessage(
        `${data.healerName} heals ${data.targetName} for ${data.amount}! (${data.newHealth}/${data.maxHealth})`,
        CONSTANTS.LOG_TYPES.HEAL
      );
      if (data.position && data.amount > 0) {
        UI.showFloatingNumber(data.position, `+${data.amount}`, 'heal');
      }
    });

    EventBus.on('unit:pushed', (data) => {
      if (data.blocked) {
        UI.addLogMessage(`${data.name} couldn't be pushed (blocked)`, CONSTANTS.LOG_TYPES.MOVE);
      } else {
        UI.addLogMessage(`${data.name} pushed ${data.distance} hex(es)!`, CONSTANTS.LOG_TYPES.MOVE);
      }
    });

    EventBus.on('unit:shielded', (data) => {
      UI.addLogMessage(`${data.casterName} grants ${data.targetName} Shield ${data.amount}!`, CONSTANTS.LOG_TYPES.HEAL);
      if (data.position) {
        UI.showFloatingNumber(data.position, `+${data.amount}`, 'shield');
      }
    });

    EventBus.on('action:special', (data) => {
      UI.addLogMessage(`${data.name} uses ${data.text}`, CONSTANTS.LOG_TYPES.MOVE);
    });

    EventBus.on('turn:started', (data) => {
      if (data.type === CONSTANTS.UNIT_TYPES.CHARACTER) {
        UI.addLogMessage(`--- ${data.unit.shortName}'s turn (Initiative: ${data.initiative}) ---`, CONSTANTS.LOG_TYPES.MOVE);
      } else {
        UI.addLogMessage(`--- ${data.unit.name}'s turn ---`, CONSTANTS.LOG_TYPES.ATTACK);
      }
    });

    EventBus.on('enemy:stunned-skip', (data) => {
      UI.addLogMessage(`${data.name} is stunned and cannot act!`, CONSTANTS.LOG_TYPES.ATTACK);
    });

    EventBus.on('enemy:wait', (data) => {
      UI.addLogMessage(`${data.name} waits`, '');
    });

    EventBus.on('action:skipped', () => {
      UI.addLogMessage('Action skipped', '');
    });

    EventBus.on('rest:short', (data) => {
      UI.addLogMessage(`${data.name} takes a short rest, loses "${data.lostCard}", recovers ${data.recoveredCount} cards`, CONSTANTS.LOG_TYPES.HEAL);
    });

    EventBus.on('rest:long', (data) => {
      UI.addLogMessage(`${data.name} takes a long rest, heals ${data.healAmount}, recovers ${data.recoveredCount} cards (skips this round)`, CONSTANTS.LOG_TYPES.HEAL);
    });
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

        if (currentTurnEntry && currentTurnEntry.type === CONSTANTS.UNIT_TYPES.CHARACTER && !currentTurnEntry.actions) {
          // Awaiting action choice - show the 4 options
          UI.renderActionChoice(
            currentTurnEntry.unit,
            currentTurnEntry.cardA,
            currentTurnEntry.cardB,
            (actions) => this.selectActionChoice(actions)
          );
        } else if (currentTurnEntry && currentTurnEntry.type === CONSTANTS.UNIT_TYPES.CHARACTER && currentTurnEntry.actions) {
          // Show the selected cards for current character
          UI.renderSelectedCardsDisplay(
            currentTurnEntry.unit,
            currentTurnEntry.actions,
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
