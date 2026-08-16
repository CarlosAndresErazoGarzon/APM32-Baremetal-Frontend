/**
 * Bloc.js
 * Base class for Business Logic Components.
 * Subclasses should define initial state and handle specific business logic.
 */
export class Bloc {
    constructor() {
        this._state = this.initialState;
        this._listeners = [];
    }

    get initialState() {
        return {}; // Override in subclass
    }

    get state() {
        return this._state;
    }

    /**
     * Update state and notify listeners.
     * @param {Object} newState - Partial or full state object to merge.
     */
    emit(newState) {
        this._state = { ...this._state, ...newState };
        this._notifyListeners();
    }

    /**
     * Subscribe to state changes.
     * @param {Function} callback - Called whenever the state changes.
     * @returns {Function} - Unsubscribe function.
     */
    subscribe(callback) {
        this._listeners.push(callback);
        // Emit current state immediately to synchronize the UI
        callback(this._state);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }

    _notifyListeners() {
        this._listeners.forEach(cb => cb(this._state));
    }
}
