/**
 * RunUI
 * Owns #runTestsBtn exclusively -- a dedicated button rather than a
 * repurposed #flashBtn, since swapping that button's onclick per mode would
 * also require guarding against HardwareUI's unconditional
 * `flashBtn.disabled` writes on every serial connection change. A separate
 * button needs no changes to HardwareUI/TerminalUI at all. Visibility
 * (hidden in IDE mode) is owned by ModeSwitcherUI -- this class only owns
 * the button's enabled/spinner state while grading is in flight.
 */
export class RunUI {
    constructor(learnBloc, apiUrl, editorGetter) {
        this.learnBloc = learnBloc;
        this.apiUrl = apiUrl;
        this.getEditorContent = editorGetter;

        this.runTestsBtn = document.getElementById('runTestsBtn');
        this.resetCodeBtn = document.getElementById('resetCodeBtn');

        if (this.runTestsBtn) {
            this.runTestsBtn.onclick = () => {
                this.learnBloc.runTests(this.apiUrl, this.getEditorContent());
            };
        }

        if (this.resetCodeBtn) {
            this.resetCodeBtn.onclick = () => {
                if (confirm('¿Restablecer el código de este nivel al código inicial?')) {
                    this.learnBloc.resetLevelCode();
                }
            };
        }

        this.learnBloc.subscribe(this.render.bind(this));
    }

    render(state) {
        if (!this.runTestsBtn) return;

        this.runTestsBtn.disabled = state.isGrading;
        this.runTestsBtn.classList.toggle('opacity-50', state.isGrading);
        this.runTestsBtn.classList.toggle('cursor-not-allowed', state.isGrading);

        this.runTestsBtn.innerHTML = state.isGrading
            ? `<svg class="animate-spin -ml-1 mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> RUNNING...`
            : `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v14l11-7z"/></svg> RUN TESTS`;
    }
}
