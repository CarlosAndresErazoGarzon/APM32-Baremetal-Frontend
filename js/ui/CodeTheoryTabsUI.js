/**
 * CodeTheoryTabsUI
 * Shows/hides the editor vs. the theory panel in the main area. Used to own
 * a "Code"/"Theory" button pair above the editor and switch on click; that
 * bar is gone now (navigation moved into the sidebar's unit tree -- see
 * LevelListUI's Specification/exercise children), so this class just
 * reacts to LearnBloc's `currentView` instead of owning any DOM state of
 * its own. Still gated by modeBloc: in IDE mode the theory panel must never
 * show no matter what currentView says (there's no theory to show).
 */
export class CodeTheoryTabsUI {
    constructor(modeBloc, learnBloc, editorUI) {
        this.modeBloc = modeBloc;
        this.learnBloc = learnBloc;
        this.editorUI = editorUI;

        this.editorContainer = document.getElementById('editorContainer');
        this.theoryTabPanel = document.getElementById('theoryTabPanel');

        this.modeBloc.subscribe(this.render.bind(this));
        this.learnBloc.subscribe(this.render.bind(this));
    }

    render() {
        // ModeSwitcherUI owns #settingsPanel/#docsPanel and everything
        // else for Settings/Docs mode, but #editorContainer/#theoryTabPanel
        // have always been THIS class's job -- so hiding both here is what
        // actually keeps the editor from sitting on top of (or peeking out
        // from behind) those pages, not just leaving them at whatever
        // state the previous mode left them in.
        if (this.modeBloc.state.mode === 'settings' || this.modeBloc.state.mode === 'docs') {
            if (this.editorContainer) this.editorContainer.classList.add('hidden');
            if (this.theoryTabPanel) this.theoryTabPanel.classList.add('hidden');
            return;
        }

        const inLearnMode = this.modeBloc.state.mode === 'learn';
        const showTheory = inLearnMode && this.learnBloc.state.currentView === 'theory';

        if (this.editorContainer) {
            this.editorContainer.classList.toggle('hidden', showTheory);
            this.editorContainer.style.backgroundColor = "var(--terminal-bg)";
        }
        if (this.theoryTabPanel) {
            this.theoryTabPanel.classList.toggle('hidden', !showTheory);
            this.theoryTabPanel.style.backgroundColor = "var(--terminal-bg)";
        }

        // Monaco doesn't always notice its container was hidden (display:none)
        // and came back -- nudge it to recompute layout when the editor
        // becomes visible again (automaticLayout's own ResizeObserver can
        // miss this, e.g. switching mode or coming back from theory).
        if (!showTheory && this.editorUI) {
            requestAnimationFrame(() => this.editorUI.layout());
        }
    }
}
