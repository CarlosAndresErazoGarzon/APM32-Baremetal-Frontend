import { globalEventBus } from '../core/EventBus.js';

export class EditorUI {
    constructor(fsBloc, modeBloc, learnBloc, playgroundFsBloc = null) {
        this.fsBloc = fsBloc;
        this.modeBloc = modeBloc;
        this.learnBloc = learnBloc;
        this.playgroundFsBloc = playgroundFsBloc;
        this.editor = null;
        this.editorContainer = document.getElementById('editor');
        this.themeToggleBtn = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');

        // One declarative entry per mode instead of a render*()/onEdit
        // method pair and a lastRendered* field hand-written for each --
        // adding a mode later means adding one entry here, not touching
        // initEditor(), onModeChange() and renderMode() itself.
        //   getKey      -- identity of "what's loaded" (filename, exercise id...)
        //   getContent  -- the authoritative text for that key, from the bloc's state
        //   getLanguage -- Monaco language id for that key
        //   onEdit      -- called on every keystroke while this mode is active;
        //                  must write straight into the bloc synchronously (no
        //                  debounce) so getContent() never lags the live buffer --
        //                  see renderMode()'s contentChanged comment for why.
        this.modes = {
            ide: {
                bloc: fsBloc,
                getKey: s => s.currentFile,
                getContent: s => s.virtualFS[s.currentFile] || '',
                getLanguage: s => s.currentFile && s.currentFile.endsWith('.h') ? 'cpp' : 'c',
                onEdit: (content, s) => { if (s.currentFile) fsBloc.updateFileContent(s.currentFile, content); }
            },
            learn: {
                bloc: learnBloc,
                getKey: s => (s.currentTopicId && s.currentExerciseId)
                    ? `${s.currentTopicId}/${s.currentExerciseId}`
                    : (s.currentLevelId || null),
                getContent: s => s.code || '',
                getLanguage: () => 'c', // Learn levels are always plain host C
                // Direct mutation, no emit() -- nothing besides this UI needs
                // to know about every keystroke, so skip the notify/render
                // round-trip entirely instead of relying on renderMode()'s
                // reentrancy guard to no-op it.
                onEdit: (content) => { learnBloc.state.code = content; learnBloc.saveDraft(); }
            }
        };
        if (playgroundFsBloc) {
            this.modes.playground = {
                bloc: playgroundFsBloc,
                getKey: s => s.currentFile,
                getContent: s => s.virtualFS[s.currentFile] || '',
                getLanguage: s => s.currentFile && s.currentFile.endsWith('.h') ? 'cpp' : 'c',
                onEdit: (content, s) => { if (s.currentFile) playgroundFsBloc.updateFileContent(s.currentFile, content); }
            };
        }
        // "What's currently loaded" per mode, and a reentrancy guard per
        // mode -- keyed by mode name instead of one field/flag per mode.
        this.lastRendered = {};
        this._renderGuards = {};

        // The page's actual theming is driven by a single `light-theme` class on
        // <body> (see the CSS custom properties in index.html: --sidebar-bg,
        // --border-color, etc. are all redefined under `body.light-theme`).
        this.isDark = localStorage.getItem('theme') !== 'light';

        this.initEventListeners();
        // Sync the DOM/icon to the stored preference immediately, before Monaco
        // has even loaded, so there's no dark->light flash on page load.
        this.applyTheme();
    }

