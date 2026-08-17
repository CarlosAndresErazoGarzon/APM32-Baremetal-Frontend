import { toggleFlexVisible } from '../core/domUtils.js';

/**
 * ModeSwitcherUI
 * The IDE/Learn toggle in the nav, and the single centralized owner of every
 * piece of chrome that only makes sense in one mode. Centralizing this here
 * (rather than letting each affected UI class check modeBloc.state itself)
 * matters because a few of these elements (#autoSaveWrapper, #cloudSaveBtn)
 * already have an independent owner (AutoSaveUI, AuthUI) toggling their own
 * hidden/flex classes based on auth state -- a second owner reaching in and
 * toggling those SAME elements' classes based on mode would race. Wrapping
 * them in an ancestor that only this class ever touches sidesteps that
 * entirely: display:none on the ancestor hides descendants regardless of
 * what those other owners are doing, so they need zero changes.
 */
export class ModeSwitcherUI {
    constructor(modeBloc) {
        this.modeBloc = modeBloc;

        this.ideModeBtn = document.getElementById('ideModeBtn');
        this.learnModeBtn = document.getElementById('learnModeBtn');

        this.ideOnlyNavControls = document.getElementById('ideOnlyNavControls');
        this.learnActions = document.getElementById('learnActions');
        this.runTestsBtn = document.getElementById('runTestsBtn');
        this.ideOnlySidebarFooter = document.getElementById('ideOnlySidebarFooter');
        this.newFileBtn = document.getElementById('newFileBtn');
        this.projectBadge = document.getElementById('projectBadge');
        this.fileTreeList = document.getElementById('fileTreeList');
        this.levelListPane = document.getElementById('levelListPane');
        this.telemetryColumn = document.getElementById('telemetryColumn');
        this.resultsTabBtn = document.getElementById('resultsTabBtn');
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
    }

    render(state) {
        const isIde = state.mode === 'ide';

        if (this.ideModeBtn) this.ideModeBtn.classList.toggle('active', isIde);
        if (this.learnModeBtn) this.learnModeBtn.classList.toggle('active', !isIde);

        toggleFlexVisible(this.ideOnlyNavControls, isIde);
        toggleFlexVisible(this.learnActions || this.runTestsBtn, !isIde);
        toggleFlexVisible(this.ideOnlySidebarFooter, isIde);

        if (this.newFileBtn) this.newFileBtn.classList.toggle('hidden', !isIde);
        if (this.projectBadge) this.projectBadge.classList.toggle('hidden', !isIde);
        if (this.fileTreeList) this.fileTreeList.classList.toggle('hidden', !isIde);
        if (this.levelListPane) this.levelListPane.classList.toggle('hidden', isIde);
        if (this.resultsTabBtn) this.resultsTabBtn.classList.toggle('hidden', isIde);

        // Telemetry (flash/RAM/core state) only means anything with real
        // hardware attached -- not relevant to Learn mode's plain host C.
        toggleFlexVisible(this.telemetryColumn, isIde);

        if (this.explorerTitle) {
            this.explorerTitle.textContent = isIde ? 'Files Explorer' : 'Levels';
        }
    }
}
