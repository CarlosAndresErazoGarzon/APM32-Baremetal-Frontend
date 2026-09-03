/**
 * SidebarSettingsUI
 * Owns the [gear] "settings" popover that holds everything that isn't the
 * file tree itself: cloud save/load, autosave, and the Docs/Keys/Recovery/
 * Extension/version utility row. This used to live stacked directly under
 * the file tree inside #sidebar, eating a third to a half of its height on
 * short viewports (a real reported complaint: the tree itself had almost
 * no room left, and the terminal panel below it felt cramped too). Pulling
 * it into a floating panel means the tree gets the sidebar's full height,
 * all the time.
 *
 * Rendered as position:fixed rather than nested inside #sidebar, because
 * #sidebar has overflow-hidden (needed for its own slide-in/out drawer
 * transition) which would clip a popover taller than the sidebar's own
 * box. Fixed + a computed top/left anchored to the gear button sidesteps
 * that -- same "portal" idea the app's modals (#docsModal, #recoveryModal)
 * already use.
 *
 * Single app-wide singleton, same convention as SidebarDrawerUI: the
 * panel's contents (cloud buttons, autosave checkboxes, mode-only
 * sections) are shared, single-owner elements already managed by
 * AutoSaveUI/AuthUI/ModeSwitcherUI -- this class only owns show/hide/
 * positioning of the panel itself, nothing inside it.
 */
export class SidebarSettingsUI {
    constructor() {
        this.btn = document.getElementById('sidebarSettingsBtn');
        this.panel = document.getElementById('sidebarSettingsPanel');

        this.initEventListeners();
    }

    initEventListeners() {
        if (!this.btn || !this.panel) return;

        this.btn.onclick = (e) => {
            e.stopPropagation(); // don't let the outside-click listener below fire on this same click
            if (this.panel.classList.contains('hidden')) this.open();
            else this.close();
        };

        // Same "click outside closes it" contract as the file tree's own
        // rename/delete dropdowns (see SidebarUI.js's document listener),
        // scoped to just this one panel/button pair.
        document.addEventListener('click', (e) => {
            if (this.panel.classList.contains('hidden')) return;
            if (this.panel.contains(e.target)) return;
            this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        // The gear button's own position can shift (mobile drawer opening,
        // window resize) while the panel is open -- keep it anchored.
        window.addEventListener('resize', () => {
            if (!this.panel.classList.contains('hidden')) this.position();
        });
    }

    open() {
        this.panel.classList.remove('hidden');
        this.position();
    }

    close() {
        this.panel.classList.add('hidden');
    }

    // Anchors the panel just under-left of the gear button (it opens
    // leftward since the button sits at the sidebar's right edge), clamped
    // so it never runs off any edge of the viewport -- matters most on
    // narrow phones, exactly the case that prompted this panel.
    position() {
        const r = this.btn.getBoundingClientRect();
        const panelWidth = this.panel.offsetWidth;
        const left = Math.min(r.right - panelWidth, window.innerWidth - panelWidth - 12);
        const top = r.bottom + 6;
        this.panel.style.left = `${Math.max(12, left)}px`;
        this.panel.style.top = `${top}px`;
        this.panel.style.maxHeight = `${window.innerHeight - top - 12}px`;
    }
}
