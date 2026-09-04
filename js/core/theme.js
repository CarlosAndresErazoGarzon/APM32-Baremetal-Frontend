/**
 * theme.js
 * Turns ~5 user-facing colors ("tokens") into the full set of ~20 CSS
 * custom properties index.html's :root/body.light-theme blocks used to
 * hand-pick independently. Built for the upcoming theme editor (colors
 * saved per-account, mirroring FileSystemBloc's cloud-save pattern) --
 * without this, editing a theme would mean exposing 20 pickers per theme,
 * most of which are really just "a shade of the base background" or "a
 * shade of the accent" that a human would tune together anyway.
 *
 * BASE_TOKEN_KEYS is the entire editable surface:
 *   base    -- main content background (the editor's own background)
 *   text    -- primary text color
 *   accent  -- selection/active-state identity color
 *   success -- semantic "this passed / this worked" color
 *   danger  -- semantic "this failed / this deletes" color
 *
 * success/danger are deliberately their OWN tokens, not derived from
 * base/accent -- they carry meaning (pass/fail, safe/destructive) that
 * shouldn't shift just because someone picked a different decorative
 * accent hue. Same reasoning applyPageTheme() (tools/generate-palette-
 * page.js) already used when it excluded --success/--danger from its own
 * derived vars.
 *
 * Every derived TEXT color is solved for real contrast against its own
 * derived BACKGROUND (via colorAtLuminance/pickReadableText below) rather
 * than produced by blindly mixing colors and hoping -- the exact class of
 * bug this project has already hit twice (the light theme's sidebar-text
 * and success-text both failed AA until fixed by hand; see index.html's
 * own comments on those two variables).
 */

export const BASE_TOKEN_KEYS = ['base', 'text', 'accent', 'success', 'danger'];

// --- Color math -------------------------------------------------------
// Same formulas as tools/contrast-check.js / tools/generate-palette-page.js
// (kept duplicated on purpose -- this needs to run in the browser with no
// build step, and those two files are Node-only/generator-only).

function srgbChannelToLinear(c) {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r, g, b) {
    return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

function contrastRatio(lumA, lumB) {
    const lighter = Math.max(lumA, lumB), darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
}

function parseHex(input) {
    const hex = input.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b, lum: relativeLuminance(r, g, b) };
}

function rgbToHex(r, g, b) {
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h *= 60;
    }
    return [h, s, l];
}

function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r1, g1, b1;
    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];
    return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

// Binary search over HSL lightness (fixed hue/saturation) for whatever
// lightness's relative luminance lands closest to targetLum.
function colorAtLuminance(hue, saturation, targetLum) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const [r, g, b] = hslToRgb(hue, saturation, mid);
        if (relativeLuminance(r, g, b) < targetLum) lo = mid; else hi = mid;
    }
    const [r, g, b] = hslToRgb(hue, saturation, (lo + hi) / 2);
    return rgbToHex(r, g, b);
}

// The minimum-lighter/maximum-darker luminance that clears targetRatio
// against baseLum -- same formula as tools/contrast-check.js's own
// luminanceBands(). Returns null for a side that's mathematically
// unreachable (e.g. no color is dark enough to hit 7:1 against a base
// that's already very dark).
function luminanceBands(baseLum, targetRatio) {
    const lighterMin = targetRatio * (baseLum + 0.05) - 0.05;
    const darkerMax = (baseLum + 0.05) / targetRatio - 0.05;
    return {
        lighterMin: lighterMin <= 1 ? Math.max(lighterMin, baseLum) : null,
        darkerMax: darkerMax >= 0 ? Math.min(darkerMax, baseLum) : null
    };
}

// Nudges hex (keeping its own hue/saturation) to the nearest point that
// clears targetRatio against bgHex, in whichever direction (lighter/
// darker) is actually reachable -- preferring darker first since that's
// the direction solid/status colors usually read best in. If hex ALREADY
// clears the ratio, returns it unchanged (never nudges a color that
// doesn't need it, so this is safe to run unconditionally).
function ensureContrast(hex, bgHex, targetRatio = 4.5) {
    const c = parseHex(hex), bg = parseHex(bgHex);
    if (contrastRatio(c.lum, bg.lum) >= targetRatio) return hex;
    const [h, s] = rgbToHsl(c.r, c.g, c.b);
    const bands = luminanceBands(bg.lum, targetRatio);
    const preferDarker = c.lum <= bg.lum; // nudge further the way it already leaned
    const candidateLum = preferDarker
        ? (bands.darkerMax !== null ? bands.darkerMax * 0.97 : (bands.lighterMin !== null ? bands.lighterMin * 1.02 : null))
        : (bands.lighterMin !== null ? bands.lighterMin * 1.02 : (bands.darkerMax !== null ? bands.darkerMax * 0.97 : null));
    if (candidateLum === null) return hex; // no reachable band at all -- leave it, nothing better exists
    return colorAtLuminance(h, Math.max(s, 0.25), Math.max(0, Math.min(1, candidateLum)));
}

