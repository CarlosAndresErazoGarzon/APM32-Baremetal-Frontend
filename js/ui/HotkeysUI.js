/**
 * HotkeysUI.js
 * One global keydown listener that clicks the button for whichever
 * REGISTRY entry matches -- no per-button wiring elsewhere, no coupling
 * to any BLoC/UI class (only element ids). Ignored entirely while typing
 * (input/textarea/contentEditable, which covers Monaco's own hidden
 * textarea too).
 *
 * Bare letters/digits ONLY, never Ctrl/Cmd (reserved by the browser,
 * can't be overridden) or symbol/punctuation keys -- `` ` ``, `\`, `[`,
 * `]` used to be bound here and were silently dead on Spanish/Latin
 * American keyboards (backtick is a dead key; the rest need AltGr, which
 * this file's own `e.altKey` guard rejects). Shift marks a handful of
 * "related but secondary" actions (`r` runs, Shift+R resets).
 *
 * A few ids share one key (e.g. 'n' for newFileBtn/playgroundNewFileBtn)
 * -- safe because firstVisibleEnabled() only ever finds ONE of them
 * rendered at a time (they're mode-exclusive).
 *
 * `?` (or clicking #hotkeysToggleBtn) toggles two things together: the
 * small data-hotkey badges on every bound button (CSS, see index.html)
 * and the full legend panel built by buildListPanel().
 *
 * `i`/`j` focus the editor/terminal input directly (not REGISTRY entries
 * -- no button to click for "give this element focus"); `Escape` exits
 * either back out, special-cased before the isTypingContext() guard since
 * that's the one place it needs to fire FROM inside a typing context.
 *
 * `v` (presentation mode) is ALSO special-cased rather than a REGISTRY
 * entry, for the opposite reason `i`/`j` are: its checkbox
 * (#presentationModeToggle) DOES exist as a real clickable element, but
 * it lives on the Ajustes page -- REGISTRY's firstVisibleEnabled() check
 * would only ever find it while already sitting on Ajustes, exactly
 * backwards from "toggle it while looking at code".
 *
 * serialSendBtn and the Recovery modal's own Escape-to-close
 * (HardwareUI.js) are intentionally not duplicated here -- Docs stopped
 * being a modal in 2026-09 (own mode/tab now, see ModeBloc.js).
 */
const REGISTRY = [
    // Global -- always relevant regardless of mode.
    { key: '1', ids: ['ideModeBtn'], label: 'Modo IDE' },
    { key: '2', ids: ['learnModeBtn'], label: 'Modo Learn' },
    { key: '3', ids: ['playgroundModeBtn'], label: 'Modo Playground' },
    { key: '4', ids: ['settingsModeBtn'], label: 'Ajustes' },
    { key: '5', ids: ['docsModeBtn'], label: 'Docs' },
    { key: 'm', ids: ['mobileMenuBtn'], label: 'Menú de archivos (móvil)' },
    { key: 't', ids: ['themeToggle'], label: 'Tema claro/oscuro' },
    { key: 'l', ids: ['authBtn'], label: 'Login / Logout' },
    { key: 'p', ids: ['toggleTerminalBtn'], label: 'Colapsar/expandir terminal (panel)' },
    { key: 'e', shift: true, ids: ['recoveryModeBtn'], label: 'Recovery mode' },

    // One key, several candidates -- mode-exclusive, first visible+enabled wins.
    { key: 'r', ids: ['runTestsBtn'], label: 'Run Tests (Learn)' },
    { key: 'n', ids: ['newFileBtn', 'playgroundNewFileBtn'], label: 'Nuevo archivo' },
    { key: 'k', ids: ['clearLogBtn', 'clearResultsBtn', 'serialClearBtn', 'consoleClearBtn'], label: 'Limpiar panel activo' },
    { key: 's', shift: true, ids: ['cloudSaveBtn', 'playgroundCloudSaveBtn'], label: 'Guardar en la nube' },
    { key: 'l', shift: true, ids: ['cloudLoadBtn', 'playgroundCloudLoadBtn'], label: 'Cargar de la nube' },
    { key: 'r', shift: true, ids: ['resetCodeBtn'], label: 'Reset código (Learn)' },

    // IDE mode only.
    { key: 'c', ids: ['connectBtn'], label: 'Conectar placa (LINK)' },
    { key: 's', ids: ['disconnectBtn'], label: 'Desconectar (STOP)' },
    { key: 'u', ids: ['flashBtn'], label: 'Flashear (UPLOAD)' },
    { key: 'e', ids: ['downloadZipBtn'], label: 'Exportar ZIP' },
    { key: 'b', ids: ['downloadBtn'], label: 'Descargar .bin' },
    { key: 'w', ids: ['serialConnectBtn'], label: 'Conectar Serial Monitor' },
];

