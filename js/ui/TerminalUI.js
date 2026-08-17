import { globalEventBus } from '../core/EventBus.js';
import { toggleFlexVisible } from '../core/domUtils.js';

export class TerminalUI {
    constructor(compilerBloc, fsBloc, serialBloc, apiUrl, modeBloc) {
        this.compilerBloc = compilerBloc;
        this.fsBloc = fsBloc;
        this.serialBloc = serialBloc;
        this.apiUrl = apiUrl;
        this.modeBloc = modeBloc;

        this.logBox = document.getElementById('logBox');
        this.flashBtn = document.getElementById('flashBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.downloadZipBtn = document.getElementById('downloadZipBtn');
        this.terminalPane = document.getElementById('terminalPane');
        this.toggleTerminalBtn = document.getElementById('toggleTerminalBtn');
        this.clearLogBtn = document.getElementById('clearLogBtn');

        // Logs / Serial Monitor / Results tabs (share the same panel, one visible at a time)
        this.logsTabBtn = document.getElementById('logsTabBtn');
        this.serialTabBtn = document.getElementById('serialTabBtn');
        this.resultsTabBtn = document.getElementById('resultsTabBtn');
        this.logsControls = document.getElementById('logsControls');
        this.serialControls = document.getElementById('serialControls');
        this.resultsControls = document.getElementById('resultsControls');
        this.serialOutput = document.getElementById('serialOutput');
        this.resultsOutput = document.getElementById('resultsOutput');

        this.currentTab = 'logs';

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
    }

    switchTerminalTab(tab) {
        this.currentTab = tab;

        if (this.logsTabBtn) this.logsTabBtn.classList.toggle('active', tab === 'logs');
        if (this.serialTabBtn) this.serialTabBtn.classList.toggle('active', tab === 'serial');
        if (this.resultsTabBtn) this.resultsTabBtn.classList.toggle('active', tab === 'results');

        toggleFlexVisible(this.logsControls, tab === 'logs');
        toggleFlexVisible(this.serialControls, tab === 'serial');
        toggleFlexVisible(this.resultsControls, tab === 'results');

        if (this.logBox) this.logBox.classList.toggle('hidden', tab !== 'logs');
        if (this.serialOutput) this.serialOutput.classList.toggle('hidden', tab !== 'serial');
        if (this.resultsOutput) this.resultsOutput.classList.toggle('hidden', tab !== 'results');
    }

    // Learn mode is the only place the Results tab is even visible (see
    // ModeSwitcherUI) -- if the user flips back to IDE mode while parked on
    // it, land somewhere that's still visible instead of a hidden pane.
    onModeChange(modeState) {
        if (modeState.mode === 'ide' && this.currentTab === 'results') {
            this.switchTerminalTab('logs');
        }
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
                    this.terminalPane.classList.add('h-64');
                    const svg = this.toggleTerminalBtn.querySelector('svg');
                    if (svg) svg.style.transform = 'rotate(0deg)';
                } else {
                    this.terminalPane.classList.remove('h-64');
                    this.terminalPane.classList.remove('h-48');
                    this.terminalPane.classList.add('h-8');
                    const svg = this.toggleTerminalBtn.querySelector('svg');
                    if (svg) svg.style.transform = 'rotate(180deg)';
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
        const isDark = !document.body.classList.contains('light-theme');
        div.className = `mb-1 text-[11px] font-mono border-l-2 pl-2 ${isDark ? "text-zinc-400" : "text-slate-700 font-medium"} leading-relaxed `;

        switch (type) {
            case 'error': div.className += isDark ? "border-red-500" : "border-red-600"; break;
            case 'warn': div.className += isDark ? "border-yellow-500" : "border-yellow-600"; break;
            case 'success': div.className += isDark ? "border-emerald-400" : "border-emerald-600"; break;
            default: div.className += isDark ? "border-zinc-600" : "border-slate-400"; break;
        }

        const timestamp = new Date().toLocaleTimeString();
        const timeColor = isDark ? "text-zinc-400" : "text-slate-500";
        div.innerHTML = `<span class="text-[10px] ${timeColor} font-mono select-none mr-1.5">[${timestamp}]</span><span class="${isDark ? 'text-zinc-400' : 'text-slate-700'}">${msg}</span>`;
        this.logBox.appendChild(div);
        this.logBox.scrollTop = this.logBox.scrollHeight;
    }
}
