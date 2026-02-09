/**
 * UI rendering - Hex grid, units, and artifacts
 */

Object.assign(UI, {
  /**
   * Get polygon points for a hex at given coordinates
   * @param {Object} hex - Hex coordinates {q, r}
   * @returns {String} SVG polygon points string
   */
  getHexPoints(hex) {
    const pixel = HexMath.toPixel(hex, this.hexSize);
    const x = pixel.x + this.gridOffset.x;
    const y = pixel.y + this.gridOffset.y;
    const points = [];

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = x + this.hexSize * Math.cos(angle);
      const py = y + this.hexSize * Math.sin(angle);
      points.push(`${px},${py}`);
    }

    return points.join(' ');
  },

  /**
   * Get pixel center of a hex
   * @param {Object} hex - Hex coordinates {q, r}
   * @returns {Object} Pixel coordinates {x, y}
   */
  getHexCenter(hex) {
    const pixel = HexMath.toPixel(hex, this.hexSize);
    return {
      x: pixel.x + this.gridOffset.x,
      y: pixel.y + this.gridOffset.y,
    };
  },

  /**
   * Render the hex grid
   * @param {Object} room - Room data
   * @param {Array} characters - Character data
   * @param {Array} enemies - Enemy data
   * @param {Array} highlightedHexes - Hexes to highlight
   */
  renderHexGrid(room, characters, enemies, highlightedHexes = []) {
    const svg = this.elements.hexGrid;
    if (!svg) return;

    // Calculate SVG size based on room dimensions
    const padding = 60;
    const gridWidth = room.width * this.hexSize * 1.75 + padding;
    const gridHeight = room.height * this.hexSize * 1.5 + padding;

    // Set SVG dimensions
    svg.setAttribute('width', gridWidth);
    svg.setAttribute('height', gridHeight);
    svg.setAttribute('viewBox', `0 0 ${gridWidth} ${gridHeight}`);

    // Clear existing content
    svg.innerHTML = '';

    // Create a group for tiles
    const tilesGroup = this.createSVGElement('g', { id: 'tiles-layer' });
    svg.appendChild(tilesGroup);

    // Create a group for highlights
    const highlightGroup = this.createSVGElement('g', { id: 'highlight-layer' });
    svg.appendChild(highlightGroup);

    // Create a group for units
    const unitsGroup = this.createSVGElement('g', { id: 'units-layer' });
    svg.appendChild(unitsGroup);

    // Build set of occupied positions
    const occupiedPositions = new Set();
    characters.forEach(c => occupiedPositions.add(HexMath.key(c.position)));
    enemies.forEach(e => occupiedPositions.add(HexMath.key(e.position)));

    // Build set of wall positions
    const wallPositions = new Set();
    (room.walls || []).forEach(w => wallPositions.add(HexMath.key(w)));

    // Build set of highlighted positions
    const highlightedPositions = new Set();
    highlightedHexes.forEach(h => highlightedPositions.add(HexMath.key(h.hex || h)));

    // Generate hex tiles for the room
    for (let r = 0; r < room.height; r++) {
      for (let q = 0; q < room.width; q++) {
        const hex = { q, r };
        const key = HexMath.key(hex);

        // Determine tile type
        let tileType = 'floor';
        if (wallPositions.has(key)) {
          tileType = 'wall';
        }

        // Create hex polygon
        const polygon = this.createSVGElement('polygon', {
          points: this.getHexPoints(hex),
          class: `hex-polygon ${tileType}`,
          'data-q': q,
          'data-r': r,
        });

        // Create hex group
        const hexGroup = this.createSVGElement('g', {
          class: 'hex-tile',
          'data-q': q,
          'data-r': r,
        });

        hexGroup.appendChild(polygon);

        // Add click handler
        hexGroup.addEventListener('click', () => {
          if (this.onHexClick) {
            this.onHexClick(hex);
          }
        });

        tilesGroup.appendChild(hexGroup);

        // Add highlight overlay if needed
        if (highlightedPositions.has(key)) {
          const highlightData = highlightedHexes.find(h =>
            HexMath.key(h.hex || h) === key
          );
          const highlightType = highlightData?.type || CONSTANTS.HIGHLIGHT_TYPES.REACHABLE;

          const highlight = this.createSVGElement('polygon', {
            points: this.getHexPoints(hex),
            class: `hex-polygon ${highlightType}`,
            'data-q': q,
            'data-r': r,
          });
          highlightGroup.appendChild(highlight);
        }
      }
    }

    // Render artifact if in room 3
    if (room.artifactPosition) {
      this.renderArtifact(unitsGroup, room.artifactPosition);
    }

    // Render characters
    characters.forEach(character => {
      this.renderUnit(unitsGroup, character, CONSTANTS.UNIT_TYPES.CHARACTER);
    });

    // Render enemies
    enemies.forEach(enemy => {
      this.renderUnit(unitsGroup, enemy, CONSTANTS.UNIT_TYPES.ENEMY);
    });
  },

  /**
   * Render a unit token on the grid
   * @param {SVGElement} parent - Parent SVG group
   * @param {Object} unit - Unit data
   * @param {String} type - 'character' or 'enemy'
   */
  renderUnit(parent, unit, type) {
    const center = this.getHexCenter(unit.position);
    const radius = this.hexSize * CONSTANTS.UI.UNIT_TOKEN_RADIUS_FRACTION;

    // Determine enemy subtype class
    const enemyClass = type === CONSTANTS.UNIT_TYPES.ENEMY ? (unit.ai === CONSTANTS.AI_TYPES.RANGED ? 'ranged' : 'melee') : '';

    // Create unit group
    const unitGroup = this.createSVGElement('g', {
      class: 'unit-token',
      'data-id': unit.id,
      'data-type': type,
    });

    // Unit circle
    const circle = this.createSVGElement('circle', {
      cx: center.x,
      cy: center.y,
      r: radius,
      class: `unit-circle ${type} ${enemyClass}`.trim(),
    });
    unitGroup.appendChild(circle);

    // Add tooltip
    const title = this.createSVGElement('title');
    if (type === CONSTANTS.UNIT_TYPES.ENEMY) {
      const behavior = unit.ai === CONSTANTS.AI_TYPES.RANGED ? 'Ranged, keeps distance' : 'Melee, charges in';
      title.textContent = `${unit.name} | HP: ${unit.health}/${unit.maxHealth} | ATK: ${unit.attack} | ${behavior}`;
    } else {
      const shieldText = unit.shield > 0 ? ` | Shield: ${unit.shield}` : '';
      title.textContent = `${unit.name} | HP: ${unit.health}/${unit.maxHealth}${shieldText}`;
    }
    unitGroup.appendChild(title);

    // Unit label (initials or short name)
    const label = type === CONSTANTS.UNIT_TYPES.CHARACTER
      ? unit.shortName?.charAt(0) || unit.name.charAt(0)
      : unit.name.charAt(0);

    const labelEl = this.createSVGElement('text', {
      x: center.x,
      y: center.y,
      class: 'unit-label',
    });
    labelEl.textContent = label;
    unitGroup.appendChild(labelEl);

    // Health indicator
    const healthText = this.createSVGElement('text', {
      x: center.x,
      y: center.y + radius + 12,
      class: 'unit-health',
    });
    healthText.textContent = `${unit.health}/${unit.maxHealth}`;
    unitGroup.appendChild(healthText);

    // Click handler
    unitGroup.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onUnitClick) {
        this.onUnitClick(unit, type);
      }
    });

    parent.appendChild(unitGroup);
  },

  /**
   * Render artifact token
   * @param {SVGElement} parent - Parent SVG group
   * @param {Object} position - Artifact position {q, r}
   */
  renderArtifact(parent, position) {
    const center = this.getHexCenter(position);
    const size = this.hexSize * 0.4;

    // Create artifact group
    const artifactGroup = this.createSVGElement('g', {
      class: 'artifact-token',
    });

    // Diamond shape for artifact
    const points = [
      `${center.x},${center.y - size}`,
      `${center.x + size},${center.y}`,
      `${center.x},${center.y + size}`,
      `${center.x - size},${center.y}`,
    ].join(' ');

    const diamond = this.createSVGElement('polygon', {
      points: points,
      fill: CONSTANTS.COLORS.ARTIFACT_FILL,
      stroke: CONSTANTS.COLORS.ARTIFACT_STROKE,
      'stroke-width': 2,
    });
    artifactGroup.appendChild(diamond);

    // Add title for tooltip
    const title = this.createSVGElement('title', {});
    title.textContent = 'Ancient Artifact - Move a character here to complete the mission';
    artifactGroup.appendChild(title);

    // Click handler to show hint
    artifactGroup.addEventListener('click', () => {
      this.addLogMessage('Move a character to the artifact to retrieve it!', CONSTANTS.LOG_TYPES.MOVE);
    });

    parent.appendChild(artifactGroup);
  },
});
