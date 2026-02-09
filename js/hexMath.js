/**
 * Hex coordinate system and math utilities
 * Using axial coordinates (q, r)
 */

const HexMath = {
  /**
   * Calculate distance between two hexes
   */
  distance(a, b) {
    const ac = this.toCube(a);
    const bc = this.toCube(b);
    return (Math.abs(ac.q - bc.q) + Math.abs(ac.r - bc.r) + Math.abs(ac.s - bc.s)) / 2;
  },

  /**
   * Convert axial to cube coordinates
   */
  toCube(hex) {
    return {
      q: hex.q,
      r: hex.r,
      s: -hex.q - hex.r,
    };
  },

  /**
   * Get all neighboring hexes
   */
  neighbors(hex) {
    const directions = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    return directions.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
  },

  /**
   * Convert hex coordinates to pixel coordinates
   */
  toPixel(hex, size = CONSTANTS.HEX.SIZE) {
    const x = size * (3 / 2 * hex.q);
    const y = size * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
    return { x, y };
  },

  /**
   * Convert pixel coordinates to hex coordinates
   */
  fromPixel(point, size = CONSTANTS.HEX.SIZE) {
    const q = (2 / 3 * point.x) / size;
    const r = (-1 / 3 * point.x + Math.sqrt(3) / 3 * point.y) / size;
    return this.round(q, r);
  },

  /**
   * Round fractional hex coordinates to nearest hex
   */
  round(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  },

  /**
   * Get all hexes within range
   */
  hexesInRange(center, range) {
    const results = [];
    for (let q = -range; q <= range; q++) {
      for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
        results.push({ q: center.q + q, r: center.r + r });
      }
    }
    return results;
  },

  /**
   * Check if two hexes are equal
   */
  equals(a, b) {
    return a.q === b.q && a.r === b.r;
  },

  /**
   * Create hex key for maps/sets
   */
  key(hex) {
    return `${hex.q},${hex.r}`;
  },

  /**
   * Parse hex key back to coordinates
   */
  fromKey(key) {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  },

  /**
   * Get the direction from one hex to another (as a unit vector in hex coords)
   */
  getDirection(from, to) {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    // Normalize to nearest hex direction
    // Hex directions: (1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)
    const directions = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];

    // Find the direction that best matches the vector
    let bestDir = directions[0];
    let bestDot = -Infinity;

    for (const dir of directions) {
      const dot = dq * dir.q + dr * dir.r;
      if (dot > bestDot) {
        bestDot = dot;
        bestDir = dir;
      }
    }

    return bestDir;
  },

  /**
   * Add direction to hex
   */
  add(hex, direction) {
    return { q: hex.q + direction.q, r: hex.r + direction.r };
  },

  /**
   * Get polygon points for SVG rendering
   */
  polygonPoints(hex, size = CONSTANTS.HEX.SIZE) {
    const { x, y } = this.toPixel(hex, size);
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  },
};
