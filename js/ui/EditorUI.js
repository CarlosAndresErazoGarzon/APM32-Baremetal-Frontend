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

        // Internal state trackers to avoid infinite loops on update -- one per
        // mode, since IDE/Learn/Playground each track "what's currently
        // loaded" independently of each other.
        this.lastRenderedFile = null;
        this.lastRenderedLevelId = null;
        this.lastRenderedPlaygroundFile = null;

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
            if (this.modeBloc.state.mode === 'learn') {
                // Direct mutation, no emit() -- same anti-render-loop pattern
                // used for the IDE's virtualFS below.
                this.learnBloc.state.code = this.editor.getValue();
                this.learnBloc.saveDraft();
            }
            globalEventBus.emit('EDITOR_CONTENT_CHANGED');
        });

        // The only consumer of COMPILER_ERRORS in the whole app -- both
        // CompilerBloc (ARM firmware) and LearnBloc (host C grading) emit the
        // same { markers } shape from the same gccErrorParser, so one listener
        // covers both.
        globalEventBus.on('COMPILER_ERRORS', ({ markers }) => this.applyMarkers(markers));

        // Subscribe to FileSystem changes to update editor content
        this.fsBloc.subscribe(this.render.bind(this));
        this.learnBloc.subscribe(this.renderLearn.bind(this));
        if (this.playgroundFsBloc) {
            this.playgroundFsBloc.subscribe(this.renderPlayground.bind(this));
        }
        // On a mode switch, force whichever side is becoming active to reload
        // its content into the editor (the editor currently holds the OTHER
        // mode's text) and mark the other sides' "last shown" as stale so
        // they don't try to write that leftover text back into their own
        // state.
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

        // Force a fresh reload on whichever side is becoming active (the
        // editor currently holds one of the OTHER two modes' text) and mark
        // the other two's "last shown" as stale so they don't mistake this
        // leftover text for their own and write it back into their state.
        if (modeState.mode === 'ide') {
            this.lastRenderedFile = null;
            this.render(this.fsBloc.state);
        } else if (modeState.mode === 'learn') {
            this.lastRenderedLevelId = null;
            this.renderLearn(this.learnBloc.state);
        } else if (modeState.mode === 'playground' && this.playgroundFsBloc) {
            this.lastRenderedPlaygroundFile = null;
            this.renderPlayground(this.playgroundFsBloc.state);
        }
    }

    render(state) {
        if (!this.editor || this.modeBloc.state.mode !== 'ide') return;
        // Guard against re-entrant calls (prevents infinite loops)
        if (this._isRendering) return;
        this._isRendering = true;

        try {
            const fileChanged = this.lastRenderedFile !== state.currentFile;
            // Same filename, but the content behind it changed underneath
            // us (loadProjectFromCloud() landing on a project whose first
            // file happens to share the CURRENTLY DISPLAYED file's name,
            // e.g. both "main.c" -- fileChanged alone would stay false and
            // silently leave the stale seed content on screen). Mirrors
            // renderLearn()'s own codeChanged check below.
            const contentChanged = !fileChanged && state.currentFile &&
                this.editor.getValue() !== (state.virtualFS[state.currentFile] || '');

            // Save current editor content to FS before switching files
            // IMPORTANT: We write directly to state.virtualFS WITHOUT calling emit()
            // to avoid triggering another render cycle (which would cause stack overflow).
            if (fileChanged && this.lastRenderedFile && state.virtualFS[this.lastRenderedFile] !== undefined) {
                state.virtualFS[this.lastRenderedFile] = this.editor.getValue();
            }

            // Load the new file content into the editor
            if ((fileChanged || contentChanged) && state.currentFile) {
                const content = state.virtualFS[state.currentFile] || '';
                this.editor.setValue(content);

                const isHeader = state.currentFile.endsWith('.h');
                monaco.editor.setModelLanguage(this.editor.getModel(), isHeader ? 'cpp' : 'c');

                // Clear any old compiler markers
                this.applyMarkers([]);

                this.lastRenderedFile = state.currentFile;
            }
        } finally {
            this._isRendering = false;
        }
    }

    // Mirrors render() exactly (same virtualFS/currentFile state shape,
    // since PlaygroundBloc's FileSystemBloc instance is the same class) --
    // kept as its own method rather than parameterizing render() itself, to
    // match the existing render()/renderLearn() pair instead of inventing a
    // third pattern.
    renderPlayground(state) {
        if (!this.editor || this.modeBloc.state.mode !== 'playground') return;
        if (this._isRenderingPlayground) return;
        this._isRenderingPlayground = true;

        try {
            const fileChanged = this.lastRenderedPlaygroundFile !== state.currentFile;
            // Same reasoning as render()'s own contentChanged -- a
            // loadProjectFromCloud() landing on a project whose first file
            // is also named "main.c" (Playground's own seed default, so
            // this is the COMMON case here, not an edge case) would
            // otherwise leave the stale seed content on screen since the
            // filename itself never changes.
            const contentChanged = !fileChanged && state.currentFile &&
                this.editor.getValue() !== (state.virtualFS[state.currentFile] || '');

            if (fileChanged && this.lastRenderedPlaygroundFile && state.virtualFS[this.lastRenderedPlaygroundFile] !== undefined) {
                state.virtualFS[this.lastRenderedPlaygroundFile] = this.editor.getValue();
            }

            if ((fileChanged || contentChanged) && state.currentFile) {
                const content = state.virtualFS[state.currentFile] || '';
                this.editor.setValue(content);

                const isHeader = state.currentFile.endsWith('.h');
                monaco.editor.setModelLanguage(this.editor.getModel(), isHeader ? 'cpp' : 'c');

                this.applyMarkers([]);

                this.lastRenderedPlaygroundFile = state.currentFile;
            }
        } finally {
            this._isRenderingPlayground = false;
        }
    }

    renderLearn(state) {
        if (!this.editor || this.modeBloc.state.mode !== 'learn') return;
        if (this._isRenderingLearn) return;
        this._isRenderingLearn = true;

        try {
            const currentKey = state.currentTopicId && state.currentExerciseId
                ? `${state.currentTopicId}/${state.currentExerciseId}`
                : (state.currentLevelId || null);

            const levelChanged = this.lastRenderedLevelId !== currentKey;
            const codeChanged = this.editor.getValue() !== (state.code || '');

            if (currentKey && (levelChanged || codeChanged)) {
                this.editor.setValue(state.code || '');
                monaco.editor.setModelLanguage(this.editor.getModel(), 'c'); // Learn levels are always plain host C
                this.applyMarkers([]);
                this.lastRenderedLevelId = currentKey;
            }
        } finally {
            this._isRenderingLearn = false;
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
