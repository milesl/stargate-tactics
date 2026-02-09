/**
 * Game orchestration - Turn execution
 * Turn order building, character actions, enemy turns
 */

Object.assign(Game, {
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
});
