import { globalEventBus } from '../core/EventBus.js';

export class EditorUI {
    constructor(fsBloc) {
        this.fsBloc = fsBloc;
        this.editor = null;
        this.editorContainer = document.getElementById('editor');
        this.themeToggleBtn = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');

        // Internal state tracker to avoid infinite loops on update
        this.lastRenderedFile = null;

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

        this.editor = monaco.editor.create(this.editorContainer, {
            value: '',
            language: 'c',
            theme: this.isDark ? 'vs-dark' : 'vs',
            automaticLayout: true,
            minimap: { enabled: false },
            fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
            fontSize: 14
        });

        // Consumed by AutoSaveUI to debounce a cloud save after edits settle.
        this.editor.onDidChangeModelContent(() => {
            globalEventBus.emit('EDITOR_CONTENT_CHANGED');
        });

        // Subscribe to FileSystem changes to update editor content
        this.fsBloc.subscribe(this.render.bind(this));
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
            monaco.editor.setTheme(this.isDark ? 'vs-dark' : 'vs');
        }

        if (this.themeIcon) {
            this.themeIcon.innerHTML = this.isDark
                ? `<path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"></path>`
                : `<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>`;
        }
    }

    render(state) {
        if (!this.editor) return;
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
                monaco.editor.setModelMarkers(this.editor.getModel(), "compiler", []);

                this.lastRenderedFile = state.currentFile;
            }
        } finally {
            this._isRendering = false;
        }
    }

    getContent() {
        return this.editor ? this.editor.getValue() : '';
    }
}
