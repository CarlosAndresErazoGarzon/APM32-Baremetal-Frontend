import { globalEventBus } from '../core/EventBus.js';

const STORAGE_KEY = 'apm32_autosave_enabled';
const DEBOUNCE_MS = 2500;

/**
 * AutoSaveUI
 * A checkbox next to "SAVE CLOUD" that, when on, saves to Firestore ~2.5s
 * after the user stops typing (debounced), reusing the same
 * FileSystemBloc.saveProjectToCloud() the manual button calls. Only shown
 * once logged in, since cloud save requires auth. Off by default -- it's
 * opt-in so it never silently overwrites a saved cloud project without the
 * user having asked for that behavior at least once.
 */
export class AutoSaveUI {
    constructor(authBloc, fsBloc, editorGetter) {
        this.authBloc = authBloc;
        this.fsBloc = fsBloc;
        this.getEditorContent = editorGetter;

        this.wrapper = document.getElementById('autoSaveWrapper');
        this.checkbox = document.getElementById('autoSaveToggle');
        this.debounceTimer = null;

        if (this.checkbox) {
            this.checkbox.checked = localStorage.getItem(STORAGE_KEY) === 'true';
            this.checkbox.onchange = () => {
                localStorage.setItem(STORAGE_KEY, this.checkbox.checked ? 'true' : 'false');
                globalEventBus.emit('LOG', {
                    message: `Autosave to cloud ${this.checkbox.checked ? 'enabled' : 'disabled'}.`,
                    type: 'info'
                });
            };
        }

        this.authBloc.subscribe(this.render.bind(this));
        globalEventBus.on('EDITOR_CONTENT_CHANGED', () => this.scheduleAutosave());
    }

    render(state) {
        if (!this.wrapper) return;
        // 'flex'/'hidden' toggled together -- see TerminalUI's toggleFlexVisible
        // for why these two need to move as a pair rather than just 'hidden'.
        const show = !!state.user;
        this.wrapper.classList.toggle('hidden', !show);
        this.wrapper.classList.toggle('flex', show);
    }

    scheduleAutosave() {
        if (!this.checkbox || !this.checkbox.checked) return;

        const { user, db } = this.authBloc.state;
        if (!user || !db) return;

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.fsBloc.saveProjectToCloud(db, user, this.getEditorContent());
        }, DEBOUNCE_MS);
    }
}
