import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';
import { applyTheme } from '../core/theme.js';

// The exact 5-token sets index.html's own static CSS was generated from
// (see that file's own comments on :root/body.light-theme) -- this is
// what "Restablecer" reverts to, and what a guest with no saved draft
// starts from. Kept here (not re-derived from the DOM) so resetting still
// works even if a user's own override has visibly changed these colors on
// the page already.
const DEFAULT_TOKENS = {
    dark: { base: '#262A2B', text: '#C9C8B6', accent: '#7D9B8B', success: '#10b981', danger: '#f87171' },
    light: { base: '#EDE4B7', text: '#31302E', accent: '#31302E', success: '#516247', danger: '#B91C1C' }
};

/**
 * ThemeBloc
 * Owns the 5 user-editable color tokens per mode (dark/light) --
 * everything else on the page is derived from these by js/core/theme.js's
 * deriveTheme(), which this bloc calls (via applyTheme()) every time they
 * change.
 *
 * Persistence is account-only, ON PURPOSE -- NOT the same shape as
 * FileSystemBloc's own local-draft-for-everyone pattern. A real reported
 * bug without this restriction: a signed-OUT guest's color edits were
 * surviving a full reload (even with the cache cleared), because the
 * first version of this bloc gave guests their own localStorage bucket
 * the same way FileSystemBloc does for projects. Explicit ask: colors
 * should only ever persist for someone with a signed-in account -- a
 * guest's edits still apply live for the rest of THIS session (via
 * applyCurrentMode() below), they just never get written anywhere, so a
 * reload (or opening the app fresh) always starts from the defaults
 * again. A signed-in account still gets both a local draft (namespaced by
 * uid, so it applies instantly on the next load without waiting on a
 * Firestore round-trip) AND the `theme` field on their own users/{uid}
 * document (a sibling of `project`/`playgroundProject`/`learnProgress`).
 */
export class ThemeBloc extends Bloc {
    constructor() {
        super();
        this.namespace = null;

        // No local draft read here -- this.namespace is null at this
        // point (guest), and readLocalDraft()/persistLocal() below are
        // both no-ops for a null namespace. A guest always starts from
        // the hardcoded defaults, every time, by design.
        this.applyCurrentMode();

        // Re-apply whenever the dark/light TOGGLE fires (a different mode
        // means different tokens), and mirror every change to localStorage
        // -- but only for a signed-in namespace, see persistLocal().
        globalEventBus.on('THEME_MODE_CHANGED', () => this.applyCurrentMode());
        this.subscribe(() => {
            this.persistLocal();
            this.applyCurrentMode();
        });
    }

    get initialState() {
        return { dark: { ...DEFAULT_TOKENS.dark }, light: { ...DEFAULT_TOKENS.light } };
    }

    localDraftKey() {
        return `apm32_theme_tokens_${this.namespace}`;
    }

    // Guests (this.namespace still null) never have a draft to read --
    // returning null here unconditionally is what makes the constructor
    // and the `!next` branch of setNamespace() below correctly fall back
    // to the plain defaults instead of reading some old bucket.
    readLocalDraft() {
        if (!this.namespace) return null;
        try {
            const raw = localStorage.getItem(this.localDraftKey());
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    // Guest edits are session-only -- this is the actual enforcement
    // point: no namespace, no write, no matter how many tokens get
    // changed in the meantime.
    persistLocal() {
        if (!this.namespace) return;
        try {
            localStorage.setItem(this.localDraftKey(), JSON.stringify(this.state));
        } catch {
            // Quota exceeded or unavailable -- same non-fatal treatment
            // FileSystemBloc's own persistLocal() gives this.
        }
    }

    // The page's actual dark/light state lives as a class on <body> (see
    // EditorUI.js), not in this bloc's own state -- reading it directly
    // here means this bloc never has to duplicate-track something another
    // class already owns, and can't drift from it.
    currentMode() {
        return document.body.classList.contains('light-theme') ? 'light' : 'dark';
    }

    applyCurrentMode() {
        applyTheme(this.state[this.currentMode()]);
        // EditorUI.js listens for this to rebuild Monaco's own theme --
        // Monaco can't read CSS custom properties, so its colors only
        // exist as whatever was last explicitly pushed into it. A real
        // reported bug without this: changing "Fondo" in the color editor
        // (ThemeEditorUI.js) visibly recolored the whole page EXCEPT the
        // code editor surface itself, which just kept whatever colors it
        // was initialized with.
        globalEventBus.emit('THEME_TOKENS_CHANGED');
    }

    setToken(mode, key, value) {
        this.emit({ [mode]: { ...this.state[mode], [key]: value } });
    }

    resetMode(mode) {
        this.emit({ [mode]: { ...DEFAULT_TOKENS[mode] } });
    }

    // Unlike FileSystemBloc.setNamespace(), going back to a null (signed-
    // out) namespace does NOT try to read a local draft first -- there
    // never is one for a guest (persistLocal() refuses to write for a
    // null namespace), so this always means "back to the hardcoded
    // defaults", full stop. Only a real uid gets its own local draft
    // checked, and even then it's just a faster-than-Firestore cache --
    // loadFromCloud() (called right after this, see app.js) is what
    // actually decides the account's saved theme once that resolves.
    setNamespace(namespace) {
        const next = namespace || null;
        if (this.namespace === next) return;
        this.namespace = next;

        const draft = this.readLocalDraft();
        if (draft) {
            this.emit({
                dark: { ...DEFAULT_TOKENS.dark, ...draft.dark },
                light: { ...DEFAULT_TOKENS.light, ...draft.light }
            });
        } else {
            this.emit({ dark: { ...DEFAULT_TOKENS.dark }, light: { ...DEFAULT_TOKENS.light } });
        }
    }

    async loadFromCloud(db, user) {
        if (!user) return;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            const theme = doc.exists ? doc.data().theme : null;
            if (theme) {
                this.emit({
                    dark: { ...DEFAULT_TOKENS.dark, ...theme.dark },
                    light: { ...DEFAULT_TOKENS.light, ...theme.light }
                });
            }
        } catch (error) {
            globalEventBus.emit('LOG', { message: 'Error loading theme: ' + error.message, type: 'error' });
        }
    }

    async saveToCloud(db, user) {
        if (!user) return;
        try {
            // mergeFields, not a bare {merge: true} -- exactly the
            // FileSystemBloc.saveProjectToCloud() fix from this same
            // project: a bare merge:true recurses INTO nested map fields
            // in real Firestore, so removing a key later wouldn't
            // actually remove it from the stored document. mergeFields
            // replaces `theme` wholesale (still leaving `project`/
            // `playgroundProject`/`learnProgress` untouched), which is
            // what this needs.
            // eslint-disable-next-line no-undef
            await db.collection('users').doc(user.uid).set({
                theme: { dark: this.state.dark, light: this.state.light }
            }, { mergeFields: ['theme'] });
        } catch (error) {
            globalEventBus.emit('LOG', { message: 'Error saving theme: ' + error.message, type: 'error' });
        }
    }
}
