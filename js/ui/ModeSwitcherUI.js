import { toggleFlexVisible } from '../core/domUtils.js';

/**
 * ModeSwitcherUI
 * The IDE/Learn/Playground/Ajustes/Docs toggle in the nav, and the single
 * centralized owner of every piece of chrome that only makes sense in one
 * mode.
 * Centralizing this here (rather than letting each affected UI class check
 * modeBloc.state itself) matters because a few of these elements
 * (#autoSaveWrapper, #cloudSaveBtn) already have an independent owner
 * (AutoSaveUI, AuthUI) toggling their own hidden/flex classes based on auth
 * state -- a second owner reaching in and toggling those SAME elements'
 * classes based on mode would race. Wrapping them in an ancestor that only
 * this class ever touches sidesteps that entirely: display:none on the
 * ancestor hides descendants regardless of what those other owners are
 * doing, so they need zero changes.
 *
 * Every lookup is null-guarded and every element is optional: Playground's
 * markup can land in index.html independently of this file without
 * breaking anything in the meantime, and this file works unchanged for
 * builds/tests that don't have the Playground markup at all.
 */
export class ModeSwitcherUI {
    constructor(modeBloc) {
        this.modeBloc = modeBloc;

        this.ideModeBtn = document.getElementById('ideModeBtn');
        this.learnModeBtn = document.getElementById('learnModeBtn');
        this.playgroundModeBtn = document.getElementById('playgroundModeBtn');
        this.settingsModeBtn = document.getElementById('settingsModeBtn');
        this.docsModeBtn = document.getElementById('docsModeBtn');

        this.ideOnlyNavControls = document.getElementById('ideOnlyNavControls');
        this.learnActions = document.getElementById('learnActions');
        this.runTestsBtn = document.getElementById('runTestsBtn');
        this.newFileBtn = document.getElementById('newFileBtn');
        this.projectBadge = document.getElementById('projectBadge');
        this.fileTreeList = document.getElementById('fileTreeList');
        this.levelListPane = document.getElementById('levelListPane');
        this.playgroundFileTreeList = document.getElementById('playgroundFileTreeList');
        this.playgroundNewFileBtn = document.getElementById('playgroundNewFileBtn');
        this.playgroundProjectBadge = document.getElementById('playgroundProjectBadge');
        this.telemetryColumn = document.getElementById('telemetryColumn');
        this.resultsTabBtn = document.getElementById('resultsTabBtn');
        this.consoleTabBtn = document.getElementById('consoleTabBtn');
        this.explorerTitle = document.getElementById('explorerTitle');
        this.sidebar = document.getElementById('sidebar');
        this.terminalPane = document.getElementById('terminalPane');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.docsPanel = document.getElementById('docsPanel');

        this.initEventListeners();
        this.modeBloc.subscribe(this.render.bind(this));
    }

    initEventListeners() {
        if (this.ideModeBtn) {
            this.ideModeBtn.onclick = () => this.modeBloc.setMode('ide');
        }
        if (this.learnModeBtn) {
            this.learnModeBtn.onclick = () => this.modeBloc.setMode('learn');
        }
        if (this.playgroundModeBtn) {
            this.playgroundModeBtn.onclick = () => this.modeBloc.setMode('playground');
        }
        if (this.settingsModeBtn) {
            this.settingsModeBtn.onclick = () => this.modeBloc.setMode('settings');
        }
        if (this.docsModeBtn) {
            this.docsModeBtn.onclick = () => this.modeBloc.setMode('docs');
        }
    }

    render(state) {
        const isIde = state.mode === 'ide';
        const isLearn = state.mode === 'learn';
        const isPlayground = state.mode === 'playground';
        const isSettings = state.mode === 'settings';
        const isDocs = state.mode === 'docs';

        if (this.ideModeBtn) this.ideModeBtn.classList.toggle('active', isIde);
        if (this.learnModeBtn) this.learnModeBtn.classList.toggle('active', isLearn);
        if (this.playgroundModeBtn) this.playgroundModeBtn.classList.toggle('active', isPlayground);
        if (this.settingsModeBtn) this.settingsModeBtn.classList.toggle('active', isSettings);
        if (this.docsModeBtn) this.docsModeBtn.classList.toggle('active', isDocs);

        toggleFlexVisible(this.ideOnlyNavControls, isIde);
        toggleFlexVisible(this.learnActions || this.runTestsBtn, isLearn);
        // #ideOnlySidebarFooter/#playgroundOnlySidebarFooter (IDs kept as-
        // is, AutoSaveUI/AuthUI both still look them up) used to be mode-
        // gated here too, back when they lived under the file tree in
        // whichever mode owned them. Now that they live on the Settings
        // page instead (see index.html), there's no "current mode" left
        // to gate on once you've navigated away to look at settings --
        // both always show there, side by side; #settingsPanel's own
        // hidden toggle below is what actually controls whether either is
        // visible at all.

        if (this.newFileBtn) this.newFileBtn.classList.toggle('hidden', !isIde);
        if (this.projectBadge) this.projectBadge.classList.toggle('hidden', !isIde);
        if (this.fileTreeList) this.fileTreeList.classList.toggle('hidden', !isIde);
        if (this.levelListPane) this.levelListPane.classList.toggle('hidden', !isLearn);
        if (this.playgroundFileTreeList) this.playgroundFileTreeList.classList.toggle('hidden', !isPlayground);
        if (this.playgroundNewFileBtn) this.playgroundNewFileBtn.classList.toggle('hidden', !isPlayground);
        if (this.playgroundProjectBadge) this.playgroundProjectBadge.classList.toggle('hidden', !isPlayground);
        // Test Results only means anything for Learn's curriculum grading.
        if (this.resultsTabBtn) this.resultsTabBtn.classList.toggle('hidden', !isLearn);
        // Terminal is Playground's manual command line (see ConsoleUI.js) --
        // doesn't apply to IDE (ARM cross-compile only) or Learn (graded,
        // no free-form shell access).
        if (this.consoleTabBtn) this.consoleTabBtn.classList.toggle('hidden', !isPlayground);

        // Telemetry (flash/RAM/core state) only means anything with real
        // hardware attached -- not relevant to Learn/Playground's plain host C.
        toggleFlexVisible(this.telemetryColumn, isIde);

        // Nothing to browse and nothing to compile/run on the Settings or
        // Docs pages -- the sidebar (file/level tree) and the whole bottom
        // terminal pane (logs/serial/results/console) both hide outright
        // instead of just going empty, so each page gets the full
        // workspace width/height instead of sitting next to (or above)
        // blank chrome. #editorContainer/#theoryTabPanel's own hidden
        // state is CodeTheoryTabsUI's job (it has its own isSettings/
        // isDocs guard for exactly this reason -- see that file).
        // toggleFlexVisible, not a bare classList.toggle('hidden', ...) --
        // both #sidebar and #terminalPane carry a static `flex` class of
        // their own, and Tailwind's `hidden`/`flex` utilities have EQUAL
        // specificity (see domUtils.js's own comment on exactly this,
        // from the Logs/Serial/Results tab switcher hitting it first).
        toggleFlexVisible(this.sidebar, !isSettings && !isDocs);
        toggleFlexVisible(this.terminalPane, !isSettings && !isDocs);
        if (this.settingsPanel) this.settingsPanel.classList.toggle('hidden', !isSettings);
        if (this.docsPanel) this.docsPanel.classList.toggle('hidden', !isDocs);

        if (this.explorerTitle) {
            this.explorerTitle.textContent = isIde ? 'Files Explorer' : isLearn ? 'Levels' : 'Playground Files';
        }
    }
}
