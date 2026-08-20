import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';

// FMC (Flash Memory Controller) registers -- APM32F103 is STM32F1-family
// compatible, these are the standard Cortex-M FPEC addresses/unlock keys.
const FLASH_KEYR = 0x40022004;
const FLASH_SR = 0x4002200C;
const FLASH_CR = 0x40022010;
const FLASH_BASE_ADDR = 0x08000000;

// Debug Halting Control and Status Register -- bit 17 (0x00020000) is S_HALT.
const DHCSR = 0xE000EDF0;
// Application Interrupt and Reset Control Register -- VECTKEY (0x05FA) +
// SYSRESETREQ triggers a full software reset of the target.
const AIRCR = 0xE000ED0C;
const AIRCR_SYSRESETREQ = 0x05FA0004;

/**
 * DapBloc
 * Owns the WebUSB link to the DAPLink probe (SWD debug/flash access) --
 * completely separate from SerialBloc's navigator.serial connection to
 * the same probe's console/UART interface. Two different browser APIs,
 * two different interfaces on the same physical device; conflating them
 * (this app briefly did, see git history) doesn't work -- dapjs has no
 * transport that speaks CMSIS-DAP over a serial port, only real WebUSB.
 *
 * Ported from the pre-BLoC-refactor app.js (still on origin/main; this
 * whole file didn't exist there) rather than reinvented -- that version's
 * register addresses/unlock keys/reset sequence are specific enough to
 * have clearly been tested against real hardware.
 */
export class DapBloc extends Bloc {
    get initialState() {
        return {
            isConnected: false,
            processor: null,
            isFlashing: false,
            coreState: 'Idle' // 'Idle' | 'Running' | 'Halted' | 'Wait...'
        };
    }

    constructor() {
        super();
        this._pollingActive = false;
    }

    async connect() {
        if (this.state.isConnected) {
            await this.disconnect();
            return;
        }

        try {
            // Reuse a previously-granted permission silently before
            // prompting -- getDevices() only returns devices this origin
            // already has access to.
            let device;
            const devices = await navigator.usb.getDevices();
            if (devices.length > 0) {
                device = devices[0];
            } else {
                globalEventBus.emit('LOG', { message: "Requesting USB permissions (Browser Security)...", type: 'warn' });
                // eslint-disable-next-line no-undef
                device = await navigator.usb.requestDevice({
                    filters: [
                        { classCode: 255 },   // vendor-specific class (CMSIS-DAP's WebUSB interface)
                        { vendorId: 0x0D28 }  // ARM's registered VID, used by DAPLink probes
                    ]
                });
            }
            if (!device) return;

            globalEventBus.emit('LOG', { message: "Initializing DAPLink (WebUSB)...", type: 'warn' });
            // eslint-disable-next-line no-undef
            const transport = new DAPjs.WebUSB(device);
            await transport.open();

            // eslint-disable-next-line no-undef
            const processor = new DAPjs.CortexM(transport, 0, 100000);
            await processor.connect();

            this.emit({ isConnected: true, processor });
            globalEventBus.emit('LOG', { message: "Connected via WebUSB (SWD: 100kHz).", type: 'success' });
            this._startRegisterPolling();
        } catch (err) {
            globalEventBus.emit('LOG', { message: "USB Error: " + err.message, type: 'error' });
            this.emit({ isConnected: false, processor: null });
        }
    }

    async disconnect() {
        if (this.state.isFlashing) {
            globalEventBus.emit('LOG', { message: "Cannot disconnect while firmware is flashing.", type: 'error' });
            return;
        }
        if (this.state.processor) {
            try {
                await this.state.processor.disconnect();
            } catch (e) {
                globalEventBus.emit('LOG', { message: "Forced disconnection.", type: 'warn' });
            }
            this._pollingActive = false;
            this.emit({ isConnected: false, processor: null, coreState: 'Idle' });
        }
    }

