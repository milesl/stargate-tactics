/**
 * UI rendering and DOM manipulation
 */

const UI = {
  // DOM element references
  elements: {},

  // Hex size for rendering
  hexSize: 40,

  // SVG namespace
  svgNS: 'http://www.w3.org/2000/svg',

  // Grid offset for centering
  gridOffset: { x: 100, y: 80 },

  // Click handlers (set by Game)
  onHexClick: null,
  onUnitClick: null,

  /**
   * Initialize UI elements
   */
  init() {
    this.elements = {
      app: document.getElementById('app'),
      missionBrief: document.getElementById('mission-brief'),
      gameScreen: document.getElementById('game-screen'),
      victoryScreen: document.getElementById('victory-screen'),
      defeatScreen: document.getElementById('defeat-screen'),
      hexGrid: document.getElementById('hex-grid'),
      characterPortraits: document.getElementById('character-portraits'),
      characterTabs: document.getElementById('character-tabs'),
      characterHand: document.getElementById('character-hand'),
      confirmCards: document.getElementById('confirm-cards'),
      skipAction: document.getElementById('skip-action'),
      shortRest: document.getElementById('short-rest'),
      longRest: document.getElementById('long-rest'),
      initiativeList: document.getElementById('initiative-list'),
      logMessages: document.getElementById('log-messages'),
      startMission: document.getElementById('start-mission'),
      restartGame: document.getElementById('restart-game'),
      retryMission: document.getElementById('retry-mission'),
      gateAddress: document.getElementById('gate-address'),
      roomName: document.getElementById('room-name'),
      roomProgress: document.getElementById('room-progress'),
    };
  },

  /**
   * Show a specific screen
   * @param {String} screenId - Screen to show
   */
  showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
      screen.style.display = 'none';
    });
    // Show requested screen
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.remove('hidden');
      screen.style.display = 'flex';
    }
  },

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
   * Create an SVG element
   * @param {String} tag - SVG element tag
   * @param {Object} attrs - Attributes to set
   * @returns {SVGElement} Created element
   */
  createSVGElement(tag, attrs = {}) {
    const el = document.createElementNS(this.svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
    return el;
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
          const highlightType = highlightData?.type || 'reachable';

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
      this.renderUnit(unitsGroup, character, 'character');
    });

    // Render enemies
    enemies.forEach(enemy => {
      this.renderUnit(unitsGroup, enemy, 'enemy');
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
    const radius = this.hexSize * 0.6;

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
      class: `unit-circle ${type}`,
    });
    unitGroup.appendChild(circle);

    // Unit label (initials or short name)
    const label = type === 'character'
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
      fill: '#d4af37',
      stroke: '#fff',
      'stroke-width': 2,
    });
    artifactGroup.appendChild(diamond);

    // Add title for tooltip
    const title = this.createSVGElement('title', {});
    title.textContent = 'Ancient Artifact - Move a character here to complete the mission';
    artifactGroup.appendChild(title);

    // Click handler to show hint
    artifactGroup.addEventListener('click', () => {
      this.addLogMessage('Move a character to the artifact to retrieve it!', 'move');
    });

    parent.appendChild(artifactGroup);
  },

  /**
   * Render character portraits
   * @param {Array} characters - Character data
   */
  renderCharacterPortraits(characters) {
    const container = this.elements.characterPortraits;
    if (!container) return;

    container.innerHTML = '';

    characters.forEach(character => {
      const portrait = document.createElement('div');
      portrait.className = 'character-portrait';
      portrait.dataset.id = character.id;

      const healthPercent = (character.health / character.maxHealth) * 100;
      const healthClass = healthPercent <= 30 ? 'low' : '';

      portrait.innerHTML = `
        <div class="character-name">${character.shortName}</div>
        <div class="character-health">
          <div class="health-bar-container">
            <div class="health-bar ${healthClass}" style="width: ${healthPercent}%"></div>
          </div>
          <span class="health-text">${character.health}/${character.maxHealth}</span>
        </div>
        ${character.shield > 0 ? `<div class="character-shield">Shield: ${character.shield}</div>` : ''}
      `;

      container.appendChild(portrait);
    });
  },

  /**
   * Update room indicator
   * @param {Number} roomNumber - Current room (1-3)
   * @param {String} roomName - Room name
   */
  updateRoomIndicator(roomNumber, roomName) {
    if (this.elements.roomName) {
      this.elements.roomName.textContent = roomName;
    }
    if (this.elements.roomProgress) {
      this.elements.roomProgress.textContent = `Room ${roomNumber}/3`;
    }
  },

  /**
   * Render character tabs for card selection
   * @param {Array} characters - Character data
   * @param {String} activeCharacterId - Currently selected character
   * @param {Object} selectedCards - Card selections per character
   * @param {Function} onTabClick - Tab click handler
   */
  renderCharacterTabs(characters, activeCharacterId, selectedCards, onTabClick) {
    const container = this.elements.characterTabs;
    if (!container) return;

    container.innerHTML = '';

    characters.forEach(character => {
      const tab = document.createElement('button');
      const isActive = character.id === activeCharacterId;
      const selection = selectedCards[character.id];
      const isReady = selection?.cardA && selection?.cardB;
      const needsRest = character.hand.length < 2;

      let classes = 'character-tab';
      if (isActive) classes += ' active';
      if (isReady) classes += ' ready';
      if (needsRest) classes += ' needs-rest';

      tab.className = classes;
      tab.textContent = character.shortName;
      tab.dataset.id = character.id;

      tab.addEventListener('click', () => {
        if (onTabClick) onTabClick(character.id);
      });

      container.appendChild(tab);
    });
  },

  /**
   * Render card hand for a character
   * @param {Object} character - Character data
   * @param {Object} selectedCards - Currently selected cards {cardA, cardB, useTopOfA}
   * @param {Function} onCardClick - Card click handler
   */
  renderCardHand(character, selectedCards = {}, onCardClick) {
    const container = this.elements.characterHand;
    if (!container) return;

    container.innerHTML = '';

    character.hand.forEach(card => {
      const isCardA = selectedCards.cardA?.id === card.id;
      const isCardB = selectedCards.cardB?.id === card.id;
      const isSelected = isCardA || isCardB;
      const isDisabled = character.hand.length <= 2 && !isSelected;

      const cardEl = document.createElement('div');
      cardEl.className = `card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
      cardEl.dataset.id = card.id;

      let selectionIndicator = '';
      if (isCardA) {
        selectionIndicator = `<div class="card-selection">Card A (using ${selectedCards.useTopOfA ? 'TOP' : 'BOTTOM'})</div>`;
      } else if (isCardB) {
        selectionIndicator = `<div class="card-selection">Card B (using ${selectedCards.useTopOfA ? 'BOTTOM' : 'TOP'})</div>`;
      }

      cardEl.innerHTML = `
        <div class="card-header">
          <span class="card-name">${card.name}</span>
          <span class="card-initiative">${card.initiative}</span>
        </div>
        <div class="card-action">
          <div class="action-label">TOP</div>
          <div class="action-text">${card.top.text}</div>
        </div>
        <div class="card-action">
          <div class="action-label">BOTTOM</div>
          <div class="action-text">${card.bottom.text}</div>
        </div>
        ${selectionIndicator}
      `;

      if (!isDisabled) {
        cardEl.addEventListener('click', () => {
          if (onCardClick) onCardClick(card, character.id);
        });
      }

      container.appendChild(cardEl);
    });
  },

  /**
   * Render the selected cards during execution phase
   * @param {Object} character - The character taking their turn
   * @param {Object} cardA - First selected card
   * @param {Object} cardB - Second selected card
   * @param {Boolean} useTopOfA - Whether to use top of cardA
   * @param {Number} currentActionIndex - Which action is currently being executed (0 or 1)
   */
  renderSelectedCardsDisplay(character, cardA, cardB, useTopOfA, currentActionIndex) {
    const container = this.elements.characterHand;
    if (!container) return;

    const action1 = useTopOfA ? cardA.top : cardA.bottom;
    const action2 = useTopOfA ? cardB.bottom : cardB.top;
    const action1Label = useTopOfA ? 'TOP' : 'BOTTOM';
    const action2Label = useTopOfA ? 'BOTTOM' : 'TOP';

    container.innerHTML = `
      <div class="execution-cards-display">
        <div class="execution-header">${character.shortName}'s Turn</div>
        <div class="execution-cards">
          <div class="execution-card ${currentActionIndex === 0 ? 'current' : currentActionIndex > 0 ? 'done' : ''}">
            <div class="execution-card-name">${cardA.name}</div>
            <div class="execution-card-action">
              <span class="action-badge">${action1Label}</span>
              ${action1.text}
            </div>
            ${currentActionIndex === 0 ? '<div class="action-status">← Current</div>' : ''}
            ${currentActionIndex > 0 ? '<div class="action-status done">✓ Done</div>' : ''}
          </div>
          <div class="execution-card ${currentActionIndex === 1 ? 'current' : ''}">
            <div class="execution-card-name">${cardB.name}</div>
            <div class="execution-card-action">
              <span class="action-badge">${action2Label}</span>
              ${action2.text}
            </div>
            ${currentActionIndex === 1 ? '<div class="action-status">← Current</div>' : ''}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render initiative tracker
   * @param {Array} turnOrder - Turn order array [{unit, type, initiative}]
   * @param {Number} currentIndex - Current turn index
   */
  renderInitiativeTracker(turnOrder, currentIndex) {
    const container = this.elements.initiativeList;
    if (!container) return;

    container.innerHTML = '';

    turnOrder.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = `initiative-item ${index === currentIndex ? 'active' : ''}`;

      item.innerHTML = `
        <span class="initiative-number">${entry.initiative}</span>
        <span class="initiative-name">${entry.unit.name || entry.unit.shortName}</span>
        <span class="initiative-type">${entry.type}</span>
      `;

      container.appendChild(item);
    });
  },

  /**
   * Update confirm button state
   * @param {Boolean} enabled - Whether button should be enabled
   */
  setConfirmButtonEnabled(enabled) {
    if (this.elements.confirmCards) {
      this.elements.confirmCards.disabled = !enabled;
    }
  },

  /**
   * Show/hide skip action button
   * @param {Boolean} show - Whether to show the button
   */
  showSkipButton(show) {
    if (this.elements.skipAction) {
      this.elements.skipAction.classList.toggle('hidden', !show);
    }
  },

  /**
   * Show/hide rest buttons
   * @param {Boolean} show - Whether to show rest options
   */
  showRestButtons(show) {
    if (this.elements.shortRest) {
      this.elements.shortRest.classList.toggle('hidden', !show);
    }
    if (this.elements.longRest) {
      this.elements.longRest.classList.toggle('hidden', !show);
    }
  },

  /**
   * Hide all action buttons except confirm
   */
  hideActionButtons() {
    this.showSkipButton(false);
    this.showRestButtons(false);
  },

  /**
   * Add message to combat log
   * @param {String} message - Message text
   * @param {String} type - Message type (attack, heal, move)
   */
  addLogMessage(message, type = '') {
    const logMessages = this.elements.logMessages;
    if (logMessages) {
      const msgEl = document.createElement('div');
      msgEl.className = `log-message ${type}`;
      msgEl.textContent = message;
      logMessages.insertBefore(msgEl, logMessages.firstChild);

      // Keep only last 50 messages
      while (logMessages.children.length > 50) {
        logMessages.removeChild(logMessages.lastChild);
      }
    }
  },

  /**
   * Clear combat log
   */
  clearLog() {
    if (this.elements.logMessages) {
      this.elements.logMessages.innerHTML = '';
    }
  },

  /**
   * Highlight a unit as selected
   * @param {String} unitId - Unit ID to highlight
   */
  highlightUnit(unitId) {
    // Remove existing highlights
    document.querySelectorAll('.unit-circle.selected').forEach(el => {
      el.classList.remove('selected');
    });

    // Add highlight to selected unit
    if (unitId) {
      const unitGroup = document.querySelector(`.unit-token[data-id="${unitId}"]`);
      if (unitGroup) {
        const circle = unitGroup.querySelector('.unit-circle');
        if (circle) circle.classList.add('selected');
      }
    }
  },
};
