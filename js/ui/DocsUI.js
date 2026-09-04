/**
 * DocsUI.js
 * Handles the Docs page (Pinout / Tutorials), rendered from Markdown files
 * served alongside the app and parsed with the globally-loaded `marked`
 * lib. Used to be a modal opened via a [Docs] button (open()/close()/an
 * Escape handler); now Docs is its own top-level mode (see ModeBloc.js/
 * ModeSwitcherUI.js), so this class only owns the tab-switching and
 * content-loading inside #docsPanel -- visibility of the panel itself is
 * ModeSwitcherUI's job, same as #settingsPanel.
 */
export class DocsUI {
    constructor() {
        this.content = document.getElementById('docContent');
        this.tabsContainer = document.getElementById('docTabs');

        this.initEventListeners();
        this.loadDoc('PINOUT_APM32.md');
    }

    initEventListeners() {
        if (this.tabsContainer) {
            this.tabsContainer.querySelectorAll('.doc-tab').forEach(tab => {
                tab.onclick = () => this.loadDoc(tab.dataset.doc, tab);
            });
        }
    }

    async loadDoc(file, el) {
        if (!this.content) return;

        if (el) {
            document.querySelectorAll('.doc-tab').forEach(tab => tab.classList.remove('active'));
            el.classList.add('active');
        }

        try {
            this.content.innerHTML = "<div class='text-center py-10 opacity-50 uppercase tracking-widest text-xs animate-pulse font-mono'>Decrypting Reference...</div>";
            const res = await fetch(`docs/${file}`);
            let md = await res.text();

            // Rewrite image paths to point to docs/img/ correctly
            md = md.replace(/\.\/img\//g, 'docs/img/');

            // eslint-disable-next-line no-undef
            this.content.innerHTML = marked.parse(md);
        } catch (err) {
            this.content.innerHTML = "<div class='text-red-400 font-bold'>Error loading documentation. Please ensure the backend is running.</div>";
        }
    }
}
