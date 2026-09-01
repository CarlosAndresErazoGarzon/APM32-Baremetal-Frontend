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
        this.nav = document.querySelector('nav');

        this.initEventListeners();
        this.applyNavOffset();
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

        // <nav>'s own height isn't constant: below the 'lg' breakpoint it
        // wraps into 2-3 rows (mode tabs, login row), AND its ASCII-art
        // title (BrandingUI.js) loads asynchronously and can change nav's
        // height again well after first paint. #sidebar is position:fixed
        // top:0 there too -- same top-left corner as <nav>, which sits
        // above it (z-60 vs z-50) -- so without this, <nav> visually
        // covers #sidebar's own header (title, "+", the settings gear)
        // completely on any sub-1024px viewport (a real, confirmed bug,
        // not just theoretical -- verified via screenshot: the sidebar's
        // "+" button was there in the DOM and clickable by ID, just never
        // visible or reachable by an actual click). A ResizeObserver on
        // <nav> catches every case (window resize AND the async font
        // swap) with one mechanism instead of re-deriving this in several
        // places.
        if (this.nav && window.ResizeObserver) {
            new ResizeObserver(() => this.applyNavOffset()).observe(this.nav);
        }
        window.addEventListener('resize', () => this.applyNavOffset());
    }

    // Pushes #sidebar (and its overlay) down to start right below <nav>'s
    // actual rendered height instead of at the viewport's true top:0 --
    // only below the 'lg' breakpoint, where #sidebar is fixed and
    // overlaps <nav> in the first place. At 'lg'+ #sidebar is `relative`
    // and already sits beside <nav> in normal flow, so any leftover
    // inline offset from a narrower width has to be cleared, not just left at 0.
    applyNavOffset() {
        if (!this.sidebar) return;

        if (window.innerWidth >= 1024) {
            this.sidebar.style.top = '';
            this.sidebar.style.height = '';
            return;
        }

        const navHeight = this.nav ? this.nav.getBoundingClientRect().height : 0;
        this.sidebar.style.top = `${navHeight}px`;
        this.sidebar.style.height = `calc(100% - ${navHeight}px)`;
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
