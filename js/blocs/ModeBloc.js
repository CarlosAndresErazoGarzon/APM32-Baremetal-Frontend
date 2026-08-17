import { Bloc } from '../core/Bloc.js';

const STORAGE_KEY = 'apm32_mode';

/**
 * ModeBloc
 * Single source of truth for whether the app is showing the IDE (flash
 * firmware to real hardware) or Learn (pick a level, write host C, get
 * graded) experience. Several existing UI classes (EditorUI, TerminalUI)
 * need to react to this, which is why it's a Bloc like everything else
 * shared across components, not a local flag on one class.
 */
export class ModeBloc extends Bloc {
    get initialState() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return { mode: stored === 'learn' ? 'learn' : 'ide' };
    }

    setMode(mode) {
        if (mode !== 'ide' && mode !== 'learn') return;
        if (mode === this.state.mode) return;
        localStorage.setItem(STORAGE_KEY, mode);
        this.emit({ mode });
    }
}
