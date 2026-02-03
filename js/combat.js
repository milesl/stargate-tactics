/**
 * Combat resolution system
 */

const Combat = {
  /**
   * Get the current room data
   */
  getRoom(state) {
    return GameData.rooms[state.currentRoom - 1];
  },

  /**
   * Check if a hex is within room bounds
   */
  isInBounds(hex, room) {
    return hex.q >= 0 && hex.q < room.width && hex.r >= 0 && hex.r < room.height;
  },

  /**
   * Check if a hex is walkable (not occupied, not a wall, in bounds)
   */
  isWalkable(hex, state) {
    const room = this.getRoom(state);

    // Check bounds
    if (!this.isInBounds(hex, room)) return false;

    // Check walls
    const wallSet = new Set((room.walls || []).map(w => HexMath.key(w)));
    if (wallSet.has(HexMath.key(hex))) return false;

    // Check character positions
    for (const char of state.characters) {
      if (HexMath.equals(char.position, hex)) return false;
    }

    // Check enemy positions
    for (const enemy of state.enemies) {
      if (HexMath.equals(enemy.position, hex)) return false;
    }

    return true;
  },

  /**
   * Check if a hex has an enemy
   */
  hasEnemy(hex, state) {
    return state.enemies.some(e => HexMath.equals(e.position, hex));
  },

  /**
   * Check if a hex has a character
   */
  hasCharacter(hex, state) {
    return state.characters.some(c => HexMath.equals(c.position, hex));
  },

  /**
   * Get enemy at position
   */
  getEnemyAt(hex, state) {
    return state.enemies.find(e => HexMath.equals(e.position, hex));
  },

  /**
   * Get character at position
   */
  getCharacterAt(hex, state) {
    return state.characters.find(c => HexMath.equals(c.position, hex));
  },

  /**
   * Get reachable hexes for movement
   */
  getReachableHexes(unit, moveRange, state) {
    return Pathfinding.getReachableHexes(
      unit.position,
      moveRange,
      (hex) => this.isWalkable(hex, state)
    );
  },

  /**
   * Get valid attack targets for a unit
   */
  getAttackTargets(unit, range, state, targetType = 'enemy') {
    const targets = [];
    const hexesInRange = HexMath.hexesInRange(unit.position, range);

    for (const hex of hexesInRange) {
      if (HexMath.equals(hex, unit.position)) continue;

      if (targetType === 'enemy' && this.hasEnemy(hex, state)) {
        targets.push({
          hex,
          unit: this.getEnemyAt(hex, state),
        });
      } else if (targetType === 'character' && this.hasCharacter(hex, state)) {
        targets.push({
          hex,
          unit: this.getCharacterAt(hex, state),
        });
      }
    }

    return targets;
  },

  /**
   * Get valid heal targets (allies in range)
   */
  getHealTargets(unit, range, state) {
    const targets = [];

    for (const char of state.characters) {
      if (char.health <= 0) continue;
      if (char.health >= char.maxHealth) continue; // Already full health

      const distance = HexMath.distance(unit.position, char.position);
      if (distance <= range) {
        targets.push({
          hex: char.position,
          unit: char,
        });
      }
    }

    return targets;
  },

  /**
   * Execute a move action
   */
  executeMove(unit, targetHex, state, store) {
    const unitType = state.characters.find(c => c.id === unit.id) ? 'character' : 'enemy';

    if (unitType === 'character') {
      const characters = state.characters.map(c => {
        if (c.id === unit.id) {
          return { ...c, position: { ...targetHex } };
        }
        return c;
      });
      store.setState({ characters });
      UI.addLogMessage(`${unit.shortName || unit.name} moved to (${targetHex.q}, ${targetHex.r})`, 'move');
    } else {
      const enemies = state.enemies.map(e => {
        if (e.id === unit.id) {
          return { ...e, position: { ...targetHex } };
        }
        return e;
      });
      store.setState({ enemies });
      UI.addLogMessage(`${unit.name} moved to (${targetHex.q}, ${targetHex.r})`, 'move');
    }
  },

  /**
   * Execute an attack action
   * @param {Object} attacker - The attacking unit
   * @param {Object} target - The target unit
   * @param {number} damage - Damage to deal
   * @param {Object} state - Current game state
   * @param {Object} store - Game store
   * @param {boolean} stun - Whether to stun the target
   */
  executeAttack(attacker, target, damage, state, store, stun = false) {
    const isTargetEnemy = state.enemies.some(e => e.id === target.id);

    if (isTargetEnemy) {
      store.damageEnemy(target.id, damage);
      const newHealth = Math.max(0, target.health - damage);
      UI.addLogMessage(
        `${attacker.shortName || attacker.name} attacks ${target.name} for ${damage} damage! (${newHealth}/${target.maxHealth})`,
        'attack'
      );

      if (newHealth <= 0) {
        UI.addLogMessage(`${target.name} defeated!`, 'attack');
      } else if (stun) {
        // Apply stun effect to enemy
        store.stunEnemy(target.id);
        UI.addLogMessage(`${target.name} is stunned!`, 'attack');
      }
    } else {
      store.damageCharacter(target.id, damage);
      const char = state.characters.find(c => c.id === target.id);
      const newHealth = Math.max(0, char.health - damage);
      UI.addLogMessage(
        `${attacker.name} attacks ${target.shortName} for ${damage} damage! (${newHealth}/${target.maxHealth})`,
        'attack'
      );

      if (newHealth <= 0) {
        UI.addLogMessage(`${target.shortName} has fallen! Mission failed!`, 'attack');
      }
    }

    return { damage };
  },

  /**
   * Execute a heal action
   */
  executeHeal(healer, target, amount, state, store) {
    const characters = state.characters.map(c => {
      if (c.id === target.id) {
        const newHealth = Math.min(c.maxHealth, c.health + amount);
        const actualHeal = newHealth - c.health;
        UI.addLogMessage(
          `${healer.shortName} heals ${target.shortName} for ${actualHeal}! (${newHealth}/${c.maxHealth})`,
          'heal'
        );
        return { ...c, health: newHealth };
      }
      return c;
    });

    store.setState({ characters });
  },

  /**
   * Execute a shield action
   */
  executeShield(caster, target, amount, state, store) {
    const characters = state.characters.map(c => {
      if (c.id === target.id) {
        UI.addLogMessage(
          `${caster.shortName} grants ${target.shortName} Shield ${amount}!`,
          'heal'
        );
        return { ...c, shield: c.shield + amount };
      }
      return c;
    });

    store.setState({ characters });
  },

  /**
   * Process a card action (top or bottom)
   * Returns true if action requires target selection, false if auto-executed
   */
  processAction(action, unit, state, store) {
    switch (action.type) {
      case 'move': {
        // Show reachable hexes for movement
        const reachable = this.getReachableHexes(unit, action.value, state);
        return {
          type: 'move',
          reachableHexes: reachable,
          moveRange: action.value,
        };
      }

      case 'attack': {
        const range = action.range || 1;
        const targets = this.getAttackTargets(unit, range, state, 'enemy');
        return {
          type: 'attack',
          targets,
          damage: action.value,
          range,
          stun: action.stun || false,
        };
      }

      case 'heal': {
        const range = action.range || 0;
        const targets = this.getHealTargets(unit, range, state);

        // If only self-heal (range 0), auto-execute
        if (range === 0 || action.text?.includes('self')) {
          this.executeHeal(unit, unit, action.value, state, store);
          return { type: 'complete' };
        }

        return {
          type: 'heal',
          targets,
          amount: action.value,
          range,
        };
      }

      case 'shield': {
        // Check if self-only
        if (action.text?.includes('self')) {
          this.executeShield(unit, unit, action.value, state, store);
          return { type: 'complete' };
        }

        // Otherwise need to select ally target
        const targets = state.characters
          .filter(c => c.health > 0)
          .map(c => ({ hex: c.position, unit: c }));

        return {
          type: 'shield',
          targets,
          amount: action.value,
        };
      }

      case 'buff': {
        // For MVP, just log the buff
        UI.addLogMessage(`${unit.shortName} uses ${action.text}`, 'heal');
        return { type: 'complete' };
      }

      case 'special': {
        // Handle special actions
        UI.addLogMessage(`${unit.shortName} uses special: ${action.text}`, 'move');
        return { type: 'complete' };
      }

      case 'push': {
        // For MVP, just log
        UI.addLogMessage(`${unit.shortName} uses ${action.text}`, 'move');
        return { type: 'complete' };
      }

      case 'trap': {
        // For MVP, just log
        UI.addLogMessage(`${unit.shortName} sets a trap: ${action.text}`, 'move');
        return { type: 'complete' };
      }

      default:
        return { type: 'complete' };
    }
  },

  /**
   * Check if target is in range
   */
  isInRange(attacker, target, range) {
    return HexMath.distance(attacker, target) <= range;
  },

  /**
   * Clear shields at end of round
   */
  clearShields(state, store) {
    const characters = state.characters.map(c => ({ ...c, shield: 0 }));
    store.setState({ characters });
  },
};
