import { globalEventBus } from '../core/EventBus.js';
import { toggleFlexVisible } from '../core/domUtils.js';

const DEBOUNCE_MS = 2500;

/**
 * AutoSaveUI
 * A checkbox next to "SAVE CLOUD" that, when on, saves to Firestore ~2.5s
 * after the user stops typing (debounced), reusing the same
 * FileSystemBloc.saveProjectToCloud() the manual button calls. Only shown
 * once logged in, since cloud save requires auth. Off by default -- it's
 * opt-in so it never silently overwrites a saved cloud project without the
 * user having asked for that behavior at least once.
 *
 * One instance per mode that has a FileSystemBloc (IDE, Playground -- Learn
 * has its own separate progress/draft sync, no FileSystemBloc involved).
 * `mode`/`modeBloc` matter because the Monaco editor instance is shared
 * across all three modes and fires the same EDITOR_CONTENT_CHANGED
 * regardless of which one is active: without the `modeBloc.state.mode ===
 * this.mode` guard in scheduleAutosave(), checking "Autosave to cloud"
 * while in IDE mode and then merely switching to Learn/Playground and
 * typing there would still fire *this* instance's save, overwriting the
 * IDE's cloud project with whatever the other mode's editor currently
 * holds -- a real bug found while wiring up the Playground instance.
 */
export class AutoSaveUI {
    constructor(authBloc, fsBloc, editorGetter, modeBloc, mode, ids) {
        this.authBloc = authBloc;
        this.fsBloc = fsBloc;
        this.getEditorContent = editorGetter;
        this.modeBloc = modeBloc;
        this.mode = mode;
        // IDE keeps the original unscoped key so nobody's already-set
        // preference gets silently forgotten by this change; Playground's
        // is new, so it gets its own name instead of sharing IDE's.
        this.storageKey = ids.storageKey;

        this.wrapper = document.getElementById(ids.wrapper);
        this.checkbox = document.getElementById(ids.checkbox);
        this.debounceTimer = null;

        if (this.checkbox) {
            this.checkbox.checked = localStorage.getItem(this.storageKey) === 'true';
            this.checkbox.onchange = () => {
                localStorage.setItem(this.storageKey, this.checkbox.checked ? 'true' : 'false');
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
        toggleFlexVisible(this.wrapper, !!state.user);
    }

    scheduleAutosave() {
        if (!this.checkbox || !this.checkbox.checked) return;
        if (this.modeBloc.state.mode !== this.mode) return;

        const { user, db } = this.authBloc.state;
        if (!user || !db) return;

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.fsBloc.saveProjectToCloud(db, user, this.getEditorContent());
        }, DEBOUNCE_MS);
    }
}
