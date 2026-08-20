/**
 * TheoryUI
 * Renders into #theoryContent, inside the "Theory" tab of the main area
 * (alongside a "Code" tab holding the editor -- see CodeTheoryTabsUI, which
 * owns switching between them). Full-size panel instead of a cramped side
 * column. Reuses DocsUI's exact fetch + marked.parse() + innerHTML approach,
 * just inline instead of inside a modal, and reading the markdown straight
 * from LearnBloc's state (which already fetched it as part of loadLevel())
 * instead of fetching it itself. Renders regardless of whether the Theory
 * tab is currently visible -- harmless, and keeps this class oblivious to
 * tab state entirely.
 */
export class TheoryUI {
    constructor(learnBloc) {
        this.learnBloc = learnBloc;
        this.container = document.getElementById('theoryContent');
        this.lastRenderedMd = undefined;

        this.learnBloc.subscribe(this.render.bind(this));
    }

    render(state) {
        if (!this.container) return;
        if (state.theoryMd === this.lastRenderedMd) return;
        this.lastRenderedMd = state.theoryMd;

        if (!state.theoryMd) {
            this.container.innerHTML = "<div class='text-center py-10 opacity-50 uppercase tracking-widest text-[10px] font-mono'>Select a level to begin.</div>";
            return;
        }

        // eslint-disable-next-line no-undef
        this.container.innerHTML = marked.parse(state.theoryMd);
        this.container.style.backgroundColor = "var(--terminal-bg)";
        this.container.style.color = "var(--text-main)";
    }
}