// Not REGISTRY entries -- all special-cased in the keydown handler below
// (none of these are "click one fixed id" the way everything else is)
// but still belong in the list panel a student sees.
const EXTRA_LIST_ENTRIES = [
    { keys: 'O / Shift+O', label: 'Cambiar pestaña de la terminal' },
    { keys: 'I', label: 'Entrar al editor' },
    { keys: 'J', label: 'Entrar a la terminal' },
    { keys: 'V', label: 'Modo presentación (código centrado)' },
    { keys: 'Esc', label: 'Salir del editor/terminal' },
    { keys: '?', label: 'Mostrar/ocultar esta lista' },
];

// Monaco's real keyboard-input target is a plain <textarea> it creates
// inside its own container -- focusing THAT (not some monaco.* API call)
// is what actually puts the cursor there, and keeps this file's existing
// "only ever knows element ids/DOM" rule (no import of/coupling to
// EditorUI.js or the monaco global).
function focusEditor() {
    const textarea = document.querySelector('#editor textarea');
    if (textarea) textarea.focus();
}

// Whichever of these actually has something to type into right now --
// consoleCommandInput (Playground's Terminal tab) or serialInput (Serial
// Monitor tab, IDE mode) -- offsetParent also rules out a tab that's
// merely present in the DOM but not the one currently showing.
function focusableTerminalInput() {
    const candidates = [document.getElementById('consoleCommandInput'), document.getElementById('serialInput')];
    return candidates.find(el => el && el.offsetParent !== null) || null;
}

function isTypingContext() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable) return true;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

// The first candidate that's actually clickable right now -- rendered
// (not display:none up the tree, via offsetParent) and not disabled.
// This single check is what makes sharing a key across mode-exclusive
// buttons safe: at most one candidate is ever eligible at a time.
function firstVisibleEnabled(ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null && !el.disabled) return el;
    }
    return null;
}

// Cycles among whichever terminal tab buttons are currently visible --
// its own small special case rather than a REGISTRY entry, since "next
// visible tab" isn't a single fixed id the way every other binding is.
// 'o' cycles forward, Shift+O backward -- same "modifier picks the
// secondary direction/variant of the same base letter" convention the
// REGISTRY entries above already use (e.g. r/Shift+R).
const TAB_ORDER = ['logsTabBtn', 'serialTabBtn', 'resultsTabBtn', 'consoleTabBtn'];
function cycleTerminalTab(direction) {
    const visible = TAB_ORDER.map(id => document.getElementById(id)).filter(el => el && el.offsetParent !== null);
    if (visible.length < 2) return;
    const activeIdx = visible.findIndex(el => el.classList.contains('active'));
    const nextIdx = ((activeIdx === -1 ? 0 : activeIdx) + direction + visible.length) % visible.length;
    visible[nextIdx].click();
}

const HINTS_KEY = 'apm32_hotkeys_visible';
let listPanel = null;

// data-hotkey attribute + a CSS `::after` (index.html) renders the badge,
// NOT an appended child -- several buttons (runTestsBtn, authBtn, ...)
// have their own owner reassigning innerHTML reactively (spinner swaps),
// which would wipe out a real child node. An attribute survives that.
function injectBadges() {
    for (const entry of REGISTRY) {
        const label = keyLabel(entry);
        for (const id of entry.ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.setAttribute('data-hotkey', label);
        }
    }
    // #hotkeysToggleBtn isn't in REGISTRY (its click does something
    // different from "click a target button" -- toggleHints() itself),
    // but it still gets a badge showing the SAME '?' that also toggles it.
    const toggleBtn = document.getElementById('hotkeysToggleBtn');
    if (toggleBtn) toggleBtn.setAttribute('data-hotkey', '?');
}

function keyLabel(entry) {
    return (entry.shift ? 'Shift+' : '') + entry.key.toUpperCase();
}

// Built once, appended to <body>, then just shown/hidden -- a small
// floating card above the [Keys] button (it lives at the bottom of the
// sidebar, so popping upward is what actually fits on screen) listing
// every shortcut with a human-readable label, grouped the same way
// REGISTRY itself is ordered (global first, then shared, then IDE-only).
function buildListPanel() {
    const panel = document.createElement('div');
    panel.id = 'hotkeysListPanel';
    panel.className = 'hidden fixed z-[200] font-mono text-[10px] bg-[var(--sidebar-bg)] border border-[var(--border-color)] text-[var(--text-main)] p-3 max-h-[70vh] overflow-y-auto custom-scrollbar shadow-lg';
    panel.style.bottom = '48px';
    panel.style.left = '12px';
    panel.style.width = '260px';

    const rows = [...REGISTRY, ...EXTRA_LIST_ENTRIES.map(e => ({ keys: e.keys, label: e.label }))];
    const seen = new Set();
    const html = rows.map(entry => {
        const keys = entry.keys || keyLabel(entry);
        const dedupeKey = keys + '|' + entry.label;
        if (seen.has(dedupeKey)) return '';
        seen.add(dedupeKey);
        return `<div class="flex items-center justify-between gap-3 py-1 border-b border-[var(--border-color)] last:border-b-0">
            <span class="opacity-80">${entry.label}</span>
            <kbd class="flex-shrink-0 px-1.5 py-0.5 border border-current opacity-70 rounded-sm">${keys}</kbd>
        </div>`;
    }).join('');

    panel.innerHTML = `<div class="text-[9px] uppercase tracking-widest opacity-60 mb-2 pb-2 border-b border-[var(--border-color)]">Atajos de teclado</div>${html}`;
    document.body.appendChild(panel);
    return panel;
}

