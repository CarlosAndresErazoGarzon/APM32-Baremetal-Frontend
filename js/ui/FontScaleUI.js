import {
    FONT_SCALE_STEP, FONT_SCALE_DEFAULT,
    clampFontScale, readStoredFontScale, persistFontScale, applyFontScale
} from '../core/fontScale.js';
import { globalEventBus } from '../core/EventBus.js';

/**
 * FontScaleUI
 * The [-] / percentage / [+] / Reset text-size control on the Ajustes
 * page (see fontScale.js for how/why -- CSS zoom, editor exempted).
 * Applies the stored value immediately on construction so a returning
 * visitor's preference takes effect on page load, not just after they
 * revisit Ajustes.
 */
export class FontScaleUI {
    constructor() {
        this.decreaseBtn = document.getElementById('fontScaleDecreaseBtn');
        this.increaseBtn = document.getElementById('fontScaleIncreaseBtn');
        this.resetBtn = document.getElementById('fontScaleResetBtn');
        this.valueEl = document.getElementById('fontScaleValue');

        this.scale = readStoredFontScale();
        this.render();

        if (this.decreaseBtn) this.decreaseBtn.onclick = () => this.setScale(this.scale - FONT_SCALE_STEP);
        if (this.increaseBtn) this.increaseBtn.onclick = () => this.setScale(this.scale + FONT_SCALE_STEP);
        if (this.resetBtn) this.resetBtn.onclick = () => this.setScale(FONT_SCALE_DEFAULT);
    }

    setScale(percent) {
        this.scale = clampFontScale(percent);
        persistFontScale(this.scale);
        this.render();
    }

    render() {
        applyFontScale(this.scale);
        if (this.valueEl) this.valueEl.textContent = `${this.scale}%`;
        // Broadcast for anything that caches a pixel size derived from the
        // zoom level and needs a nudge to recompute (a CSS zoom change
        // fires no resize event of its own). Monaco is deliberately
        // exempted from zoom entirely (see fontScale.js), so it doesn't
        // listen for this.
        globalEventBus.emit('FONT_SCALE_CHANGED');
    }
}
