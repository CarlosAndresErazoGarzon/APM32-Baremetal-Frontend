/**
 * SidebarDrawerUI
 * Owns the mobile hamburger/overlay/slide-in-out behavior for #sidebar.
 * Extracted out of SidebarUI (which used to own this too) so that
 * instantiating SidebarUI twice -- IDE's file tree and Playground's file
 * tree, sharing the one physical #sidebar/#mobileMenuBtn/#sidebarOverlay
 * elements -- doesn't double-bind two onclick handlers to the same
 * hamburger button. This is a single, mode-agnostic, app-wide singleton.
 */
export class SidebarDrawerUI {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.mobileMenuBtn = document.getElementById('mobileMenuBtn');
        this.sidebarOverlay = document.getElementById('sidebarOverlay');

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.mobileMenuBtn) {
            this.mobileMenuBtn.onclick = () => {
                const isClosed = this.sidebar.classList.contains('w-0');
                this.toggle(isClosed);
            };
        }

        if (this.sidebarOverlay) {
            this.sidebarOverlay.onclick = () => this.toggle(false);
        }

        // Open by default on desktop, closed on mobile
        if (this.sidebar) {
            if (window.innerWidth >= 1024) {
                this.sidebar.classList.remove('w-0', '-translate-x-full');
                this.sidebar.classList.add('w-64');
            } else {
                this.toggle(false);
            }
        }
    }

    // No border classes here on purpose -- the sidebar is borderless now
    // (background-color contrast against the editor is the only separator).
    // These used to also toggle border-r/lg:border-2 on/off, independent of
    // (and overriding) whatever index.html's own class list said.
    toggle(show) {
        if (!this.sidebar) return;

        if (show) {
            this.sidebar.classList.remove('w-0', 'opacity-0', 'pointer-events-none');
            this.sidebar.classList.add('w-64');
            if (window.innerWidth < 1024 && this.sidebarOverlay) {
                this.sidebarOverlay.classList.remove('hidden');
            }
        } else {
            this.sidebar.classList.add('w-0', 'opacity-0', 'pointer-events-none');
            this.sidebar.classList.remove('w-64');
            if (this.sidebarOverlay) this.sidebarOverlay.classList.add('hidden');
        }
    }
}
