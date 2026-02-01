/**
 * A* Pathfinding for hex grid
 */

const Pathfinding = {
  /**
   * Find path from start to goal using A*
   * @param {Object} start - Starting hex {q, r}
   * @param {Object} goal - Goal hex {q, r}
   * @param {Function} isWalkable - Function to check if hex is walkable
   * @returns {Array} Array of hexes forming the path, or empty if no path
   */
  findPath(start, goal, isWalkable) {
    const startKey = HexMath.key(start);
    const goalKey = HexMath.key(goal);

    if (startKey === goalKey) return [start];
    if (!isWalkable(goal)) return [];

    const openSet = new Set([startKey]);
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, HexMath.distance(start, goal)]]);

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let currentKey = null;
      let lowestF = Infinity;
      for (const key of openSet) {
        const f = fScore.get(key) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentKey = key;
        }
      }

      if (currentKey === goalKey) {
        // Reconstruct path
        return this._reconstructPath(cameFrom, currentKey);
      }

      openSet.delete(currentKey);
      const current = HexMath.fromKey(currentKey);

      for (const neighbor of HexMath.neighbors(current)) {
        const neighborKey = HexMath.key(neighbor);

        if (!isWalkable(neighbor)) continue;

        const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          fScore.set(neighborKey, tentativeG + HexMath.distance(neighbor, goal));

          if (!openSet.has(neighborKey)) {
            openSet.add(neighborKey);
          }
        }
      }
    }

    return []; // No path found
  },

  /**
   * Reconstruct path from cameFrom map
   */
  _reconstructPath(cameFrom, currentKey) {
    const path = [HexMath.fromKey(currentKey)];

    while (cameFrom.has(currentKey)) {
      currentKey = cameFrom.get(currentKey);
      path.unshift(HexMath.fromKey(currentKey));
    }

    return path;
  },

  /**
   * Get all reachable hexes within movement range using BFS
   * @param {Object} start - Starting hex {q, r}
   * @param {Number} range - Maximum movement distance
   * @param {Function} isWalkable - Function to check if hex is walkable
   * @returns {Array} Array of {hex, distance} objects for reachable hexes
   */
  getReachableHexes(start, range, isWalkable) {
    const visited = new Map();
    const startKey = HexMath.key(start);
    visited.set(startKey, 0);

    const queue = [{ hex: start, distance: 0 }];
    const reachable = [];

    while (queue.length > 0) {
      const { hex, distance } = queue.shift();

      if (distance > 0) {
        reachable.push({ hex, distance });
      }

      if (distance < range) {
        for (const neighbor of HexMath.neighbors(hex)) {
          const neighborKey = HexMath.key(neighbor);

          if (!visited.has(neighborKey) && isWalkable(neighbor)) {
            visited.set(neighborKey, distance + 1);
            queue.push({ hex: neighbor, distance: distance + 1 });
          }
        }
      }
    }

    return reachable;
  },

  /**
   * Get all hexes in range for attacks (line of sight not considered for MVP)
   * @param {Object} start - Starting hex {q, r}
   * @param {Number} range - Attack range
   * @param {Function} hasTarget - Function to check if hex has valid target
   * @returns {Array} Array of hexes with valid targets
   */
  getTargetsInRange(start, range, hasTarget) {
    const targets = [];
    const hexesInRange = HexMath.hexesInRange(start, range);

    for (const hex of hexesInRange) {
      if (!HexMath.equals(hex, start) && hasTarget(hex)) {
        targets.push(hex);
      }
    }

    return targets;
  },
};
