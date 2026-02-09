/**
 * UI rendering and DOM manipulation - Core
 */

const UI = {
  // DOM element references
  elements: {},

  // Hex size for rendering
  hexSize: CONSTANTS.HEX.SIZE,

  // SVG namespace
  svgNS: CONSTANTS.SVG.NAMESPACE,

  // Grid offset for centering
  gridOffset: { x: CONSTANTS.GRID.OFFSET.x, y: CONSTANTS.GRID.OFFSET.y },

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

    // Initialize panel toggle buttons
    this.initPanelToggles();
  },

  /**
   * Initialize floating panel toggle functionality
   */
  initPanelToggles() {
    document.querySelectorAll('.panel-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const panel = btn.closest('.floating-panel');
        panel.classList.toggle('minimized');
        btn.textContent = panel.classList.contains('minimized') ? '+' : '−';
      });
    });

    // Also allow clicking header to toggle
    document.querySelectorAll('.panel-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.classList.contains('panel-toggle')) return;
        const panel = header.closest('.floating-panel');
        const btn = header.querySelector('.panel-toggle');
        panel.classList.toggle('minimized');
        btn.textContent = panel.classList.contains('minimized') ? '+' : '−';
      });
    });
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
      while (logMessages.children.length > CONSTANTS.LIMITS.MAX_LOG_MESSAGES) {
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
};
