/**
 * BrandingUI.js
 * One-shot init: renders a random ASCII-art font as the header title.
 */
const FONTS = ['future.txt', 'larry_3d.txt', 'speed.txt', 'shadow.txt', 'dos.txt', 'rowan.txt'];

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
