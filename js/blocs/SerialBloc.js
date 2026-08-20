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
        // The promise from port.readable.pipeTo(decoder.writable) in
        // _startReading -- pipeTo locks port.readable for as long as it's
        // running, and cancelling serialReader (the reader on the piped-to
        // stream) doesn't release that lock by itself. _stopReading() must
        // await this too, or a second attempt to read the port right after
        // disconnecting fails with "readable stream is not yet locked to a
        // reader".
        this.inputDone = null;
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
            await this._stopReading();
            await this.state.port.close();
            this.emit({ isConnected: false, port: null });
            globalEventBus.emit('SERIAL_DISCONNECTED');
        }
    }

    // Tears down the read loop AND waits for pipeTo's lock on port.readable
    // to actually release -- see the constructor's comment on inputDone for
    // why a bare cancel-then-null-then-await-readLoopPromise sequence isn't
    // enough on its own.
    async _stopReading() {
        if (this.serialReader) {
            await this.serialReader.cancel().catch(() => {});
            this.serialReader = null;
        }
        if (this.readLoopPromise) {
            await this.readLoopPromise.catch(() => {});
            this.readLoopPromise = null;
        }
        if (this.inputDone) {
            await this.inputDone.catch(() => {});
            this.inputDone = null;
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
        // Stored (not just a local) -- _stopReading() awaits this so it
        // knows pipeTo has actually released its lock on port.readable
        // before disconnect() (or a fresh connect()) touches the port again.
        this.inputDone = port.readable.pipeTo(decoder.writable);
        this.serialReader = decoder.readable.getReader();
        // Captured locally: the loop's `finally` must release THIS reader
        // even if _stopReading() has already nulled out this.serialReader
        // by the time cancel() causes read() to reject.
        const reader = this.serialReader;

        this.readLoopPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) {
                        globalEventBus.emit('SERIAL_DATA_RECEIVED', { data: value });
                    }
                }
            } catch (error) {
                // Ignore DOMException errors that occur during disconnect
            } finally {
                reader.releaseLock();
            }
        })();
    }

    // Flashing lives in DapBloc.js now -- it's a WebUSB connection to a
    // completely different interface on the probe than this class's
    // navigator.serial console connection. See DapBloc.js's header comment.
}
