import { CONFIG } from './js/config.js';
import { globalEventBus } from './js/core/EventBus.js';

// BLoCs
import { AuthBloc } from './js/blocs/AuthBloc.js';
import { FileSystemBloc } from './js/blocs/FileSystemBloc.js';
import { CompilerBloc } from './js/blocs/CompilerBloc.js';
import { SerialBloc } from './js/blocs/SerialBloc.js';
import { DapBloc } from './js/blocs/DapBloc.js';
import { ModeBloc } from './js/blocs/ModeBloc.js';
import { LearnBloc } from './js/blocs/LearnBloc.js';
import { ThemeBloc } from './js/blocs/ThemeBloc.js';
import { PlaygroundBloc } from './js/blocs/PlaygroundBloc.js';

// UIs
import { AuthUI } from './js/ui/AuthUI.js';
import { SidebarUI } from './js/ui/SidebarUI.js';
import { SidebarDrawerUI } from './js/ui/SidebarDrawerUI.js';
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
import { ConsoleUI } from './js/ui/ConsoleUI.js';
import { ThemeEditorUI } from './js/ui/ThemeEditorUI.js';
import { FontScaleUI } from './js/ui/FontScaleUI.js';
import { initHotkeys } from './js/ui/HotkeysUI.js';

// Playground's seed is plain host C, no APM32 headers -- this is a freeform
// space, not an ARM firmware project (see FileSystemBloc.js's constructor
// params and PlaygroundBloc.js's exec() runner).
const PLAYGROUND_SEED = {
    'main.c': '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, APM32!\\n");\n    return 0;\n}\n'
};

