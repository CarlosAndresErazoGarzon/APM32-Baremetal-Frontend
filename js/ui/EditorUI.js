import { globalEventBus } from '../core/EventBus.js';

export class EditorUI {
    constructor(fsBloc, modeBloc, learnBloc) {
        this.fsBloc = fsBloc;
        this.modeBloc = modeBloc;
        this.learnBloc = learnBloc;
        this.editor = null;
        this.editorContainer = document.getElementById('editor');
        this.themeToggleBtn = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');

        // Internal state trackers to avoid infinite loops on update -- one per
        // mode, since IDE and Learn each track "what's currently loaded"
        // independently of each other.
        this.lastRenderedFile = null;
        this.lastRenderedLevelId = null;

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

        // Gold-luxury palette (restored), dark. Monaco can't consume CSS
        // variables directly, so these are index.html's :root tokens
        // copied in by hand -- keep them in sync if that palette changes.
        monaco.editor.defineTheme('mhrd-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { background: '1c1c1e', foreground: 'c9c5b8' },
                { token: 'comment', foreground: '8a877d', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'ff7b72', fontStyle: 'bold' },
                { token: 'string', foreground: 'a5d6ff' },
                { token: 'number', foreground: '79c0ff' },
                { token: 'type', foreground: 'c9c5b8' }
            ],
            colors: {
                'editor.background': '#1c1c1e',
                'editor.foreground': '#c9c5b8',
                'editor.lineHighlightBackground': '#333335',
                'editorLineNumber.foreground': '#8a877d',
                'editorLineNumber.activeForeground': '#c9c5b8',
                'editorGutter.background': '#1c1c1e',
                'editorIndentGuide.background': '#333335',
                'editorIndentGuide.activeBackground': '#4a4a4d',
                'editorCursor.foreground': '#ffdb89',
                'editor.selectionBackground': '#4a4a4d',
                'editor.inactiveSelectionBackground': '#333335',
                'editor.selectionHighlightBackground': '#333335',
                'editorWhitespace.foreground': '#4a4a4d'
            }
        });

        // Same palette, light -- same reasoning as dark. Syntax colors
        // (keyword/string/number) intentionally stay off the gold/gray
        // sheet, matching GitHub's real code-view highlighting.
        monaco.editor.defineTheme('mhrd-light', {
            base: 'vs',
            inherit: true,
            rules: [
                { background: 'faf6ec', foreground: '2c2c2e' },
                { token: 'comment', foreground: '6b6a5f', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'cf222e', fontStyle: 'bold' },
                { token: 'string', foreground: '0a3069' },
                { token: 'number', foreground: '0550ae' },
                { token: 'type', foreground: '2c2c2e' }
            ],
            colors: {
                'editor.background': '#faf6ec',
                'editor.foreground': '#2c2c2e',
                'editor.lineHighlightBackground': '#f2ecd9',
                'editorLineNumber.foreground': '#b8923f',
                'editorLineNumber.activeForeground': '#2c2c2e',
                'editorGutter.background': '#faf6ec',
                'editorIndentGuide.background': '#f2ecd9',
                'editorIndentGuide.activeBackground': '#ddd0a8',
                'editorCursor.foreground': '#8a6318',
                'editor.selectionBackground': '#f2ecd9',
                'editor.inactiveSelectionBackground': '#f2ecd9',
                'editor.selectionHighlightBackground': '#f2ecd9',
                'editorWhitespace.foreground': '#ddd0a8'
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
        // On a mode switch, force whichever side is becoming active to reload
        // its content into the editor (the editor currently holds the OTHER
        // mode's text) and mark the other side's "last shown" as stale so it
        // doesn't try to write that leftover text back into its own state.
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

        if (modeState.mode === 'ide') {
            this.lastRenderedFile = null; // force a fresh reload, editor currently holds Learn-mode code
            this.render(this.fsBloc.state);
        } else {
            this.lastRenderedLevelId = null; // force a fresh reload, editor currently holds IDE code
            this.renderLearn(this.learnBloc.state);
        }
    }

    render(state) {
        if (!this.editor || this.modeBloc.state.mode !== 'ide') return;
        // Guard against re-entrant calls (prevents infinite loops)
        if (this._isRendering) return;
        this._isRendering = true;

        try {
            const fileChanged = this.lastRenderedFile !== state.currentFile;

            // Save current editor content to FS before switching files
            // IMPORTANT: We write directly to state.virtualFS WITHOUT calling emit()
            // to avoid triggering another render cycle (which would cause stack overflow).
            if (fileChanged && this.lastRenderedFile && state.virtualFS[this.lastRenderedFile] !== undefined) {
                state.virtualFS[this.lastRenderedFile] = this.editor.getValue();
            }

            // Load the new file content into the editor
            if (fileChanged && state.currentFile) {
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
