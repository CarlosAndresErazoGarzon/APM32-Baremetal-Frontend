import { globalEventBus } from '../core/EventBus.js';
import { CORNER_MARKS_RIGHT } from './SidebarUI.js';

const FIELDS = [
    ['base', 'Fondo'],
    ['text', 'Texto'],
    ['accent', 'Acento'],
    ['success', 'Éxito'],
    ['danger', 'Peligro']
];

const SAVE_DEBOUNCE_MS = 1000;

/**
 * ThemeEditorUI
 * The 5-swatch color editor living in the sidebar settings panel (see
 * SidebarSettingsUI.js) -- edits ThemeBloc's tokens for whichever mode
 * (dark/light) is currently active, live via native <input type="color">
 * pickers. Everything else on the page updates instantly because
 * ThemeBloc.setToken() re-runs js/core/theme.js's deriveTheme() on every
 * change, not because this class touches any of that CSS itself.
 *
 * Deliberately does NOT re-render (rebuild the <input> elements) on every
 * token change -- only on a dark/light MODE switch or a reset. A picker
 * mid-drag fires oninput continuously; replacing its own DOM node while
 * the native color picker popover is open would close it. The inputs'
 * OWN values already reflect what the user just picked; there's nothing
 * to re-render for a plain edit.
 */
export class ThemeEditorUI {
    constructor(themeBloc, authBloc) {
        this.themeBloc = themeBloc;
        this.authBloc = authBloc;
        this.container = document.getElementById('themeEditorPane');
        this.saveTimer = null;

        globalEventBus.on('THEME_MODE_CHANGED', () => this.render());
        this.render();
    }

    currentMode() {
        return document.body.classList.contains('light-theme') ? 'light' : 'dark';
    }

    render() {
        if (!this.container) return;
        const mode = this.currentMode();
        const tokens = this.themeBloc.state[mode];

        this.container.innerHTML = `
            <div class="flex items-center justify-between mb-1.5">
                <span class="text-[9px] font-bold uppercase tracking-wider text-[var(--sidebar-text)]">
                    Colores (${mode === 'dark' ? 'oscuro' : 'claro'})
                </span>
                <button id="themeResetBtn" class="text-[9px] uppercase tracking-wider text-[var(--sidebar-text)] hover:text-[var(--accent-text)] underline">
                    Restablecer
                </button>
            </div>
            <div class="flex gap-2">
                ${FIELDS.map(([key, label]) => `
                    <label class="flex flex-col items-center gap-1 cursor-pointer" title="${label}">
                        <input type="color" data-token="${key}" value="${tokens[key]}"
                               class="w-6 h-6 p-0 border border-[var(--border-color)] rounded-none cursor-pointer bg-transparent">
                        <span class="text-[7px] font-bold uppercase tracking-wider text-[var(--sidebar-text)]">${label}</span>
                    </label>
                `).join('')}
            </div>

            <!-- Live reference -- real app styles (file row, buttons),
                 not an abstract swatch grid, so what you see here is
                 actually what the rest of the app will look like. Plain
                 markup using var(--...) throughout -- never rebuilt on a
                 token edit (render() only re-runs on a mode switch/reset,
                 see this class's own header comment), so it updates for
                 free as CSS custom properties change, same as everything
                 else on the page. -->
            <div class="mt-3 pt-3 border-t border-[var(--border-color)] flex flex-col gap-2">
                <span class="text-[8px] font-bold uppercase tracking-widest text-[var(--sidebar-text)] opacity-60">Referencia</span>
                <div class="p-3 flex flex-col gap-2" style="background: var(--terminal-bg); border: 1px solid var(--border-color);">
                    <div class="text-[11px] font-mono" style="color: var(--text-main);">AaBbCc 123 -- texto principal</div>
                    <div class="text-[10px] font-mono" style="color: var(--text-muted);">// texto secundario / comentario</div>
                    <div class="relative border-l-2 py-1.5 px-2 text-[10px] font-mono" style="border-color: var(--accent-text); color: var(--accent-text); background: var(--sidebar-bg);">
                        main.c
                        ${CORNER_MARKS_RIGHT}
                    </div>
                    <div class="flex gap-2 mt-1">
                        <button class="px-2 py-1 text-[8px] font-bold uppercase tracking-wider" style="border: 1px solid var(--border-color); color: var(--text-main); background: transparent;">LINK</button>
                        <button class="px-2 py-1 text-[8px] font-bold uppercase tracking-wider" style="background: var(--btn-green-bg); color: var(--btn-green-text);">OK</button>
                        <button class="px-2 py-1 text-[8px] font-bold uppercase tracking-wider" style="background: var(--btn-red-bg); color: var(--btn-red-text);">STOP</button>
                    </div>
                </div>
            </div>
        `;

        this.container.querySelectorAll('input[type="color"]').forEach(input => {
            input.oninput = () => {
                this.themeBloc.setToken(mode, input.dataset.token, input.value);
                this.scheduleSave();
            };
        });

        const resetBtn = this.container.querySelector('#themeResetBtn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                this.themeBloc.resetMode(mode);
                this.scheduleSave();
                this.render(); // the reset values need to show up in the swatches themselves
            };
        }
    }

    // Same shape as AutoSaveUI's scheduleAutosave(): debounced, and a
    // no-op for a guest (ThemeBloc's own persistLocal() already covers
    // that case on every emit -- this only handles the cloud side).
    scheduleSave() {
        const { user, db } = this.authBloc.state;
        if (!user || !db) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.themeBloc.saveToCloud(db, user), SAVE_DEBOUNCE_MS);
    }
}
