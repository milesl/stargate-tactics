/**
 * UI rendering - Cards, portraits, and initiative tracker
 */

Object.assign(UI, {
  /**
   * Generate tooltip text for a card action
   */
  getActionTooltip(action) {
    const tips = [];

    switch (action.type) {
      case CONSTANTS.ACTION_TYPES.MOVE:
        tips.push(`Move up to ${action.value} hexes`);
        break;
      case CONSTANTS.ACTION_TYPES.ATTACK:
        tips.push(`Deal ${action.value} damage`);
        if (action.range > 1) tips.push(`Range: ${action.range} hexes`);
        if (action.aoe) tips.push('Area of Effect: hits adjacent enemies');
        if (action.push) tips.push(`Push: knock target back ${action.push} hex(es)`);
        if (action.stun) tips.push('Stun: target skips next turn');
        break;
      case CONSTANTS.ACTION_TYPES.HEAL:
        tips.push(`Restore ${action.value} health`);
        if (action.aoe) tips.push('Affects all allies');
        if (action.range > 0) tips.push(`Range: ${action.range} hexes`);
        break;
      case CONSTANTS.ACTION_TYPES.SHIELD:
        tips.push(`Grant ${action.value} temporary shield`);
        tips.push('Shield absorbs damage until end of round');
        break;
      case CONSTANTS.ACTION_TYPES.PUSH:
        tips.push(`Push enemy ${action.value} hexes away`);
        tips.push('Blocked by walls and other units');
        break;
      case CONSTANTS.ACTION_TYPES.BUFF:
        tips.push('Applies a beneficial effect');
        break;
      case CONSTANTS.ACTION_TYPES.SPECIAL:
        tips.push('Special ability');
        break;
      case CONSTANTS.ACTION_TYPES.TRAP:
        tips.push('Place a trap on the battlefield');
        break;
    }

    return tips.join(' • ');
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
      const healthClass = healthPercent <= CONSTANTS.UI.LOW_HEALTH_THRESHOLD ? 'low' : '';

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
      this.elements.roomProgress.textContent = `Room ${roomNumber}/${CONSTANTS.GAME.TOTAL_ROOMS}`;
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
      const needsRest = character.hand.length < 2 && !character.resting;
      const isResting = character.resting;

      let classes = 'character-tab';
      if (isActive) classes += ' active';
      if (isReady) classes += ' ready';
      if (needsRest) classes += ' needs-rest';
      if (isResting) classes += ' resting';

      tab.className = classes;
      tab.textContent = isResting ? `${character.shortName} (Resting)` : character.shortName;
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
      const isDisabled = character.hand.length <= CONSTANTS.GAME.CARDS_TO_PLAY && !isSelected;

      const cardEl = document.createElement('div');
      cardEl.className = `card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
      cardEl.dataset.id = card.id;

      let selectionIndicator = '';
      let topWillUse = '';
      let bottomWillUse = '';

      if (isCardA) {
        selectionIndicator = `<div class="card-selection">Card A (using ${selectedCards.useTopOfA ? 'TOP' : 'BOTTOM'})</div>`;
        topWillUse = selectedCards.useTopOfA ? 'will-use' : '';
        bottomWillUse = selectedCards.useTopOfA ? '' : 'will-use';
      } else if (isCardB) {
        selectionIndicator = `<div class="card-selection">Card B (using ${selectedCards.useTopOfA ? 'BOTTOM' : 'TOP'})</div>`;
        topWillUse = selectedCards.useTopOfA ? '' : 'will-use';
        bottomWillUse = selectedCards.useTopOfA ? 'will-use' : '';
      }

      const topTooltip = this.getActionTooltip(card.top);
      const bottomTooltip = this.getActionTooltip(card.bottom);

      cardEl.innerHTML = `
        <div class="card-header">
          <span class="card-name">${card.name}</span>
          <span class="card-initiative" title="Initiative: Lower goes first">${card.initiative}</span>
        </div>
        <div class="card-action top-action ${topWillUse}" title="${topTooltip}">
          <div class="action-label top-label">TOP</div>
          <div class="action-text">${card.top.text}</div>
        </div>
        <div class="card-divider"></div>
        <div class="card-action bottom-action ${bottomWillUse}" title="${bottomTooltip}">
          <div class="action-label bottom-label">BOTTOM</div>
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
});
