import { Bloc } from '../core/Bloc.js';

const STORAGE_KEY = 'apm32_mode';
const VALID_MODES = ['ide', 'learn', 'playground'];

/**
 * ModeBloc
 * Single source of truth for which top-level experience the app is
 * showing: IDE (flash firmware to real hardware), Learn (pick a level,
 * write host C, get graded), or Playground (freeform multi-file host C,
 * compile+run, no curriculum). Several existing UI classes (EditorUI,
 * TerminalUI) need to react to this, which is why it's a Bloc like
 * everything else shared across components, not a local flag on one class.
 */
export class ModeBloc extends Bloc {
    get initialState() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return { mode: VALID_MODES.includes(stored) ? stored : 'ide' };
    }

    setMode(mode) {
        if (!VALID_MODES.includes(mode)) return;
        if (mode === this.state.mode) return;
        localStorage.setItem(STORAGE_KEY, mode);
        this.emit({ mode });
    }
}
