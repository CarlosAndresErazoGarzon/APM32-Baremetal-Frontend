import { CONFIG } from './js/config.js';
import { globalEventBus } from './js/core/EventBus.js';

// BLoCs
import { AuthBloc } from './js/blocs/AuthBloc.js';
import { FileSystemBloc } from './js/blocs/FileSystemBloc.js';
import { CompilerBloc } from './js/blocs/CompilerBloc.js';
import { SerialBloc } from './js/blocs/SerialBloc.js';
import { ModeBloc } from './js/blocs/ModeBloc.js';
import { LearnBloc } from './js/blocs/LearnBloc.js';

// UIs
import { AuthUI } from './js/ui/AuthUI.js';
import { SidebarUI } from './js/ui/SidebarUI.js';
import { EditorUI } from './js/ui/EditorUI.js';
import { TerminalUI } from './js/ui/TerminalUI.js';
import { SerialUI } from './js/ui/SerialUI.js';
import { DocsUI } from './js/ui/DocsUI.js';
import { HardwareUI } from './js/ui/HardwareUI.js';
import { initBrandingTitle } from './js/ui/BrandingUI.js';
import { AutoSaveUI } from './js/ui/AutoSaveUI.js';
import { ModeSwitcherUI } from './js/ui/ModeSwitcherUI.js';
import { CodeTheoryTabsUI } from './js/ui/CodeTheoryTabsUI.js';
import { LevelListUI } from './js/ui/LevelListUI.js';
import { TheoryUI } from './js/ui/TheoryUI.js';
import { TestResultsUI } from './js/ui/TestResultsUI.js';
import { RunUI } from './js/ui/RunUI.js';

// Orchestrator initialization
document.addEventListener('DOMContentLoaded', () => {
    // 1. Instantiate BLoCs
    const authBloc = new AuthBloc();
    const fsBloc = new FileSystemBloc();
    const compilerBloc = new CompilerBloc();
    const serialBloc = new SerialBloc();
    const modeBloc = new ModeBloc();
    const learnBloc = new LearnBloc();

    // 2. Instantiate UIs and Inject Dependencies
    const authUI = new AuthUI(authBloc);
    const editorUI = new EditorUI(fsBloc, modeBloc, learnBloc);
    const sidebarUI = new SidebarUI(fsBloc, () => editorUI.getContent());
    const terminalUI = new TerminalUI(compilerBloc, fsBloc, serialBloc, CONFIG.API_URL, modeBloc);
    const serialUI = new SerialUI(serialBloc);
    const docsUI = new DocsUI();
    const hardwareUI = new HardwareUI(serialBloc);
    const autoSaveUI = new AutoSaveUI(authBloc, fsBloc, () => editorUI.getContent());
    const modeSwitcherUI = new ModeSwitcherUI(modeBloc);
    const codeTheoryTabsUI = new CodeTheoryTabsUI(modeBloc, learnBloc, editorUI);
    const levelListUI = new LevelListUI(learnBloc);
    const theoryUI = new TheoryUI(learnBloc);
    const testResultsUI = new TestResultsUI();
    const runUI = new RunUI(learnBloc, CONFIG.API_URL, () => editorUI.getContent());

    // 3. System Initialization
    initBrandingTitle();

    // Wake up Render Backend (Free Tier)
    fetch(`${CONFIG.API_URL}/health`).catch(() => {});

    // Init Firebase
    authBloc.initFirebase(CONFIG.API_URL);

    // Init Monaco Editor
    if (typeof require !== 'undefined') {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});
        require(['vs/editor/editor.main'], () => {
            editorUI.initEditor();
        });
    } else {
        console.error("Monaco loader not found.");
    }

    // Load dynamic examples
    window.dynamicExamples = [];
    fetch('examples/index.json')
        .then(res => res.json())
        .then(data => {
            window.dynamicExamples = data;
            const exampleSelector = document.getElementById('exampleSelector');
            if (exampleSelector) {
                data.forEach(ex => {
                    const opt = document.createElement('option');
                    opt.value = ex.id;
                    opt.textContent = ex.name;
                    exampleSelector.appendChild(opt);
                });
            }
            if (data.length > 0) {
                fsBloc.loadExample(data[0].id, data);
            }
        })
        .catch(err => console.warn("Could not load examples registry:", err));

    // Load Learn mode levels (independent of examples above -- different
    // toolchain, different content, only fetched once and cached in LearnBloc)
    learnBloc.loadLevelsIndex();

    // 4. Cross-Bloc wiring using EventBus (if necessary)
    globalEventBus.on('AUTH_LOGOUT', () => {
        if (window.dynamicExamples && window.dynamicExamples.length > 0) {
            fsBloc.loadExample(window.dynamicExamples[0].id, window.dynamicExamples);
        }
    });

    // Pull the user's saved project in as soon as they're identified -- otherwise
    // whatever was on screen before login (a default example, a scratchpad) stays
    // there with no indication it isn't the user's actual project.
    globalEventBus.on('AUTH_LOGIN', ({ user, db }) => {
        fsBloc.loadProjectFromCloud(db, user);
    });

    authBloc.subscribe((state) => {
        if (state.user && state.db) {
            const cloudLoadBtn = document.getElementById('cloudLoadBtn');
            const cloudSaveBtn = document.getElementById('cloudSaveBtn');
            if(cloudLoadBtn) cloudLoadBtn.onclick = () => fsBloc.loadProjectFromCloud(state.db, state.user);
            if(cloudSaveBtn) cloudSaveBtn.onclick = () => fsBloc.saveProjectToCloud(state.db, state.user, editorUI.getContent());
        }
    });

    globalEventBus.emit('LOG', { message: 'System Orchestrator Initialized (BLoC)', type: 'success' });
});
