/**
 * BrandingUI.js
 * One-shot init: renders the static header title.
 *
 * Previously this rendered a random dense ASCII-art figlet font (picked
 * fresh on every page load, tiny 6-7px monospace, some variants built from
 * shade-block characters like the dither pattern in dos.txt). That's a
 * high-spatial-frequency, max-contrast pattern -- a known trigger for visual
 * stress/headaches for sensitive users, and it was reported as causing
 * exactly that. Replaced with a plain, static, legible title; the "hacker
 * terminal" feel now comes from letter-spacing/weight/uppercase instead of
 * from a dense glyph pattern.
 */
export async function initBrandingTitle() {
    const titleEl = document.getElementById('projectTitle');
    if (!titleEl) return;

    titleEl.textContent = 'APM32 STATION';
    titleEl.classList.remove('text-[6px]', 'lg:text-[7px]', 'leading-[1]', 'whitespace-pre');
    titleEl.classList.add('text-lg', 'lg:text-xl', 'tracking-[0.15em]');
}
