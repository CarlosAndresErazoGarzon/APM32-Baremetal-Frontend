import { globalEventBus } from '../core/EventBus.js';

export class SerialUI {
    constructor(serialBloc) {
        this.serialBloc = serialBloc;

        this.serialConnectBtn = document.getElementById('serialConnectBtn');
        this.baudRateSelect = document.getElementById('baudRate');
        this.serialOutput = document.getElementById('serialOutput');
        this.serialInput = document.getElementById('serialInput');
        this.serialSendBtn = document.getElementById('serialSendBtn');
        this.serialClearBtn = document.getElementById('serialClearBtn');

        this.initEventListeners();
        this.initEventBusSubscribers();

        this.serialBloc.subscribe(this.render.bind(this));
    }

    // Shared by the Enter-key handler and the SEND button -- previously only
    // the keypress listener existed, so clicking SEND (instead of pressing
    // Enter) silently did nothing.
    sendCurrentInput() {
        if (!this.serialInput) return;
        const val = this.serialInput.value;
        if (val.trim() === "") return;

        this.serialBloc.sendData(val);
        // Echo to output locally. Real bug: this was `\\n` (a literal
        // backslash followed by "n", two visible characters) instead of an
        // actual newline `\n` -- every local echo showed the literal text
        // "\n" instead of breaking the line.
        if (this.serialOutput) {
            this.serialOutput.innerText += `> ${val}\n`;
            this.serialOutput.scrollTop = this.serialOutput.scrollHeight;
        }
        this.serialInput.value = '';
    }

    initEventListeners() {
        if (this.serialConnectBtn) {
            this.serialConnectBtn.onclick = () => {
                const baudRate = parseInt(this.baudRateSelect.value);
                this.serialBloc.connect(baudRate);
            };
        }

        if (this.serialInput) {
            this.serialInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendCurrentInput();
            });
        }

        if (this.serialSendBtn) {
            this.serialSendBtn.onclick = () => this.sendCurrentInput();
        }

        if (this.serialClearBtn) {
            this.serialClearBtn.onclick = () => {
                if (this.serialOutput) this.serialOutput.innerText = '';
            };
        }
    }

    initEventBusSubscribers() {
        globalEventBus.on('SERIAL_DATA_RECEIVED', (payload) => {
            if (this.serialOutput) {
                this.serialOutput.innerText += payload.data;
                this.serialOutput.scrollTop = this.serialOutput.scrollHeight;
            }
        });

        globalEventBus.on('FLASH_PROGRESS', (payload) => {
            if (this.serialOutput) {
                this.serialOutput.innerText += `\nFlashing... ${payload.progress}%\n`;
                this.serialOutput.scrollTop = this.serialOutput.scrollHeight;
            }
        });
    }

    render(state) {
        if (this.serialConnectBtn) {
            if (state.isConnected) {
                this.serialConnectBtn.innerText = 'Disconnect';
                this.serialConnectBtn.classList.add('text-red-400');
                this.updateSerialLed(true);
            } else {
                this.serialConnectBtn.innerText = 'Connect';
                this.serialConnectBtn.classList.remove('text-red-400');
                this.updateSerialLed(false);
            }
        }
    }

    updateSerialLed(connected) {
        const led = document.getElementById('serialStatusLed');
        if (!led) return;
        if (connected) {
            led.classList.remove('bg-gray-500');
            led.classList.add('bg-green-500', 'shadow-[0_0_8px_rgba(34,197,94,0.8)]');
        } else {
            led.classList.add('bg-gray-500');
            led.classList.remove('bg-green-500', 'shadow-[0_0_8px_rgba(34,197,94,0.8)]');
        }
    }
}
