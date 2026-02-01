/**
 * Enemy AI decision logic
 */

const EnemyAI = {
  /**
   * Decide action for an enemy unit
   * @param {Object} enemy - Enemy unit data
   * @param {Object} state - Current game state
   * @returns {Object} Action to perform {type, target, position}
   */
  decideAction(enemy, state) {
    // Skip if stunned
    if (enemy.stunned) {
      return { type: 'wait' };
    }

    const target = this.findNearestTarget(enemy, state.characters);
    if (!target) {
      return { type: 'wait' };
    }

    const distance = HexMath.distance(enemy.position, target.position);

    // Melee AI (Jaffa Warrior)
    if (enemy.ai === 'melee') {
      return this.decideMeleeAction(enemy, target, distance, state);
    }

    // Ranged AI (Serpent Guard)
    if (enemy.ai === 'ranged') {
      return this.decideRangedAction(enemy, target, distance, state);
    }

    return { type: 'wait' };
  },

  /**
   * Melee AI: Get close and attack
   */
  decideMeleeAction(enemy, target, distance, state) {
    // If adjacent, attack
    if (distance <= enemy.range) {
      return {
        type: 'attack',
        target: target,
      };
    }

    // Otherwise, move toward target
    const moveTarget = this.findBestMoveToward(enemy, target.position, enemy.move, state);

    if (moveTarget) {
      const newDistance = HexMath.distance(moveTarget, target.position);

      // If we can move adjacent and attack
      if (newDistance <= enemy.range) {
        return {
          type: 'moveAndAttack',
          position: moveTarget,
          target: target,
        };
      }

      return {
        type: 'move',
        position: moveTarget,
      };
    }

    return { type: 'wait' };
  },

  /**
   * Ranged AI: Keep distance and attack
   */
  decideRangedAction(enemy, target, distance, state) {
    // If within attack range, attack
    if (distance <= enemy.range && distance > 1) {
      return {
        type: 'attack',
        target: target,
      };
    }

    // If too close (adjacent), try to move away then attack
    if (distance === 1) {
      const retreatPos = this.findRetreatPosition(enemy, target, state);
      if (retreatPos) {
        const newDistance = HexMath.distance(retreatPos, target.position);
        if (newDistance <= enemy.range) {
          return {
            type: 'moveAndAttack',
            position: retreatPos,
            target: target,
          };
        }
        return {
          type: 'move',
          position: retreatPos,
        };
      }
      // Can't retreat, attack anyway
      return {
        type: 'attack',
        target: target,
      };
    }

    // If too far, move closer
    if (distance > enemy.range) {
      const moveTarget = this.findBestMoveToward(enemy, target.position, enemy.move, state);
      if (moveTarget) {
        const newDistance = HexMath.distance(moveTarget, target.position);
        if (newDistance <= enemy.range) {
          return {
            type: 'moveAndAttack',
            position: moveTarget,
            target: target,
          };
        }
        return {
          type: 'move',
          position: moveTarget,
        };
      }
    }

    return { type: 'wait' };
  },

  /**
   * Find nearest player character
   */
  findNearestTarget(enemy, characters) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (const char of characters) {
      if (char.health <= 0) continue;

      const distance = HexMath.distance(enemy.position, char.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = char;
      }
    }

    return nearest;
  },

  /**
   * Find best hex to move toward a target
   */
  findBestMoveToward(enemy, targetPos, moveRange, state) {
    const reachable = Pathfinding.getReachableHexes(
      enemy.position,
      moveRange,
      (hex) => this.isWalkable(hex, state)
    );

    if (reachable.length === 0) return null;

    // Find the reachable hex closest to target
    let best = null;
    let bestDistance = Infinity;

    for (const { hex } of reachable) {
      const distance = HexMath.distance(hex, targetPos);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = hex;
      }
    }

    return best;
  },

  /**
   * Find position to retreat from target
   */
  findRetreatPosition(enemy, target, state) {
    const reachable = Pathfinding.getReachableHexes(
      enemy.position,
      enemy.move,
      (hex) => this.isWalkable(hex, state)
    );

    if (reachable.length === 0) return null;

    // Find hex that maximizes distance from target while staying in attack range
    let best = null;
    let bestScore = -Infinity;

    for (const { hex } of reachable) {
      const distFromTarget = HexMath.distance(hex, target.position);

      // Prefer hexes at optimal range (enemy.range distance)
      let score = distFromTarget;

      // Bonus for being at optimal range
      if (distFromTarget === enemy.range) {
        score += 10;
      } else if (distFromTarget <= enemy.range && distFromTarget > 1) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        best = hex;
      }
    }

    return best;
  },

  /**
   * Check if hex is walkable for enemy
   */
  isWalkable(hex, state) {
    const room = GameData.rooms[state.currentRoom - 1];

    // Check bounds
    if (hex.q < 0 || hex.q >= room.width || hex.r < 0 || hex.r >= room.height) {
      return false;
    }

    // Check walls
    const wallSet = new Set((room.walls || []).map(w => HexMath.key(w)));
    if (wallSet.has(HexMath.key(hex))) return false;

    // Check character positions
    for (const char of state.characters) {
      if (HexMath.equals(char.position, hex)) return false;
    }

    // Check other enemy positions
    for (const enemy of state.enemies) {
      if (HexMath.equals(enemy.position, hex)) return false;
    }

    return true;
  },
};
