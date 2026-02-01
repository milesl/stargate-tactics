/**
 * Simple reactive state management
 * Provides Pinia-like functionality without the framework
 */

class Store {
  constructor(initialState) {
    this._state = initialState;
    this._listeners = [];
    this._history = [];
    this._maxHistory = 50;
  }

  /**
   * Get current state (read-only)
   */
  get state() {
    return this._state;
  }

  /**
   * Update state and notify listeners
   * Usage: store.setState({ enemies: newEnemies })
   */
  setState(updates) {
    // Save to history for undo functionality (future feature)
    this._history.push(JSON.parse(JSON.stringify(this._state)));
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Merge updates into state
    this._state = this._deepMerge(this._state, updates);

    // Notify all listeners
    this._notify();
  }

  /**
   * Subscribe to state changes
   * Usage: store.subscribe((state) => { console.log(state); })
   */
  subscribe(listener) {
    this._listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  _notify() {
    this._listeners.forEach(listener => {
      listener(this._state);
    });
  }

  /**
   * Deep merge objects (handles nested updates)
   */
  _deepMerge(target, source) {
    const output = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }

    return output;
  }

  /**
   * Reset state to initial value
   */
  reset(newState) {
    this._state = newState;
    this._history = [];
    this._notify();
  }

  /**
   * Get previous state (for undo)
   */
  undo() {
    if (this._history.length === 0) return false;

    this._state = this._history.pop();
    this._notify();
    return true;
  }
}

/**
 * Create a store with actions (Pinia-like)
 */
function createStore(config) {
  const store = new Store(config.state());

  // Bind actions to store
  const actions = {};
  for (const [name, fn] of Object.entries(config.actions || {})) {
    actions[name] = (...args) => {
      return fn.call({
        state: store.state,
        setState: (updates) => store.setState(updates),
      }, ...args);
    };
  }

  // Bind getters to store
  const getters = {};
  for (const [name, fn] of Object.entries(config.getters || {})) {
    Object.defineProperty(getters, name, {
      get: () => fn(store.state),
    });
  }

  return {
    get state() { return store.state; },
    setState: (updates) => store.setState(updates),
    subscribe: (listener) => store.subscribe(listener),
    reset: (newState) => store.reset(newState),
    undo: () => store.undo(),
    ...actions,
    getters,
  };
}
