import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';

export class SerialBloc extends Bloc {
    get initialState() {
        return {
            isConnected: false,
            port: null
        };
    }

    constructor() {
        super();
        this.serialReader = null;
        this.readLoopPromise = null;
    }

    async connect(baudRate) {
        if (this.state.isConnected) {
            await this.disconnect();
            return;
        }

        try {
            globalEventBus.emit('LOG', { message: "Requesting Serial permissions (Browser Security)...", type: 'warn' });
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate });
            
            this.emit({ isConnected: true, port });
            globalEventBus.emit('SERIAL_CONNECTED');
            
            // Start reading
            this._startReading(port);

        } catch (err) {
            globalEventBus.emit('LOG', { message: "Serial Error: " + err.message, type: 'error' });
            this.emit({ isConnected: false, port: null });
        }
    }

    async disconnect() {
        if (this.state.port) {
            if (this.serialReader) {
                await this.serialReader.cancel();
                this.serialReader = null;
            }
            if (this.readLoopPromise) {
                await this.readLoopPromise;
            }
            await this.state.port.close();
            this.emit({ isConnected: false, port: null });
            globalEventBus.emit('SERIAL_DISCONNECTED');
        }
    }

    async sendData(dataStr) {
        const port = this.state.port;
        if (!port || !port.writable) {
            globalEventBus.emit('LOG', { message: "Serial not connected or not writable", type: 'error' });
            return;
        }

        try {
            const encoder = new TextEncoder();
            const writer = port.writable.getWriter();
            await writer.write(encoder.encode(dataStr + '\\r\\n'));
            writer.releaseLock();
        } catch (err) {
            globalEventBus.emit('LOG', { message: "Write Error: " + err.message, type: 'error' });
        }
    }

    async _startReading(port) {
        const decoder = new TextDecoderStream();
        // We don't await pipeTo here, it runs continuously
        const inputDone = port.readable.pipeTo(decoder.writable);
        this.serialReader = decoder.readable.getReader();

        this.readLoopPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await this.serialReader.read();
                    if (done) break;
                    if (value) {
                        globalEventBus.emit('SERIAL_DATA_RECEIVED', { data: value });
                    }
                }
            } catch (error) {
                // Ignore DOMException errors that occur during disconnect
            } finally {
                this.serialReader.releaseLock();
            }
        })();
    }

    async flashBinary(binBuffer) {
        let port = this.state.port;
        const wasConnected = this.state.isConnected;

        if (!wasConnected) {
            globalEventBus.emit('LOG', { message: "Connecting to DAPLink...", type: 'info' });
            try {
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 115200 });
                this.emit({ isConnected: true, port });
            } catch (e) {
                globalEventBus.emit('LOG', { message: "Cannot open port for flashing: " + e.message, type: 'error' });
                return;
            }
        } else {
            // Must stop the serial reader before flashing
            if (this.serialReader) {
                await this.serialReader.cancel();
                this.serialReader = null;
                if (this.readLoopPromise) {
                    await this.readLoopPromise;
                }
            }
        }

        try {
            globalEventBus.emit('LOG', { message: "Initializing DAPLink...", type: 'warn' });
            
            // eslint-disable-next-line no-undef
            const transport = new DAPjs.WebSerialTransport(port);
            // eslint-disable-next-line no-undef
            const daplink = new DAPjs.DAPLink(transport);

            await daplink.connect();
            globalEventBus.emit('LOG', { message: "Connected to DAPLink.", type: 'success' });
            
            const target = await daplink.getFlash();
            globalEventBus.emit('LOG', { message: "Flashing binary...", type: 'warn' });
            
            const array = new Uint8Array(binBuffer);
            
            daplink.on(DAPjs.DAPLink.EVENT_PROGRESS, (progress) => {
                globalEventBus.emit('FLASH_PROGRESS', { progress: Math.round(progress * 100) });
            });

            await target.flash(array);
            globalEventBus.emit('LOG', { message: "Flash Complete!", type: 'success' });
            
            globalEventBus.emit('LOG', { message: "Resetting target...", type: 'info' });
            await daplink.reset();
            globalEventBus.emit('LOG', { message: "Target running.", type: 'success' });
            
            await daplink.disconnect();
            
        } catch (error) {
            globalEventBus.emit('LOG', { message: "Flashing Error: " + error.message, type: 'error' });
        } finally {
            // Restart standard serial reading if we intend to stay connected
            if (wasConnected && this.state.port) {
                this._startReading(this.state.port);
            } else if (!wasConnected && this.state.port) {
                await this.disconnect();
            }
        }
    }
}
