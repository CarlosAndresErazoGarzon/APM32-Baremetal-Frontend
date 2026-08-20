/**
 * HardwareUI.js
 * Wires the top-bar hardware lifecycle: LINK/STOP is the WebUSB DAP link
 * (DapBloc), required before FLASH is enabled -- a completely separate
 * connection from the console/serial monitor (SerialBloc, owned by
 * SerialUI.js). Also owns the Recovery Mode (mass erase) instructions
 * modal, unrelated to either connection.
 */
export class HardwareUI {
    constructor(dapBloc) {
        this.dapBloc = dapBloc;

        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.flashBtn = document.getElementById('flashBtn');
        this.coreStateTag = document.getElementById('coreStateTag');

        this.recoveryModal = document.getElementById('recoveryModal');
        this.recoveryModeBtn = document.getElementById('recoveryModeBtn');
        this.closeRecoveryBtn = document.getElementById('closeRecoveryBtn');

        this.initEventListeners();
        this.dapBloc.subscribe(this.render.bind(this));
    }

    initEventListeners() {
        if (this.connectBtn) {
            this.connectBtn.onclick = () => this.dapBloc.connect();
        }

        if (this.disconnectBtn) {
            this.disconnectBtn.onclick = () => this.dapBloc.disconnect();
        }

        if (this.recoveryModeBtn && this.recoveryModal) {
            this.recoveryModeBtn.onclick = () => this.recoveryModal.classList.remove('hidden');
        }

        if (this.closeRecoveryBtn && this.recoveryModal) {
            this.closeRecoveryBtn.onclick = () => this.recoveryModal.classList.add('hidden');
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.recoveryModal) this.recoveryModal.classList.add('hidden');
        });
    }

    render(state) {
        if (this.disconnectBtn) {
            this.disconnectBtn.classList.toggle('hidden', !state.isConnected);
        }

        // flashBtn's own "Flashing..." disabled state (TerminalUI.js) takes
        // over for the duration of an actual flash -- this just gates on
        // whether there's a USB link to flash over at all.
        if (this.flashBtn) {
            this.flashBtn.disabled = !state.isConnected;
            this.flashBtn.classList.toggle('opacity-50', !state.isConnected);
            this.flashBtn.classList.toggle('cursor-not-allowed', !state.isConnected);
        }

        this.updateCoreState(state.coreState);
    }

    // Flat bracketed text, no badge/pill -- matches the rest of the
    // MHRD-style status indicators (coreStateTag, [OK], [M01], ...).
    // state.coreState is real DHCSR register-polling data from DapBloc now,
    // not just an isConnected proxy.
    updateCoreState(label) {
        if (!this.coreStateTag) return;

        this.coreStateTag.innerText = `[${label.toUpperCase()}]`;
        this.coreStateTag.className = "text-[10px] font-mono font-bold transition-colors duration-300";
        this.coreStateTag.classList.add(label === 'Running' ? 'text-[var(--success-text)]' : 'text-[var(--sidebar-text)]');
    }
}