// Orchestrator initialization
document.addEventListener('DOMContentLoaded', () => {
    // 1. Instantiate BLoCs
    const authBloc = new AuthBloc();
    const fsBloc = new FileSystemBloc();
    // Sibling FileSystemBloc instance for Playground -- own seed content,
    // own cloud field (`playgroundProject`, a sibling of `project` on the
    // same users/{uid} document), so the two projects never collide.
    const playgroundFsBloc = new FileSystemBloc(PLAYGROUND_SEED, 'playgroundProject');
    const compilerBloc = new CompilerBloc();
    const serialBloc = new SerialBloc();
    const dapBloc = new DapBloc();
    const modeBloc = new ModeBloc();
    const learnBloc = new LearnBloc();
    const playgroundBloc = new PlaygroundBloc();

    // 2. Instantiate UIs and Inject Dependencies
    const authUI = new AuthUI(authBloc);
    const editorUI = new EditorUI(fsBloc, modeBloc, learnBloc, playgroundFsBloc);
    // Constructed right after EditorUI, not earlier -- ThemeBloc's own
    // constructor reads document.body's current light-theme class, which
    // EditorUI's constructor is what actually sets.
    const themeBloc = new ThemeBloc();
    const sidebarUI = new SidebarUI(fsBloc, () => editorUI.getContent());
    // Second SidebarUI instance targeting Playground's own sibling panel
    // markup -- #mobileMenuBtn/#sidebar/#sidebarOverlay are shared, single-
    // owner elements now, handled once by SidebarDrawerUI below instead of
    // by each SidebarUI instance (that would double-bind the hamburger).
    const playgroundSidebarUI = new SidebarUI(playgroundFsBloc, () => editorUI.getContent(), {
        fileTreeList: 'playgroundFileTreeList',
        newFileBtn: 'playgroundNewFileBtn',
        projectBadge: 'playgroundProjectBadge',
        exampleSelector: null
    });
    const sidebarDrawerUI = new SidebarDrawerUI();
    const terminalUI = new TerminalUI(compilerBloc, fsBloc, dapBloc, CONFIG.API_URL, modeBloc);
    const serialUI = new SerialUI(serialBloc);
    const docsUI = new DocsUI();
    const hardwareUI = new HardwareUI(dapBloc);
    const autoSaveUI = new AutoSaveUI(authBloc, fsBloc, modeBloc, 'ide', {
        wrapper: 'autoSaveWrapper', checkbox: 'autoSaveToggle', storageKey: 'apm32_autosave_enabled'
    });
    const playgroundAutoSaveUI = new AutoSaveUI(authBloc, playgroundFsBloc, modeBloc, 'playground', {
        wrapper: 'playgroundAutoSaveWrapper', checkbox: 'playgroundAutoSaveToggle', storageKey: 'apm32_autosave_enabled_playground'
    });
    const modeSwitcherUI = new ModeSwitcherUI(modeBloc);
    const codeTheoryTabsUI = new CodeTheoryTabsUI(modeBloc, learnBloc, editorUI);
    const levelListUI = new LevelListUI(learnBloc);
    const theoryUI = new TheoryUI(learnBloc);
    const testResultsUI = new TestResultsUI();
    const runUI = new RunUI(learnBloc, CONFIG.API_URL, () => editorUI.getContent());
    const consoleUI = new ConsoleUI(playgroundBloc, playgroundFsBloc, CONFIG.API_URL);
    const themeEditorUI = new ThemeEditorUI(themeBloc, authBloc);
    const fontScaleUI = new FontScaleUI();

    // 3. System Initialization
    initBrandingTitle();
    initHotkeys();

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
            // Skip the default-example auto-load if the constructor already
            // restored a local draft -- otherwise this fires moments later
            // and silently overwrites it, defeating FileSystemBloc's own
            // local persistence (confirmed as the actual cause of a
            // reported "my file disappeared on reload" bug: Playground has
            // no equivalent auto-load and its restore worked fine).
            if (data.length > 0 && !fsBloc.restoredFromLocal) {
                fsBloc.loadExample(data[0].id, data);
            }
        })
        .catch(err => console.warn("Could not load examples registry:", err));

    // Load Learn mode levels (independent of examples above -- different
    // toolchain, different content, only fetched once and cached in LearnBloc)
    learnBloc.loadLevelsIndex();

    // 4. Cross-Bloc wiring using EventBus (if necessary)
    globalEventBus.on('AUTH_LOGOUT', () => {
        // Back to each bloc's own guest bucket FIRST -- otherwise IDE/
        // Playground/Learn would all keep showing whichever account was
        // just signed out of.
        fsBloc.setNamespace(null);
        playgroundFsBloc.setNamespace(null);
        learnBloc.setNamespace(null);
        themeBloc.setNamespace(null);
        // Same guard as the initial load below -- don't clobber a guest
        // draft setNamespace() just restored.
        if (!fsBloc.restoredFromLocal && window.dynamicExamples && window.dynamicExamples.length > 0) {
            fsBloc.loadExample(window.dynamicExamples[0].id, window.dynamicExamples);
        }
    });

    // Pull the user's saved project in as soon as they're identified -- otherwise
    // whatever was on screen before login (a default example, a scratchpad) stays
    // there with no indication it isn't the user's actual project.
    globalEventBus.on('AUTH_LOGIN', async ({ user, db }) => {
        // Namespace switch has to land (and finish reading this uid's own
        // local draft/progress) BEFORE the cloud calls below -- otherwise
        // loadProjectFromCloud's "no saved project found" no-op path (or
        // loadProgressFromCloud's union-merge) would leave whichever
        // identity was previously using this browser still on screen.
        fsBloc.setNamespace(user.uid);
        playgroundFsBloc.setNamespace(user.uid);
        await learnBloc.setNamespace(user.uid);
        themeBloc.setNamespace(user.uid);

        fsBloc.loadProjectFromCloud(db, user);
        playgroundFsBloc.loadProjectFromCloud(db, user);
        learnBloc.loadProgressFromCloud(db, user);
        themeBloc.loadFromCloud(db, user);
    });

    // Local persistence for IDE/Playground/Learn: no longer needs wiring
    // here at all. EditorUI.onDidChangeModelContent now pushes every
    // keystroke straight into the active mode's bloc synchronously (see
    // EditorUI.js), and each FileSystemBloc mirrors its own state to
    // localStorage on every emit (persistLocal(), via the subscribe() in
    // its constructor) -- so there's nothing left for this event to do on
    // the local-persistence side. It still fires (see EditorUI.js) purely
    // for AutoSaveUI's own debounced cloud-save scheduling below.

    // A test just passed (LearnBloc.runTests) -- push progress to the
    // user's account if they're logged in. Silently does nothing otherwise,
    // same as today's localStorage-only flow for anonymous use.
    globalEventBus.on('LEARN_PROGRESS_UPDATED', () => {
        const { user, db } = authBloc.state;
        if (user && db) learnBloc.saveProgressToCloud(db, user);
    });

    authBloc.subscribe((state) => {
        if (state.user && state.db) {
            const cloudLoadBtn = document.getElementById('cloudLoadBtn');
            const cloudSaveBtn = document.getElementById('cloudSaveBtn');
            if(cloudLoadBtn) cloudLoadBtn.onclick = () => fsBloc.loadProjectFromCloud(state.db, state.user);
            if(cloudSaveBtn) cloudSaveBtn.onclick = () => fsBloc.saveProjectToCloud(state.db, state.user);

            const playgroundCloudLoadBtn = document.getElementById('playgroundCloudLoadBtn');
            const playgroundCloudSaveBtn = document.getElementById('playgroundCloudSaveBtn');
            if(playgroundCloudLoadBtn) playgroundCloudLoadBtn.onclick = () => playgroundFsBloc.loadProjectFromCloud(state.db, state.user);
            if(playgroundCloudSaveBtn) playgroundCloudSaveBtn.onclick = () => playgroundFsBloc.saveProjectToCloud(state.db, state.user);
        }
    });

    globalEventBus.emit('LOG', { message: 'System Orchestrator Initialized (BLoC)', type: 'success' });
});
