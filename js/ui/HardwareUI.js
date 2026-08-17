/**
 * HardwareUI.js
 * Wires the top-bar hardware lifecycle: LINK/STOP (manual serial connect,
 * required before UPLOAD is enabled -- mirrors the previous WebUSB "link"
 * gating behavior, now backed by SerialBloc's WebSerial connection) and the
 * Recovery Mode (mass erase) instructions modal.
 */
export class HardwareUI {
    constructor(serialBloc) {
        this.serialBloc = serialBloc;

        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.flashBtn = document.getElementById('flashBtn');
        this.coreStateTag = document.getElementById('coreStateTag');

        this.recoveryModal = document.getElementById('recoveryModal');
        this.recoveryModeBtn = document.getElementById('recoveryModeBtn');
        this.closeRecoveryBtn = document.getElementById('closeRecoveryBtn');

        this.initEventListeners();
        this.serialBloc.subscribe(this.render.bind(this));
    }

    initEventListeners() {
        if (this.connectBtn) {
            this.connectBtn.onclick = () => {
                const baudSelect = document.getElementById('baudRate');
                const baudRate = baudSelect ? parseInt(baudSelect.value, 10) : 115200;
                this.serialBloc.connect(baudRate);
            };
        }

        if (this.disconnectBtn) {
            this.disconnectBtn.onclick = () => this.serialBloc.disconnect();
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

        if (this.flashBtn) {
            this.flashBtn.disabled = !state.isConnected;
            this.flashBtn.classList.toggle('opacity-50', !state.isConnected);
            this.flashBtn.classList.toggle('cursor-not-allowed', !state.isConnected);
        }

        this.updateCoreState(state.isConnected ? 'Running' : 'Idle');
    }

    // Flat bracketed text, no badge/pill -- matches the rest of the
    // MHRD-style status indicators (coreStateTag, [OK], [M01], ...).
    updateCoreState(label) {
        if (!this.coreStateTag) return;

        this.coreStateTag.innerText = `[${label.toUpperCase()}]`;
        this.coreStateTag.className = "text-[10px] font-mono font-bold transition-colors duration-300";
        this.coreStateTag.classList.add(label === 'Running' ? 'text-[var(--btn-green-text)]' : 'text-[var(--sidebar-text)]');
    }
}
