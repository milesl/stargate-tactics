/**
 * Attack Modifier Deck - Gloomhaven-style modifier cards
 * Adds variance to combat by drawing a modifier each attack.
 */

const ModifierDeck = {
  /**
   * Create the standard 20-card modifier deck
   * 6x +0, 5x +1, 5x -1, 1x +2, 1x -2, 1x x2, 1x null
   */
  createStandardDeck() {
    const cards = [];

    // 6x +0
    for (let i = 0; i < 6; i++) {
      cards.push({ value: 0, type: 'add', label: '+0' });
    }
    // 5x +1
    for (let i = 0; i < 5; i++) {
      cards.push({ value: 1, type: 'add', label: '+1' });
    }
    // 5x -1
    for (let i = 0; i < 5; i++) {
      cards.push({ value: -1, type: 'add', label: '-1' });
    }
    // 1x +2
    cards.push({ value: 2, type: 'add', label: '+2' });
    // 1x -2
    cards.push({ value: -2, type: 'add', label: '-2' });
    // 1x x2 (critical)
    cards.push({ value: 2, type: 'multiply', label: 'x2' });
    // 1x null (miss)
    cards.push({ value: 0, type: 'null', label: 'MISS' });

    return cards;
  },

  /**
   * Create a character-specific modifier deck
   */
  createCharacterDeck(characterId) {
    const deck = this.createStandardDeck();

    switch (characterId) {
      case CONSTANTS.CHARACTER_IDS.JACK:
        // Replace 2x -1 with +1 (7x +1, 3x -1)
        this._replaceCards(deck, -1, 'add', 1, 'add', 2);
        break;

      case CONSTANTS.CHARACTER_IDS.SAM:
        // Replace 3x -1 with +0 (9x +0, 2x -1)
        this._replaceCards(deck, -1, 'add', 0, 'add', 3);
        break;

      case CONSTANTS.CHARACTER_IDS.DANIEL:
        // Add extra +2 and -2, remove 2x +0 (4x +0, 2x +2, 2x -2)
        this._replaceCards(deck, 0, 'add', 2, 'add', 1);
        this._replaceCards(deck, 0, 'add', -2, 'add', 1);
        break;

      case CONSTANTS.CHARACTER_IDS.TEALC:
        // Replace 2x -1 with +1, and 1x +0 with +2 (7x +1, 2x +2, 3x -1, 5x +0)
        this._replaceCards(deck, -1, 'add', 1, 'add', 2);
        this._replaceCards(deck, 0, 'add', 2, 'add', 1);
        break;
    }

    return deck;
  },

  /**
   * Create the monster modifier deck (standard 20)
   */
  createMonsterDeck() {
    return this.createStandardDeck();
  },

  /**
   * Replace N cards matching oldValue/oldType with newValue/newType
   */
  _replaceCards(deck, oldValue, oldType, newValue, newType, count) {
    let replaced = 0;
    for (let i = 0; i < deck.length && replaced < count; i++) {
      if (deck[i].value === oldValue && deck[i].type === oldType) {
        const label = newValue >= 0 ? `+${newValue}` : `${newValue}`;
        deck[i] = { value: newValue, type: newType, label };
        replaced++;
      }
    }
  },

  /**
   * Fisher-Yates shuffle (returns new array)
   */
  shuffle(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * Draw from a deck state object, returns the drawn modifier
   * Mutates deckState.remaining
   */
  draw(deckState) {
    if (deckState.remaining.length === 0) {
      deckState.remaining = this.shuffle(deckState.cards);
      deckState.needsReshuffle = false;
    }

    const modifier = deckState.remaining.pop();

    // x2 and null trigger reshuffle on next draw
    if (modifier.type === 'multiply' || modifier.type === 'null') {
      deckState.needsReshuffle = true;
    }

    return modifier;
  },
};
