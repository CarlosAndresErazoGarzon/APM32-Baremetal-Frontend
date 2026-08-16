import { globalEventBus } from '../core/EventBus.js';

export class SerialUI {
    constructor(serialBloc) {
        this.serialBloc = serialBloc;

        this.serialConnectBtn = document.getElementById('serialConnectBtn');
        this.baudRateSelect = document.getElementById('baudRate');
        this.serialOutput = document.getElementById('serialOutput');
        this.serialInput = document.getElementById('serialInput');

        this.initEventListeners();
        this.initEventBusSubscribers();

        this.serialBloc.subscribe(this.render.bind(this));
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
                if (e.key === 'Enter') {
                    const val = this.serialInput.value;
                    if (val.trim() !== "") {
                        this.serialBloc.sendData(val);
                        // Echo to output locally
                        if (this.serialOutput) {
                            this.serialOutput.innerText += `> ${val}\\n`;
                            this.serialOutput.scrollTop = this.serialOutput.scrollHeight;
                        }
                        this.serialInput.value = '';
                    }
                }
            });
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
                this.serialOutput.innerText += `\\nFlashing... ${payload.progress}%\\n`;
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
