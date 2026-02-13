/**
 * Game orchestration - Player actions and event handlers
 * Hex clicks, unit clicks, rest actions, round management
 */

Object.assign(Game, {
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
   * Skip the current action
   */
  skipCurrentAction() {
    const state = this.store.state;
    const currentAction = state.turn.currentAction;

    if (!currentAction) return;

    EventBus.emit('action:skipped', {});
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
          burned: [...c.burned, lostCard],
        };
      }
      return c;
    });

    this.store.setState({ characters });
    EventBus.emit('card:burned', { name: lostCard.name, characterName: char.shortName });
    EventBus.emit('rest:short', { name: char.shortName, lostCard: lostCard.name, recoveredCount: recoveredCards.length });
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

    // Recover 1 random burned card
    let recoveredBurnedCard = null;
    let newBurned = [...char.burned];
    if (newBurned.length > 0) {
      const burnedIndex = Math.floor(Math.random() * newBurned.length);
      recoveredBurnedCard = newBurned[burnedIndex];
      newBurned = newBurned.filter((_, i) => i !== burnedIndex);
    }

    const characters = state.characters.map(c => {
      if (c.id === charId) {
        const newHealth = Math.min(c.maxHealth, c.health + CONSTANTS.GAME.LONG_REST_HEAL);
        const newHand = [...c.hand, ...recoveredCards];
        if (recoveredBurnedCard) newHand.push(recoveredBurnedCard);
        return {
          ...c,
          hand: newHand,
          discard: [],
          burned: newBurned,
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
    EventBus.emit('rest:long', {
      name: char.shortName,
      healAmount: CONSTANTS.GAME.LONG_REST_HEAL,
      recoveredCount: recoveredCards.length,
      recoveredBurnedCard: recoveredBurnedCard?.name || null,
    });
    UI.showRestButtons(false);
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
      // Check if any character can still play (has cards or can rest)
      const canContinue = this.store.state.characters.some(c =>
        c.hand.length >= CONSTANTS.GAME.CARDS_TO_PLAY || c.discard.length > 0
      );
      if (!canContinue) {
        UI.addLogMessage('No cards remaining! Mission failed!', CONSTANTS.LOG_TYPES.ATTACK);
        this.store.setPhase(CONSTANTS.PHASES.DEFEAT);
      } else {
        this.store.clearCardSelections();
        UI.addLogMessage('Select cards for next round.', '');
      }
    }
  },
});
