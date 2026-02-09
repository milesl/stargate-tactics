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
  getAttackTargets(unit, range, state, targetType = CONSTANTS.UNIT_TYPES.ENEMY) {
    const targets = [];
    const hexesInRange = HexMath.hexesInRange(unit.position, range);

    for (const hex of hexesInRange) {
      if (HexMath.equals(hex, unit.position)) continue;

      if (targetType === CONSTANTS.UNIT_TYPES.ENEMY && this.hasEnemy(hex, state)) {
        targets.push({
          hex,
          unit: this.getEnemyAt(hex, state),
        });
      } else if (targetType === CONSTANTS.UNIT_TYPES.CHARACTER && this.hasCharacter(hex, state)) {
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
    const unitType = state.characters.find(c => c.id === unit.id) ? CONSTANTS.UNIT_TYPES.CHARACTER : CONSTANTS.UNIT_TYPES.ENEMY;

    if (unitType === CONSTANTS.UNIT_TYPES.CHARACTER) {
      const characters = state.characters.map(c => {
        if (c.id === unit.id) {
          return { ...c, position: { ...targetHex } };
        }
        return c;
      });
      store.setState({ characters });
      EventBus.emit('unit:moved', { name: unit.shortName || unit.name, position: targetHex });
    } else {
      const enemies = state.enemies.map(e => {
        if (e.id === unit.id) {
          return { ...e, position: { ...targetHex } };
        }
        return e;
      });
      store.setState({ enemies });
      EventBus.emit('unit:moved', { name: unit.name, position: targetHex });
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
      EventBus.emit('unit:damaged', {
        attackerName: attacker.shortName || attacker.name,
        targetName: target.name,
        damage,
        newHealth,
        maxHealth: target.maxHealth,
      });

      if (newHealth <= 0) {
        EventBus.emit('unit:defeated', { name: target.name, isCharacter: false });
      } else if (stun) {
        // Apply stun effect to enemy
        store.stunEnemy(target.id);
        EventBus.emit('unit:stunned', { name: target.name });
      }
    } else {
      store.damageCharacter(target.id, damage);
      const char = state.characters.find(c => c.id === target.id);
      const newHealth = Math.max(0, char.health - damage);
      EventBus.emit('unit:damaged', {
        attackerName: attacker.name,
        targetName: target.shortName,
        damage,
        newHealth,
        maxHealth: target.maxHealth,
      });

      if (newHealth <= 0) {
        EventBus.emit('unit:defeated', { name: target.shortName, isCharacter: true });
      }
    }

    return { damage };
  },

  /**
   * Execute an AOE attack action - hits primary target and nearby enemies
   * @param {Object} attacker - The attacking unit
   * @param {Object} primaryTarget - The primary target unit
   * @param {number} damage - Damage to deal
   * @param {number} aoeRadius - Radius of AOE effect
   * @param {Object} state - Current game state
   * @param {Object} store - Game store
   * @param {number} maxAdditional - Max additional targets (for "hit 2 adjacent" style)
   */
  executeAoeAttack(attacker, primaryTarget, damage, aoeRadius, state, store, maxAdditional = null) {
    // Hit primary target first
    this.executeAttack(attacker, primaryTarget, damage, state, store);

    // Find additional targets within AOE radius of primary target
    const additionalTargets = state.enemies.filter(enemy => {
      if (enemy.id === primaryTarget.id) return false;
      if (enemy.health <= 0) return false;
      const distance = HexMath.distance(primaryTarget.position, enemy.position);
      return distance <= aoeRadius;
    });

    // Limit additional targets if specified (for "hit 2 adjacent" style)
    const targetsToHit = maxAdditional !== null
      ? additionalTargets.slice(0, maxAdditional)
      : additionalTargets;

    // Hit additional targets
    for (const target of targetsToHit) {
      // Re-fetch state as it may have changed
      const currentState = store.state;
      const currentTarget = currentState.enemies.find(e => e.id === target.id);
      if (currentTarget && currentTarget.health > 0) {
        this.executeAttack(attacker, currentTarget, damage, currentState, store);
      }
    }

    if (targetsToHit.length > 0) {
      EventBus.emit('attack:aoe', { additionalCount: targetsToHit.length });
    }
  },

  /**
   * Execute a heal action
   */
  executeHeal(healer, target, amount, state, store) {
    const characters = state.characters.map(c => {
      if (c.id === target.id) {
        const newHealth = Math.min(c.maxHealth, c.health + amount);
        const actualHeal = newHealth - c.health;
        EventBus.emit('unit:healed', {
          healerName: healer.shortName,
          targetName: target.shortName,
          amount: actualHeal,
          newHealth,
          maxHealth: c.maxHealth,
        });
        return { ...c, health: newHealth };
      }
      return c;
    });

    store.setState({ characters });
  },

  /**
   * Execute a push action - pushes target away from pusher
   * @param {Object} pusher - The unit doing the pushing
   * @param {Object} target - The target to push
   * @param {number} distance - How many hexes to push
   * @param {Object} state - Current game state
   * @param {Object} store - Game store
   */
  executePush(pusher, target, distance, state, store) {
    const direction = HexMath.getDirection(pusher.position, target.position);
    let currentPos = { ...target.position };
    let pushedDistance = 0;

    // Try to push the target step by step
    for (let i = 0; i < distance; i++) {
      const nextPos = HexMath.add(currentPos, direction);

      // Check if next position is valid (in bounds, not a wall, not occupied)
      const room = this.getRoom(state);
      if (!this.isInBounds(nextPos, room)) break;

      const wallSet = new Set((room.walls || []).map(w => HexMath.key(w)));
      if (wallSet.has(HexMath.key(nextPos))) break;

      // Check if occupied (by character or enemy, but not the target itself)
      const isOccupied = state.characters.some(c => c.id !== target.id && HexMath.equals(c.position, nextPos)) ||
                         state.enemies.some(e => e.id !== target.id && HexMath.equals(e.position, nextPos));
      if (isOccupied) break;

      currentPos = nextPos;
      pushedDistance++;
    }

    if (pushedDistance > 0) {
      // Move the target to the new position
      const isTargetEnemy = state.enemies.some(e => e.id === target.id);

      if (isTargetEnemy) {
        const enemies = state.enemies.map(e => {
          if (e.id === target.id) {
            return { ...e, position: { ...currentPos } };
          }
          return e;
        });
        store.setState({ enemies });
      } else {
        const characters = state.characters.map(c => {
          if (c.id === target.id) {
            return { ...c, position: { ...currentPos } };
          }
          return c;
        });
        store.setState({ characters });
      }

      EventBus.emit('unit:pushed', { name: target.name || target.shortName, distance: pushedDistance });
    } else {
      EventBus.emit('unit:pushed', { name: target.name || target.shortName, blocked: true });
    }

    return pushedDistance;
  },

  /**
   * Execute a shield action
   */
  executeShield(caster, target, amount, state, store) {
    const characters = state.characters.map(c => {
      if (c.id === target.id) {
        EventBus.emit('unit:shielded', {
          casterName: caster.shortName,
          targetName: target.shortName,
          amount,
        });
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
      case CONSTANTS.ACTION_TYPES.MOVE: {
        // Show reachable hexes for movement
        const reachable = this.getReachableHexes(unit, action.value, state);
        return {
          type: CONSTANTS.ACTION_TYPES.MOVE,
          reachableHexes: reachable,
          moveRange: action.value,
        };
      }

      case CONSTANTS.ACTION_TYPES.ATTACK: {
        const range = action.range || 1;
        const targets = this.getAttackTargets(unit, range, state, CONSTANTS.UNIT_TYPES.ENEMY);
        return {
          type: CONSTANTS.ACTION_TYPES.ATTACK,
          targets,
          damage: action.value,
          range,
          stun: action.stun || false,
          aoe: action.aoe || false,
          aoeRadius: action.aoeRadius || 1,
          push: action.push || 0,
        };
      }

      case CONSTANTS.ACTION_TYPES.HEAL: {
        const range = action.range || 0;

        // AOE heal - heal all allies
        if (action.aoe) {
          for (const char of state.characters) {
            if (char.health > 0 && char.health < char.maxHealth) {
              this.executeHeal(unit, char, action.value, state, store);
            }
          }
          return { type: 'complete' };
        }

        const targets = this.getHealTargets(unit, range, state);

        // If only self-heal (range 0), auto-execute
        if (range === 0 || action.text?.includes('self')) {
          this.executeHeal(unit, unit, action.value, state, store);
          return { type: 'complete' };
        }

        return {
          type: CONSTANTS.ACTION_TYPES.HEAL,
          targets,
          amount: action.value,
          range,
        };
      }

      case CONSTANTS.ACTION_TYPES.SHIELD: {
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
          type: CONSTANTS.ACTION_TYPES.SHIELD,
          targets,
          amount: action.value,
        };
      }

      case CONSTANTS.ACTION_TYPES.BUFF: {
        // For MVP, just log the buff
        EventBus.emit('action:special', { name: unit.shortName, text: action.text });
        return { type: 'complete' };
      }

      case CONSTANTS.ACTION_TYPES.SPECIAL: {
        // Handle special actions
        EventBus.emit('action:special', { name: unit.shortName, text: action.text });
        return { type: 'complete' };
      }

      case CONSTANTS.ACTION_TYPES.PUSH: {
        // Get enemies in range for push targeting
        const range = action.range || 1;
        const targets = this.getAttackTargets(unit, range, state, CONSTANTS.UNIT_TYPES.ENEMY);
        return {
          type: CONSTANTS.ACTION_TYPES.PUSH,
          targets,
          pushDistance: action.value,
          range,
        };
      }

      case CONSTANTS.ACTION_TYPES.TRAP: {
        // For MVP, just log
        EventBus.emit('action:special', { name: unit.shortName, text: `sets a trap: ${action.text}` });
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