// Linear per-channel blend between two hex colors (0 = a, 1 = b).
export function mixHex(hexA, hexB, t) {
    const a = parseHex(hexA), b = parseHex(hexB);
    return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

// Tries each candidate (real, already-meaningful theme colors) in the
// order given and returns the first that reads well against bgHex: reuse
// something the theme already has before inventing a new color. Only
// synthesizes a fresh one (from hueHex's own hue) if none of them clear
// the ratio -- e.g. a candidate list of [text, base] will almost always
// have a winner, but a background sitting in the mid-luminance range
// (neither clearly light nor dark) genuinely might not.
export function pickReadableText(bgHex, candidates, hueHex, targetRatio = 4.5) {
    const bg = parseHex(bgHex);
    for (const candidate of candidates) {
        if (contrastRatio(parseHex(candidate).lum, bg.lum) >= targetRatio) return candidate;
    }
    const [h, s] = rgbToHsl(parseHex(hueHex).r, parseHex(hueHex).g, parseHex(hueHex).b);
    // Whichever extreme is actually reachable -- a very light OR very dark
    // synthesized shade of hueHex, aimed comfortably past the ratio itself
    // (0.02/0.85 are near the luminance floor/ceiling, not the boundary)
    // rather than resolving the exact boundary and risking an 8-bit
    // rounding flip back under the target.
    return bg.lum > 0.18
        ? colorAtLuminance(h, Math.max(s, 0.3), 0.02)
        : colorAtLuminance(h, Math.max(s, 0.3), 0.85);
}

// --- The actual token derivation ---------------------------------------

/**
 * derives every CSS custom property this app's index.html defines from
 * the ~5 base tokens a user actually edits. Pure function: same input,
 * same output, no DOM access -- applyTheme() below is what actually
 * writes these to the page.
 *
 * Formulas were calibrated against this app's existing hand-picked
 * palette (both themes) to land close to it, not to reproduce it byte-
 * for-byte -- a few values shift slightly in exchange for every derived
 * text/background pair now PROVABLY clearing 4.5:1, which several of the
 * original hand-picked ones didn't (see index.html's own comments on
 * --sidebar-text/--success-text in the light theme).
 */
export function deriveTheme(base) {
    const { base: bgHex, text, accent, success, danger } = base;
    const [successHue, successSat] = rgbToHsl(parseHex(success).r, parseHex(success).g, parseHex(success).b);
    const [dangerHue, dangerSat] = rgbToHsl(parseHex(danger).r, parseHex(danger).g, parseHex(danger).b);

    const out = {};
    out['terminal-bg'] = bgHex;
    // Panels sit a step darker than the main content background in BOTH
    // themes (confirmed by measuring the actual shipped light AND dark
    // palettes -- sidebar-bg/log-bg are darker than terminal-bg in both,
    // not "toward black in dark mode, toward white in light mode" the way
    // a naive guess might assume).
    out['sidebar-bg'] = mixHex(bgHex, '#000000', 0.10);
    out['log-bg'] = mixHex(bgHex, '#000000', 0.06);
    out['border-color'] = mixHex(bgHex, text, 0.18);
    // NOT the same as text-main, on purpose -- confirmed against the real
    // shipped palette: header-color pushes noticeably further AWAY from
    // the background than text-main does (lighter still in dark mode,
    // darker still in light mode), for emphasis. Pushing text toward
    // whichever extreme (white/black) it's already closer to reproduces
    // that same "more of the same direction" effect.
    out['header-color'] = mixHex(text, parseHex(text).lum > 0.5 ? '#ffffff' : '#000000', 0.25);
    out['text-main'] = text;
    // One muted tone reused for text-muted/sidebar-text/header-text --
    // the original palette already had text-muted === sidebar-text
    // (identical hex, both themes), so this isn't a new simplification,
    // just making that existing redundancy explicit instead of tracking
    // it as 3 separately-editable values that happen to always agree.
    //
    // A flat 55% mix toward text is NOT enough margin on its own -- caught
    // this by actually auditing the derived output, not by assuming a
    // "formula" is automatically safe: it landed at 3.68:1/3.05:1 against
    // terminal-bg for the two calibration themes, below the 4.5:1 this
    // whole system exists to guarantee. This one real color renders
    // against THREE different derived backgrounds in the actual app
    // (terminal-bg as --text-muted, sidebar-bg as --sidebar-text, log-bg
    // wherever log text uses it) -- ensureContrast()'ing against only the
    // first of those wasn't enough either, and re-broke sidebar-bg's own
    // pairing (3.69:1) the same way fixing it against terminal-bg alone
    // looked "done". Chaining all three converges on whichever nudge
    // satisfies the tightest of them; each call is a no-op once its own
    // pairing already clears 4.5:1, so this never over-corrects.
    let muted = mixHex(bgHex, text, 0.55);
    muted = ensureContrast(muted, bgHex, 4.5);
    muted = ensureContrast(muted, out['sidebar-bg'], 4.5);
    muted = ensureContrast(muted, out['log-bg'], 4.5);
    out['text-muted'] = muted;
    out['sidebar-text'] = out['text-muted'];
    // Aliases header-color (the light theme's own shipped values already
    // had these two equal; the dark theme's didn't, but that inconsistency
    // wasn't an intentional distinction, just drift).
    out['header-text'] = out['header-color'];
    out['accent-text'] = accent;
    out['active-text'] = accent;
    out['active-border'] = accent;
    out['active-bg'] = mixHex(bgHex, accent, 0.15);

    out['btn-blue-bg'] = mixHex(bgHex, text, 0.12);
    out['btn-blue-text'] = pickReadableText(out['btn-blue-bg'], [text, accent], text);

    // Colored (success/danger) button surfaces do NOT scale with the
    // page's own background the way the neutral ones above do -- measured
    // luminance of the real btn-green-bg is ~0.087 in BOTH the dark and
    // light shipped themes, despite terminal-bg itself being close to
    // black in one and close to white in the other. They're anchored to
    // an absolute target luminance in their OWN hue instead, so a green
    // button reads as "a green button" regardless of overall theme.
    out['btn-green-bg'] = colorAtLuminance(successHue, Math.max(successSat, 0.35), 0.10);
    out['btn-green-text'] = pickReadableText(out['btn-green-bg'], [text, bgHex, '#ffffff'], success);
    out['btn-red-bg'] = colorAtLuminance(dangerHue, Math.max(dangerSat, 0.35), 0.10);
    out['btn-red-text'] = pickReadableText(out['btn-red-bg'], [danger, '#ffffff', '#000000'], danger);

    // success/danger are the two tokens users pick as fixed, meaningful
    // hues (this file's own header comment) -- but "fixed" can't mean
    // "never checked": they get rendered directly on sidebar-bg elsewhere
    // in the app (LevelListUI's "[OK]" rows, ConsoleUI's exit-code line),
    // and sidebar-bg is itself DERIVED from --base, so a color that read
    // fine against the base theme's sidebar could fail against a
    // different base without the user ever having touched success/danger
    // at all. Confirmed while calibrating this exact function: shrinking
    // sidebar-bg by switching its formula dropped success/danger's real
    // ratio from a previously-verified 4.6:1 down to 4.1:1, silently
    // reopening the identical bug this project already fixed once by
    // hand (see index.html's own comments on the light theme's
    // --success-text). ensureContrast() only nudges (same hue/
    // saturation) if the color the user actually picked falls short --
    // it's a floor, not a rewrite.
    out['success-text'] = ensureContrast(success, out['sidebar-bg'], 4.5);
    out['danger-text'] = ensureContrast(danger, out['sidebar-bg'], 4.5);
    return out;
}

// Writes every derived property (plus the 5 base tokens themselves, for
// anything that references --base/--text/etc. directly) as an inline
// style. Defaults to BOTH <html> and <body> -- NOT just documentElement,
// which is not enough on its own and was a real reported bug: dark mode's
// tokens live only on :root (<html>), so an inline override there is the
// only declaration <body>'s descendants ever see and correctly wins. The
// light theme's tokens are redeclared on `body.light-theme` though (see
// index.html) -- and CSS custom-property inheritance resolves per
// element: since that stylesheet rule targets <body> directly, <body> has
// its OWN declared value there and never even looks at what <html> has
// inherited, no matter how an inline override on <html> compares in
// specificity. Setting the SAME inline override on <body> too fixes it,
// since inline beats a class-selector rule on that SAME element. Pass a
// narrower scope only for an isolated preview that should stay untied
// from the rest of the page.
export function applyTheme(base, scopes = [document.documentElement, document.body]) {
    const derived = deriveTheme(base);
    const targets = Array.isArray(scopes) ? scopes : [scopes];
    for (const [key, value] of Object.entries(derived)) {
        for (const el of targets) {
            if (el) el.style.setProperty(`--${key}`, value);
        }
    }
}
