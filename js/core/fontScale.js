/**
 * fontScale.js
 * A whole-app text-size control (Ajustes -> Apariencia) for readability,
 * separate from ThemeBloc's color tokens -- this is a device-level
 * accessibility preference, not "the account's look", so unlike colors
 * (see ThemeBloc.js's own guest-persistence fix) it's stored in
 * localStorage unconditionally, guest or not.
 *
 * Implementation: CSS `zoom` (not `transform: scale`) on <body>. This
 * codebase sizes almost everything with literal-pixel Tailwind classes
 * (`text-[9px]`, `text-[10px]`...), not `rem`, so the classic "just bump
 * the root font-size" trick does nothing here -- nothing is relative to
 * it. `zoom` instead re-renders the page as if the browser's own DPI
 * changed: it recomputes real layout/box sizes (unlike `transform`, which
 * only stretches already-laid-out pixels and would blow out every
 * fixed-size flex/overflow container in this app). Supported in
 * Chromium/WebKit for years and in Firefox since v126 (2024) -- this app
 * already requires Chromium for the IDE's WebSerial flashing anyway, so
 * that's not a new constraint.
 *
 * EDITOR_EXEMPT_ID: Monaco manages its own pixel geometry (canvas
 * rendering, ResizeObserver, its own `fontSize` option) independently of
 * CSS. Scaling its container via `zoom` would fight that math instead of
 * cooperating with it (same class of problem `EditorUI.refreshMonacoThemes()`
 * exists to solve for colors -- Monaco needs telling directly, not just an
 * ambient CSS change). So the editor's own container is explicitly reset
 * to zoom:1 regardless of the rest of the page -- this control affects the
 * surrounding chrome (nav, sidebar, terminal panel, Ajustes/Docs pages),
 * not the code editor itself.
 */
const STORAGE_KEY = 'apm32_font_scale';
const EDITOR_EXEMPT_ID = 'editorContainer';

export const FONT_SCALE_MIN = 80;
export const FONT_SCALE_MAX = 150;
export const FONT_SCALE_STEP = 10;
export const FONT_SCALE_DEFAULT = 100;

export function clampFontScale(percent) {
    return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, percent));
}

export function readStoredFontScale() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? clampFontScale(n) : FONT_SCALE_DEFAULT;
}

export function persistFontScale(percent) {
    localStorage.setItem(STORAGE_KEY, String(percent));
}

export function applyFontScale(percent) {
    document.body.style.zoom = percent / 100;
    const editor = document.getElementById(EDITOR_EXEMPT_ID);
    if (editor) editor.style.zoom = 1;
}
