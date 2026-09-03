import { toggleFlexVisible } from '../core/domUtils.js';

/**
 * ModeSwitcherUI
 * The IDE/Learn/Playground toggle in the nav, and the single centralized
 * owner of every piece of chrome that only makes sense in one mode.
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

        this.ideOnlyNavControls = document.getElementById('ideOnlyNavControls');
        this.learnActions = document.getElementById('learnActions');
        this.runTestsBtn = document.getElementById('runTestsBtn');
        this.ideOnlySidebarFooter = document.getElementById('ideOnlySidebarFooter');
        this.playgroundOnlySidebarFooter = document.getElementById('playgroundOnlySidebarFooter');
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
    }

    render(state) {
        const isIde = state.mode === 'ide';
        const isLearn = state.mode === 'learn';
        const isPlayground = state.mode === 'playground';

        if (this.ideModeBtn) this.ideModeBtn.classList.toggle('active', isIde);
        if (this.learnModeBtn) this.learnModeBtn.classList.toggle('active', isLearn);
        if (this.playgroundModeBtn) this.playgroundModeBtn.classList.toggle('active', isPlayground);

        toggleFlexVisible(this.ideOnlyNavControls, isIde);
        toggleFlexVisible(this.learnActions || this.runTestsBtn, isLearn);
        toggleFlexVisible(this.ideOnlySidebarFooter, isIde);
        toggleFlexVisible(this.playgroundOnlySidebarFooter, isPlayground);

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

        if (this.explorerTitle) {
            this.explorerTitle.textContent = isIde ? 'Files Explorer' : isLearn ? 'Levels' : 'Playground Files';
        }
    }
}