    initEditor() {
        if (!this.editorContainer || typeof monaco === 'undefined') return;

        // Sage/olive dark palette. Monaco can't consume CSS variables
        // directly, so these are index.html's :root tokens copied in by
        // hand -- keep them in sync if that palette changes.
        monaco.editor.defineTheme('mhrd-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { background: '262A2B', foreground: 'C9C8B6' },
                { token: 'comment', foreground: '8E948D', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'ff7b72', fontStyle: 'bold' },
                { token: 'string', foreground: 'a5d6ff' },
                { token: 'number', foreground: '79c0ff' },
                { token: 'type', foreground: '7D9B8B', fontStyle: 'bold' },
                { token: 'identifier', foreground: 'E2E0CF' },
                { token: 'delimiter', foreground: 'C9C8B6' }
            ],
            colors: {
                'editor.background': '#262A2B',
                'editor.foreground': '#C9C8B6',
                'editor.lineHighlightBackground': '#2F3B36',
                'editorLineNumber.foreground': '#8E948D',
                'editorLineNumber.activeForeground': '#E2E0CF',
                'editorGutter.background': '#262A2B',
                'editorIndentGuide.background': '#2F3B36',
                'editorIndentGuide.activeBackground': '#353B3D',
                'editorCursor.foreground': '#7D9B8B',
                'editor.selectionBackground': '#353B3D',
                'editor.inactiveSelectionBackground': '#2F3B36',
                'editor.selectionHighlightBackground': '#2F3B36',
                'editorWhitespace.foreground': '#353B3D'
            }
        });

        // Same structure, light -- matching the warm gold/sand palette tokens.
        monaco.editor.defineTheme('mhrd-light', {
            base: 'vs',
            inherit: true,
            rules: [
                { background: 'EDE4B7', foreground: '31302E' },
                { token: 'comment', foreground: '666157', fontStyle: 'italic' },
                { token: 'keyword', foreground: '8B2626', fontStyle: 'bold' },
                { token: 'string', foreground: '40584B' },
                { token: 'number', foreground: '7A4D1D' },
                { token: 'type', foreground: '232220', fontStyle: 'bold' }
            ],
            colors: {
                'editor.background': '#EDE4B7',
                'editor.foreground': '#31302E',
                'editor.lineHighlightBackground': '#E5DBAA',
                'editorLineNumber.foreground': '#8A8375',
                'editorLineNumber.activeForeground': '#232220',
                'editorGutter.background': '#EDE4B7',
                'editorIndentGuide.background': '#E5DBAA',
                'editorIndentGuide.activeBackground': '#C8BE93',
                'editorCursor.foreground': '#31302E',
                'editor.selectionBackground': '#F5EFCF',
                'editor.inactiveSelectionBackground': '#E5DBAA',
                'editor.selectionHighlightBackground': '#E5DBAA',
                'editorWhitespace.foreground': '#C8BE93'
            }
        });

        this.editor = monaco.editor.create(this.editorContainer, {
            value: '',
            language: 'c',
            theme: this.isDark ? 'mhrd-dark' : 'mhrd-light',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontFamily: "'Inconsolata', 'Menlo', 'Courier New', monospace",
            fontSize: 14.5,
            lineHeight: 23,
            padding: { top: 10, bottom: 10 }
        });

        this.editor.onDidChangeModelContent(() => {
            // Push every keystroke into the active mode's bloc immediately --
            // no debounce. This is what makes each mode's getContent() always
            // agree with the live buffer for the currently-loaded key, which
            // is what renderMode()'s contentChanged check relies on to tell
            // "external change" apart from "my own unsynced typing". A
            // debounced version of this used to live in app.js and was the
            // actual cause of a reported bug: any unrelated bloc emit that
            // landed inside that debounce's window (e.g. deleting a
            // different file) made renderMode() see the live buffer and the
            // bloc disagree and "self-heal" the editor, silently discarding
            // whatever had just been typed.
            const cfg = this.modes[this.modeBloc.state.mode];
            if (cfg) cfg.onEdit(this.editor.getValue(), cfg.bloc.state);
            globalEventBus.emit('EDITOR_CONTENT_CHANGED');
        });

        // The only consumer of COMPILER_ERRORS in the whole app -- both
        // CompilerBloc (ARM firmware) and LearnBloc (host C grading) emit the
        // same { markers } shape from the same gccErrorParser, so one listener
        // covers both.
        globalEventBus.on('COMPILER_ERRORS', ({ markers }) => this.applyMarkers(markers));

        // Subscribe every mode's bloc to the one generic renderer. Bloc's own
        // subscribe() calls back immediately with the current state, and
        // renderMode()'s own `modeBloc.state.mode !== modeName` guard makes
        // only the initially-active mode actually render anything from that.
        Object.entries(this.modes).forEach(([name, cfg]) => {
            cfg.bloc.subscribe(state => this.renderMode(name, state));
        });
        // On a mode switch, force whichever side is becoming active to reload
        // its content into the editor (the editor currently holds the OTHER
        // mode's text) by marking its "last shown" as stale.
        this.modeBloc.subscribe(this.onModeChange.bind(this));
    }

    initEventListeners() {
        if (this.themeToggleBtn) {
            this.themeToggleBtn.onclick = () => {
                this.isDark = !this.isDark;
                localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
                this.applyTheme();
            };
        }
    }

    applyTheme() {
        document.body.classList.toggle('light-theme', !this.isDark);

        // Monaco Theme
        if (this.editor) {
            monaco.editor.setTheme(this.isDark ? 'mhrd-dark' : 'mhrd-light');
        }

        // Theme toggle is now a plain [Dark]/[Light] text label (see
        // index.html's sidebar footer), not an icon swap -- matches the
        // all-text-labels MHRD reference instead of an SVG glyph.
        if (this.themeIcon) {
            this.themeIcon.textContent = this.isDark ? 'Dark' : 'Light';
        }
    }

    onModeChange(modeState) {
        if (!this.editor) return;
        const cfg = this.modes[modeState.mode];
        if (!cfg) return;

        // Force a fresh reload on whichever side is becoming active -- the
        // editor currently holds one of the OTHER modes' text, so the
        // key-vs-content comparison in renderMode() would otherwise see a
        // "content changed" false-positive against a key that never
        // actually changed for this mode.
        this.lastRendered[modeState.mode] = null;
        this.renderMode(modeState.mode, cfg.bloc.state);
    }

    // Single renderer shared by every mode in `this.modes` (see the
    // constructor). Each mode only differs in how it reads its key/content/
    // language and what a keystroke does to its bloc -- everything else
    // (the reentrancy guard, the reload logic) is identical, so it lives
    // here once instead of once per mode.
    renderMode(modeName, state) {
        if (!this.editor || this.modeBloc.state.mode !== modeName) return;
        const cfg = this.modes[modeName];
        if (!cfg || this._renderGuards[modeName]) return; // guard against re-entrant calls
        this._renderGuards[modeName] = true;

        try {
            const key = cfg.getKey(state);
            const keyChanged = this.lastRendered[modeName] !== key;
            const liveContent = cfg.getContent(state);
            // Same key, but the content behind it changed underneath us --
            // e.g. loadProjectFromCloud() landing on a project whose first
            // file happens to share the CURRENTLY DISPLAYED file's name.
            // This can only mean a genuine external write: onDidChangeModelContent
            // pushes every keystroke straight into the bloc synchronously
            // (see initEditor()), so the bloc's own content never lags the
            // live buffer as a side effect of the student's own typing.
            const contentChanged = !keyChanged && key && this.editor.getValue() !== liveContent;

            if (key && (keyChanged || contentChanged)) {
                this.editor.setValue(liveContent);
                monaco.editor.setModelLanguage(this.editor.getModel(), cfg.getLanguage(state));
                this.applyMarkers([]); // clear any old compiler markers
                this.lastRendered[modeName] = key;
            }
        } finally {
            this._renderGuards[modeName] = false;
        }
    }

    applyMarkers(markers) {
        if (!this.editor) return;
        const monacoMarkers = (markers || []).map(m => ({
            startLineNumber: m.line,
            startColumn: m.column,
            endLineNumber: m.line,
            endColumn: m.column + 1,
            severity: m.severity,
            message: m.message
        }));
        monaco.editor.setModelMarkers(this.editor.getModel(), 'compiler', monacoMarkers);
    }

    getContent() {
        return this.editor ? this.editor.getValue() : '';
    }

    // Monaco doesn't always notice its container was display:none and came
    // back -- automaticLayout's own ResizeObserver can miss that transition.
    // Called by CodeTheoryTabsUI after un-hiding the editor container.
    layout() {
        if (this.editor) this.editor.layout();
    }
}