function isListOpen() {
    return listPanel && !listPanel.classList.contains('hidden');
}

function closeList() {
    if (listPanel) listPanel.classList.add('hidden');
}

function applyHintVisibility(visible) {
    document.body.classList.toggle('hotkeys-visible', visible);
    const toggleBtn = document.getElementById('hotkeysToggleBtn');
    if (toggleBtn) toggleBtn.classList.toggle('opacity-100', visible);
    if (!visible) closeList();
}

// The badges (persisted on/off) and the list panel (only ever open while
// badges are on, closed the moment they're turned off) are two different
// kinds of state on purpose -- badges are a quiet, always-there reminder
// once enabled; the list is an on-demand lookup you open and close within
// that same session, not something worth remembering across reloads.
function toggleHints() {
    const next = !document.body.classList.contains('hotkeys-visible');
    localStorage.setItem(HINTS_KEY, next ? '1' : '0');
    applyHintVisibility(next);
    if (next) {
        if (!listPanel) listPanel = buildListPanel();
        listPanel.classList.remove('hidden');
    }
}

export function initHotkeys() {
    injectBadges();
    applyHintVisibility(localStorage.getItem(HINTS_KEY) === '1');

    const toggleBtn = document.getElementById('hotkeysToggleBtn');
    if (toggleBtn) toggleBtn.onclick = toggleHints;

    // Click-outside closes the list panel without turning the badges back
    // off -- the badges are the "on" state, the panel is just a transient
    // popover riding on top of it.
    document.addEventListener('click', (e) => {
        if (!isListOpen()) return;
        if (e.target === toggleBtn || (listPanel && listPanel.contains(e.target))) return;
        closeList();
    });

    window.addEventListener('keydown', (e) => {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;

        if (e.key === 'Escape' && isListOpen()) { closeList(); return; }

        // Escape-to-exit needs to fire FROM inside the editor/terminal --
        // both are a "typing context" by definition, so this has to run
        // before that guard below, same reasoning as the list-panel case
        // right above.
        if (e.key === 'Escape') {
            const active = document.activeElement;
            const editorTextarea = document.querySelector('#editor textarea');
            if (active && (active === editorTextarea || active === focusableTerminalInput())) {
                active.blur();
                return;
            }
        }

        if (isTypingContext()) return;

        if (e.key === '?') { e.preventDefault(); toggleHints(); return; }

        const key = e.key.toLowerCase();

        if (key === 'o') { e.preventDefault(); cycleTerminalTab(e.shiftKey ? -1 : 1); return; }
        if (key === 'i') { e.preventDefault(); focusEditor(); return; }
        if (key === 'j') {
            const input = focusableTerminalInput();
            if (input) { e.preventDefault(); input.focus(); }
            return;
        }
        if (key === 'v') {
            // Special-cased, not a REGISTRY entry: its checkbox
            // (#presentationModeToggle) lives on the Ajustes page, so
            // REGISTRY's usual firstVisibleEnabled() check (offsetParent
            // !== null) would only let this fire while already sitting on
            // Ajustes -- exactly backwards from how it's actually meant to
            // be used (toggled while looking at code in IDE/Learn/
            // Playground, not from the settings page). Toggling it
            // directly here works regardless of which mode is showing.
            // Setting .checked programmatically doesn't fire 'change' on
            // its own (unlike a real .click()), so that's dispatched by
            // hand to reach EditorUI.js's own listener.
            const toggle = document.getElementById('presentationModeToggle');
            if (toggle) {
                e.preventDefault();
                toggle.checked = !toggle.checked;
                toggle.dispatchEvent(new Event('change'));
            }
            return;
        }

        const entry = REGISTRY.find(r => r.key === key && !!r.shift === e.shiftKey);
        if (!entry) return;

        const target = firstVisibleEnabled(entry.ids);
        if (!target) return;

        e.preventDefault();
        target.click();
    });
}
