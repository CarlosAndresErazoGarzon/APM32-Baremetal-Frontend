/**
 * DocsUI.js
 * Handles the documentation modal (Pinout / Tutorials), rendered from Markdown
 * files served alongside the app and parsed with the globally-loaded `marked` lib.
 */
export class DocsUI {
    constructor() {
        this.modal = document.getElementById('docsModal');
        this.showBtn = document.getElementById('showDocsBtn');
        this.closeBtn = document.getElementById('closeDocsBtn');
        this.content = document.getElementById('docContent');
        this.tabsContainer = document.getElementById('docTabs');

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.showBtn) {
            this.showBtn.onclick = () => {
                this.open();
                this.loadDoc('PINOUT_APM32.md');
            };
        }

        if (this.closeBtn) {
            this.closeBtn.onclick = () => this.close();
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        if (this.tabsContainer) {
            this.tabsContainer.querySelectorAll('.doc-tab').forEach(tab => {
                tab.onclick = () => this.loadDoc(tab.dataset.doc, tab);
            });
        }
    }

    open() {
        if (this.modal) this.modal.classList.remove('hidden');
    }

    close() {
        if (this.modal) this.modal.classList.add('hidden');
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
            this.content.innerHTML = `<article class='prose prose-invert'>${marked.parse(md)}</article>`;
        } catch (err) {
            this.content.innerHTML = "<div class='text-red-400 font-bold'>Error loading documentation. Please ensure the backend is running.</div>";
        }
    }
}
