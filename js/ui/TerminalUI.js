import { globalEventBus } from '../core/EventBus.js';

export class TerminalUI {
    constructor(compilerBloc, fsBloc, serialBloc, apiUrl) {
        this.compilerBloc = compilerBloc;
        this.fsBloc = fsBloc;
        this.serialBloc = serialBloc;
        this.apiUrl = apiUrl;

        this.logBox = document.getElementById('logBox');
        this.flashBtn = document.getElementById('flashBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.downloadZipBtn = document.getElementById('downloadZipBtn');
        this.terminalPane = document.getElementById('terminalPane');
        this.toggleTerminalBtn = document.getElementById('toggleTerminalBtn');
        this.clearLogBtn = document.getElementById('clearLogBtn');

        // Logs / Serial Monitor tabs (share the same panel, one visible at a time)
        this.logsTabBtn = document.getElementById('logsTabBtn');
        this.serialTabBtn = document.getElementById('serialTabBtn');
        this.logsControls = document.getElementById('logsControls');
        this.serialControls = document.getElementById('serialControls');
        this.serialOutput = document.getElementById('serialOutput');

        this.initEventListeners();
        this.initTabSwitching();
        this.initEventBusSubscribers();

        this.compilerBloc.subscribe(this.render.bind(this));
    }

    initTabSwitching() {
        if (this.logsTabBtn) {
            this.logsTabBtn.onclick = () => this.switchTerminalTab('logs');
        }
        if (this.serialTabBtn) {
            this.serialTabBtn.onclick = () => this.switchTerminalTab('serial');
        }
    }

    switchTerminalTab(tab) {
        const showLogs = tab === 'logs';

        if (this.logsTabBtn) this.logsTabBtn.classList.toggle('active', showLogs);
        if (this.serialTabBtn) this.serialTabBtn.classList.toggle('active', !showLogs);

        // Toggle 'flex'/'hidden' together (never leave both, or neither, applied --
        // Tailwind's utility order between two same-specificity display classes
        // isn't something to rely on).
        this.toggleFlexVisible(this.logsControls, showLogs);
        this.toggleFlexVisible(this.serialControls, !showLogs);

        if (this.logBox) this.logBox.classList.toggle('hidden', !showLogs);
        if (this.serialOutput) this.serialOutput.classList.toggle('hidden', showLogs);
    }

    toggleFlexVisible(el, show) {
        if (!el) return;
        el.classList.toggle('hidden', !show);
        el.classList.toggle('flex', show);
    }

    initEventListeners() {
        if (this.flashBtn) {
            this.flashBtn.onclick = async () => {
                const fsState = this.fsBloc.state;
                const bin = await this.compilerBloc.compile(this.apiUrl, fsState.virtualFS);
                if (bin && this.serialBloc) {
                    this.serialBloc.flashBinary(bin);
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
                const isCollapsed = this.terminalPane.classList.contains('h-8');
                if (isCollapsed) {
                    this.terminalPane.classList.remove('h-8');
                    this.terminalPane.classList.add('h-48');
                    this.toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(0deg)';
                } else {
                    this.terminalPane.classList.remove('h-48');
                    this.terminalPane.classList.add('h-8');
                    this.toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(180deg)';
                }
            };
        }

        if (this.clearLogBtn && this.logBox) {
            this.clearLogBtn.onclick = () => {
                this.logBox.innerHTML = '';
            };
        }
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
                // Restore FLASH button according to hardware connection state
                // (HardwareUI owns the connect/disconnect gating; we only restore the icon here)
                const isConnected = !!(this.serialBloc && this.serialBloc.state.isConnected);
                this.flashBtn.innerHTML = `<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H7V4h10v16zM8 6h8v2H8zm0 4h8v2H8zm0 4h5v2H8z"/></svg> FLASH to APM32`;
                this.flashBtn.disabled = !isConnected;
                this.flashBtn.classList.toggle('opacity-50', !isConnected);
                this.flashBtn.classList.toggle('cursor-not-allowed', !isConnected);

                this.downloadBtn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
                this.downloadBtn.disabled = false;
                this.downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        globalEventBus.on('MEMORY_USAGE', (payload) => {
            this.updateResourceUsage(payload.flashUsed, payload.ramUsed);
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

        if (flashBar) flashBar.style.width = flashPercent + '%';
        if (flashText) flashText.innerText = flashPercent + '%';
        if (ramBar) ramBar.style.width = ramPercent + '%';
        if (ramText) ramText.innerText = ramPercent + '%';
    }

    render(state) {
        // Compiler UI state is mostly handled via event bus for rapid updates
    }

    logMessage(msg, type="info") {
        if (!this.logBox) return;
        const div = document.createElement('div');
        div.className = "mb-1 text-sm border-l-2 pl-2 ";

        // The dark-mode -400 shades (bright pastels) read fine on near-black but
        // wash out on the light theme's white background -- swap for a darker,
        // WCAG-friendlier shade of the same hue when light-theme is active.
        const isDark = !document.body.classList.contains('light-theme');
        switch (type) {
            case 'error': div.className += isDark ? "border-red-500 text-red-400" : "border-red-600 text-red-700"; break;
            case 'warn': div.className += isDark ? "border-yellow-500 text-yellow-400" : "border-yellow-600 text-yellow-700"; break;
            case 'success': div.className += isDark ? "border-green-500 text-green-400" : "border-green-600 text-green-700"; break;
            default: div.className += isDark ? "border-blue-500 text-blue-300" : "border-blue-600 text-blue-700"; break;
        }

        // Inline style (not a Tailwind arbitrary-value class) so it doesn't depend
        // on the CDN JIT re-scanning classes injected via innerHTML at runtime.
        const timestamp = new Date().toLocaleTimeString();
        div.innerHTML = `<span class="text-xs" style="color: var(--sidebar-text); opacity: 0.6;">[${timestamp}]</span> ${msg}`;
        this.logBox.appendChild(div);
        this.logBox.scrollTop = this.logBox.scrollHeight;
    }
}
