/**
 * BrandingUI.js
 * One-shot init: renders a random ASCII-art font as the header title.
 *
 * Restored (2026-08) at the user's explicit, informed request after
 * previously being replaced with a plain static title -- some fonts (e.g.
 * dos.txt) are dense shade-block dither patterns, reported once as a real
 * visual-stress trigger. If that resurfaces, this file's own git history
 * (the commit that removed it) has the plain-text version to fall back to.
 */
// Every .txt file in frontend/fonts/ that actually renders as legible
// figlet-style art (hex.txt/morse.txt are one-line novelty encodings, not
// really "fonts" in the same sense, but read fine as a rotation entry too).
const FONTS = [
    'future.txt', 'larry_3d.txt', 'speed.txt', 'shadow.txt', 'dos.txt', 'rowan.txt',
    'ansi_compact.txt', 'ansi_regular.txt', 'ansi_shadow.txt',
    'big_money_ne.txt', 'big_money_nw.txt', 'big_money_se.txt', 'big_money_sw.txt',
    'diam_font.txt', 'emboss.txt', 'emboss2.txt', 'hex.txt', 'lean.txt', 'morse.txt',
    'old_banner.txt', 'os2.txt', 'pagga.txt', 'pawp.txt', 'rubiFont.txt',
    'star_strips.txt', 'terrance.txt', 'ticks.txt', 'ticks2.txt',
];

export async function initBrandingTitle() {
    const titleEl = document.getElementById('projectTitle');
    if (!titleEl) return;

    try {
        const randomFont = FONTS[Math.floor(Math.random() * FONTS.length)];
        const res = await fetch(`fonts/${randomFont}`);
        if (!res.ok) throw new Error();
        const art = await res.text();
        titleEl.textContent = art.trimEnd();
    } catch (err) {
        titleEl.textContent = "APM32_STATION";
        titleEl.classList.add('text-lg', 'lg:text-xl');
    }
}