    async flash(binBuffer) {
        if (!this.state.processor) {
            globalEventBus.emit('LOG', { message: "Connect via LINK first.", type: 'error' });
            return;
        }
        if (this.state.isFlashing) {
            globalEventBus.emit('LOG', { message: "A flash is already in progress.", type: 'error' });
            return;
        }

        const processor = this.state.processor;
        this.emit({ isFlashing: true });

        try {
            // writeMem16 needs an even byte length.
            let safeBuffer = binBuffer;
            if (binBuffer.byteLength % 2 !== 0) {
                safeBuffer = new ArrayBuffer(binBuffer.byteLength + 1);
                new Uint8Array(safeBuffer).set(new Uint8Array(binBuffer));
            }

            await processor.halt();
            await this._flashAPM32(processor, safeBuffer);

            await processor.reset();
            globalEventBus.emit('LOG', { message: "Rebooting device...", type: 'info' });
            await processor.writeMem32(AIRCR, AIRCR_SYSRESETREQ);
            globalEventBus.emit('LOG', { message: "Device restarted successfully with your new code!", type: 'success' });
        } finally {
            this.emit({ isFlashing: false });
        }
    }

    // Direct FMC register manipulation -- APM32F103 isn't an officially
    // catalogued DAPLink target, so DAPLink's own generic getFlash()/
    // flash-algorithm path (what this app briefly tried) was never going
    // to work regardless of transport. This talks straight to the flash
    // controller instead: unlock, mass-erase, program halfwords from the
    // base flash address, matching the pre-refactor implementation.
    async _flashAPM32(processor, binArrayBuffer) {
        globalEventBus.emit('LOG', { message: "[FMC] Unlocking flash...", type: 'info' });
        await processor.writeMem32(FLASH_KEYR, 0x45670123);
        await processor.writeMem32(FLASH_KEYR, 0xCDEF89AB);

        let cr = await processor.readMem32(FLASH_CR);
        if ((cr & 0x80) !== 0) throw new Error("Failed to unlock Flash");

        globalEventBus.emit('LOG', { message: "[FMC] Erasing memory (Mass Erase)...", type: 'info' });
        await processor.writeMem32(FLASH_CR, 0x00000004); // Set MER
        await processor.writeMem32(FLASH_CR, 0x00000044); // Set STRT + MER

        let sr = await processor.readMem32(FLASH_SR);
        while (sr & 0x01) sr = await processor.readMem32(FLASH_SR); // wait for BSY to clear

        await processor.writeMem32(FLASH_CR, 0x00000000); // Clear MER

        globalEventBus.emit('LOG', { message: `[FMC] Writing binary (${binArrayBuffer.byteLength} bytes)...`, type: 'info' });
        await processor.writeMem32(FLASH_CR, 0x00000001); // Set PG

        const data16 = new Uint16Array(binArrayBuffer);
        let address = FLASH_BASE_ADDR;

        for (let i = 0; i < data16.length; i++) {
            await processor.writeMem16(address, data16[i]);
            sr = await processor.readMem32(FLASH_SR);
            while (sr & 0x01) sr = await processor.readMem32(FLASH_SR);
            address += 2;

            if (i > 0 && i % 512 === 0) {
                globalEventBus.emit('LOG', { message: `Write progress: ${Math.round((i / data16.length) * 100)}%`, type: 'info' });
                globalEventBus.emit('FLASH_PROGRESS', { progress: Math.round((i / data16.length) * 100) });
            }
        }

        await processor.writeMem32(FLASH_CR, 0x00000000); // Clear PG
        globalEventBus.emit('LOG', { message: "[FMC] Programming completed successfully.", type: 'success' });
        globalEventBus.emit('FLASH_PROGRESS', { progress: 100 });
    }

    // Self-rescheduling setTimeout chain (not setInterval) -- a slow read
    // never overlaps the next poll. Pauses (not stops) while flashing;
    // stops for good once isConnected goes false.
    _startRegisterPolling() {
        if (this._pollingActive) return;
        this._pollingActive = true;

        const pollLoop = async () => {
            if (!this._pollingActive || !this.state.processor) {
                this.emit({ coreState: 'Idle' });
                return;
            }

            if (this.state.isFlashing) {
                this.emit({ coreState: 'Wait...' });
                setTimeout(pollLoop, 1000);
                return;
            }

            try {
                if (!this.state.processor.transport.device.opened) throw new Error('Offline');
                const dhcsr = await this.state.processor.readMem32(DHCSR);
                this.emit({ coreState: (dhcsr & 0x00020000) ? 'Halted' : 'Running' });
                setTimeout(pollLoop, 200);
            } catch (e) {
                setTimeout(pollLoop, 1000);
            }
        };

        pollLoop();
    }
}
