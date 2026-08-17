/**
 * domUtils.js
 * Shared tiny DOM helpers. toggleFlexVisible exists because Tailwind's
 * `hidden` and `flex` utility classes have equal CSS specificity -- if an
 * element needs `display:flex` when shown, toggling only `hidden` is
 * unreliable (found and fixed once already, in the Logs/Serial/Results tab
 * switcher; reused here for every other element that needs the same
 * show-as-flex/hide behavior instead of copy-pasting the fix again).
 */
export function toggleFlexVisible(el, show) {
    if (!el) return;
    el.classList.toggle('hidden', !show);
    el.classList.toggle('flex', show);
}
