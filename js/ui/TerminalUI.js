import { globalEventBus } from '../core/EventBus.js';
import { toggleFlexVisible } from '../core/domUtils.js';

// Renders the Telemetry column's Flash/RAM meters as a row of SVG
// segments (a terminal VU-meter look) instead of one <div style="width:%">
// bar -- genuinely easier to get right as SVG than as a %-width fill,
// since each segment is an independent lit/unlit mark rather than one
// element whose width has to be computed and animated.
const METER_SEGMENTS = 25;
const METER_SEG_WIDTH = 6;
const METER_GAP = 2;

function renderMeter(svgEl, percent) {
    if (!svgEl) return;
    const pitch = METER_SEG_WIDTH + METER_GAP;
    const lit = Math.round((percent / 100) * METER_SEGMENTS);
    let rects = '';
    for (let i = 0; i < METER_SEGMENTS; i++) {
        const fill = i < lit ? 'var(--success-text)' : 'var(--track-bg)';
        rects += `<rect x="${i * pitch}" y="0" width="${METER_SEG_WIDTH}" height="6" style="fill:${fill}"></rect>`;
    }
    svgEl.innerHTML = rects;
}

export class TerminalUI {
    constructor(compilerBloc, fsBloc, dapBloc, apiUrl, modeBloc) {
        this.compilerBloc = compilerBloc;
        this.fsBloc = fsBloc;
        this.dapBloc = dapBloc;
        this.apiUrl = apiUrl;
        this.modeBloc = modeBloc;

        this.logBox = document.getElementById('logBox');
        this.flashBtn = document.getElementById('flashBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.downloadZipBtn = document.getElementById('downloadZipBtn');
        this.terminalPane = document.getElementById('terminalPane');
        this.toggleTerminalBtn = document.getElementById('toggleTerminalBtn');
        this.clearLogBtn = document.getElementById('clearLogBtn');

        // Logs / Serial Monitor / Results / Terminal tabs (share the same panel, one visible at a time)
        this.logsTabBtn = document.getElementById('logsTabBtn');
        this.serialTabBtn = document.getElementById('serialTabBtn');
        this.resultsTabBtn = document.getElementById('resultsTabBtn');
        this.consoleTabBtn = document.getElementById('consoleTabBtn');
        this.logsControls = document.getElementById('logsControls');
        this.serialControls = document.getElementById('serialControls');
        this.resultsControls = document.getElementById('resultsControls');
        this.consoleControls = document.getElementById('consoleControls');
        this.serialOutput = document.getElementById('serialOutput');
        this.resultsOutput = document.getElementById('resultsOutput');
        this.consolePanel = document.getElementById('consolePanel');
        this.consoleCommandInput = document.getElementById('consoleCommandInput');

        this.currentTab = 'logs';
        // COMPILER_STATUS flips back to "not compiling" as soon as the /compile
        // HTTP call finishes -- well before DapBloc.flash()'s actual DAP
        // session completes. That's what let the button look normal and
        // clickable while a flash was still in flight, inviting a second
        // overlapping click. This flag is how the COMPILER_STATUS handler
        // below knows not to re-enable it yet.
        this.isFlashing = false;

        // Paint the meters' initial all-unlit state -- they're SVG now, so
        // (unlike the old %-width div, empty-by-default in plain CSS)
        // something has to actually render the 0% segments once up front.
        this.updateResourceUsage(0, 0);

        this.initEventListeners();
        this.initTabSwitching();
        this.initEventBusSubscribers();

        this.compilerBloc.subscribe(this.render.bind(this));
        if (this.modeBloc) this.modeBloc.subscribe(this.onModeChange.bind(this));
    }

    initTabSwitching() {
        if (this.logsTabBtn) {
            this.logsTabBtn.onclick = () => this.switchTerminalTab('logs');
        }
        if (this.serialTabBtn) {
            this.serialTabBtn.onclick = () => this.switchTerminalTab('serial');
        }
        if (this.resultsTabBtn) {
            this.resultsTabBtn.onclick = () => this.switchTerminalTab('results');
        }
        if (this.consoleTabBtn) {
            this.consoleTabBtn.onclick = () => this.switchTerminalTab('console');
        }
    }

    switchTerminalTab(tab) {
        this.currentTab = tab;

        if (this.logsTabBtn) this.logsTabBtn.classList.toggle('active', tab === 'logs');
        if (this.serialTabBtn) this.serialTabBtn.classList.toggle('active', tab === 'serial');
        if (this.resultsTabBtn) this.resultsTabBtn.classList.toggle('active', tab === 'results');
        if (this.consoleTabBtn) this.consoleTabBtn.classList.toggle('active', tab === 'console');

        toggleFlexVisible(this.logsControls, tab === 'logs');
        toggleFlexVisible(this.serialControls, tab === 'serial');
        toggleFlexVisible(this.resultsControls, tab === 'results');
        toggleFlexVisible(this.consoleControls, tab === 'console');

        if (this.logBox) this.logBox.classList.toggle('hidden', tab !== 'logs');
        if (this.serialOutput) this.serialOutput.classList.toggle('hidden', tab !== 'serial');
        if (this.resultsOutput) this.resultsOutput.classList.toggle('hidden', tab !== 'results');
        if (this.consolePanel) this.consolePanel.classList.toggle('hidden', tab !== 'console');

        // Land the cursor right on the prompt when switching in, like a
        // real terminal grabbing focus -- but only while the pane is
        // actually expanded. Two reasons: focusing an invisible input is
        // pointless, and calling .focus() on an element clipped inside the
        // collapsed pane's overflow:hidden (no scrollable ancestor to
        // satisfy it) made the browser's default scroll-into-view behavior
        // misplace #terminalHeader instead -- confirmed by reproducing it
        // with/without this call. preventScroll as a second, defensive
        // layer in case some other path ever focuses this while collapsed.
        const isCollapsed = this.terminalPane && this.terminalPane.classList.contains('h-8');
        if (tab === 'console' && this.consoleCommandInput && !isCollapsed) {
            this.consoleCommandInput.focus({ preventScroll: true });
        }
    }

    // Learn mode is the only place the Results tab is even visible, and
    // Playground the only place the Terminal tab is (see ModeSwitcherUI) --
    // if the user flips to a mode where the currently-parked tab isn't even
    // visible, land somewhere that still is instead of a hidden pane.
    // Conversely, entering Learn mode lands straight on Results (that's the
    // panel Learn mode actually cares about) instead of wherever the
    // terminal happened to be left.
    onModeChange(modeState) {
        if (modeState.mode === 'ide' && (this.currentTab === 'results' || this.currentTab === 'console')) {
            this.switchTerminalTab('logs');
        } else if (modeState.mode === 'learn') {
            // Unconditional -- entering Learn mode always lands on Results
            // (that's the panel it actually cares about), regardless of
            // whichever tab the terminal was previously parked on.
            this.switchTerminalTab('results');
        } else if (modeState.mode === 'playground') {
            // Unconditional -- entering Playground mode always lands on the
            // Terminal tab (that's the panel students actually work in
            // there), same reasoning as Learn mode's unconditional landing
            // on Results above.
            this.switchTerminalTab('console');
        }
    }

    expandTerminalPane() {
        if (!this.terminalPane) return;
        this.terminalPane.classList.remove('h-8');
        this.terminalPane.classList.add('h-64');
        const svg = this.toggleTerminalBtn && this.toggleTerminalBtn.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(0deg)';
    }

    collapseTerminalPane() {
        if (!this.terminalPane) return;
        this.terminalPane.classList.remove('h-64');
        this.terminalPane.classList.remove('h-48');
        this.terminalPane.classList.add('h-8');
        const svg = this.toggleTerminalBtn && this.toggleTerminalBtn.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(180deg)';
    }

    initEventListeners() {
        if (this.flashBtn) {
            this.flashBtn.onclick = async () => {
                const fsState = this.fsBloc.state;
                const bin = await this.compilerBloc.compile(this.apiUrl, fsState.virtualFS);
                if (bin && this.dapBloc) {
                    this.isFlashing = true;
                    this.flashBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Flashing...`;
                    this.flashBtn.disabled = true;
                    this.flashBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    try {
                        // Awaited (not fire-and-forget) specifically so this
                        // finally block -- not COMPILER_STATUS -- is what
                        // re-enables the button, only once flashing (not just
                        // compiling) has actually finished.
                        await this.dapBloc.flash(bin);
                    } finally {
                        this.isFlashing = false;
                        this.restoreFlashButton();
                    }
                }
            };
        }

        if (this.downloadBtn) {
            this.downloadBtn.onclick = async () => {
                const fsState = this.fsBloc.state;
                const bin = await this.compilerBloc.compile(this.apiUrl, fsState.virtualFS);
                if (bin) {
                    this.compilerBloc.downloadBin(bin);
                }
            };
        }

        if (this.downloadZipBtn) {
            this.downloadZipBtn.onclick = () => {
                const fsState = this.fsBloc.state;
                this.compilerBloc.downloadZip(fsState.virtualFS);
            };
        }

        if (this.toggleTerminalBtn && this.terminalPane) {
            this.toggleTerminalBtn.onclick = () => {
                if (this.terminalPane.classList.contains('h-8')) {
                    this.expandTerminalPane();
                } else {
                    this.collapseTerminalPane();
                }
            };
        }

        if (this.clearLogBtn && this.logBox) {
            this.clearLogBtn.onclick = () => {
                this.logBox.innerHTML = '';
            };
        }
    }

    // Restore FLASH button according to hardware connection state (HardwareUI
    // owns the connect/disconnect gating; we only restore the icon here).
    // Shared by the COMPILER_STATUS handler and the flashBtn click handler's
    // own finally block.
    restoreFlashButton() {
        const isConnected = !!(this.dapBloc && this.dapBloc.state.isConnected);
        this.flashBtn.innerHTML = `<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H7V4h10v16zM8 6h8v2H8zm0 4h8v2H8zm0 4h5v2H8z"/></svg> FLASH to APM32`;
        this.flashBtn.disabled = !isConnected;
        this.flashBtn.classList.toggle('opacity-50', !isConnected);
        this.flashBtn.classList.toggle('cursor-not-allowed', !isConnected);
    }

    initEventBusSubscribers() {
        globalEventBus.on('LOG', (payload) => {
            this.logMessage(payload.message, payload.type);
        });

        globalEventBus.on('COMPILER_STATUS', (payload) => {
            if (payload.status === 'compiling') {
                this.flashBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Compiling...`;
                this.flashBtn.disabled = true;
                this.flashBtn.classList.add('opacity-50', 'cursor-not-allowed');

                this.downloadBtn.innerHTML = `<svg class="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                this.downloadBtn.disabled = true;
                this.downloadBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                // Compiling finished -- but if a flash is still actually in
                // flight (see isFlashing's own comment), leave the button in
                // its "Flashing..." state; the onclick handler's own finally
                // block is what restores it once dapBloc.flash() truly resolves.
                if (!this.isFlashing) this.restoreFlashButton();

                this.downloadBtn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
                this.downloadBtn.disabled = false;
                this.downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        globalEventBus.on('MEMORY_USAGE', (payload) => {
            this.updateResourceUsage(payload.flashUsed, payload.ramUsed);
        });

        // Run Tests just finished (LearnBloc.runTests emits this on both
        // compile error and a normal grading pass) -- jump straight to the
        // Results tab and make sure the panel is actually open. Previously
        // this only got a log line telling the student to go click the tab
        // themselves ("Revisa la pestaña Results"), so a finished run could
        // sit invisible one click away.
        globalEventBus.on('LEARN_RESULT', () => {
            this.switchTerminalTab('results');
            if (this.terminalPane && this.terminalPane.classList.contains('h-8')) {
                this.expandTerminalPane();
            }
        });
    }

    updateResourceUsage(flashUsed, ramUsed) {
        const flashMax = 128 * 1024; // APM32F103C8T6: 128KB Flash
        const ramMax = 20 * 1024;    // APM32F103C8T6: 20KB RAM

        const flashPercent = (flashUsed / flashMax * 100).toFixed(1);
        const ramPercent = (ramUsed / ramMax * 100).toFixed(1);

        const flashBar = document.getElementById('flashUsageBar');
        const flashText = document.getElementById('flashUsageText');
        const ramBar = document.getElementById('ramUsageBar');
        const ramText = document.getElementById('ramUsageText');

        renderMeter(flashBar, flashPercent);
        if (flashText) flashText.innerText = flashPercent + '%';
        renderMeter(ramBar, ramPercent);
        if (ramText) ramText.innerText = ramPercent + '%';
    }

    render(state) {
        // Compiler UI state is mostly handled via event bus for rapid updates
    }

    logMessage(msg, type="info") {
        if (!this.logBox) return;
        const div = document.createElement('div');
        const isDark = !document.body.classList.contains('light-theme');
        // Message text always stays the base reading color -- only the
        // left border strip carries the error/warn/success color coding
        // now, so a log full of colored text doesn't compete with itself
        // for attention. The border itself still needs isDark-aware shades
        // (a light-mode near-white background needs darker strip colors
        // than dark mode's near-black one to stay visible).
        div.className = `mb-1 text-[11px] font-mono border-l-2 pl-2 text-[var(--text-main)] ${isDark ? "" : "font-medium"} leading-relaxed `;

        switch (type) {
            case 'error': div.className += isDark ? "border-red-400" : "border-red-600"; break;
            case 'warn': div.className += isDark ? "border-yellow-400" : "border-amber-600"; break;
            case 'success': div.className += isDark ? "border-emerald-400" : "border-emerald-700"; break;
            default: div.className += "border-[var(--border-color)]"; break;
        }

        const timestamp = new Date().toLocaleTimeString();
        const timeColor = isDark ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]";
        div.innerHTML = `<span class="text-[10px] ${timeColor} font-mono select-none mr-1.5">[${timestamp}]</span><span>${msg}</span>`;
        this.logBox.appendChild(div);
        this.logBox.scrollTop = this.logBox.scrollHeight;
    }
}
