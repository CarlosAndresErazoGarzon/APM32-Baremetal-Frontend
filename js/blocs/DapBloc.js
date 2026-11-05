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

// --- RAM-resident flash algorithm ---
// Real bottleneck this fixes: the original write loop did one full SWD/USB
// round trip PER HALFWORD (write it, then poll FLASH_SR for BSY) -- ~17,000
// round trips for a 33KB firmware, which is what actually dominated flash
// time (not which of compile vs. prebuilt produced the bin, and only
// partly the SWD clock speed). OpenOCD's stm32f1x driver is fast for the
// same reason this is: it loads a tiny algorithm into the target's own
// SRAM and lets the CPU run the write+poll loop at full core speed,
// talking to the debugger only once per CHUNK instead of once per halfword.
//
// Source (compiled with arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O1
// -ffreestanding -nostdlib, linked flat at ALGO_BASE, verified via
// objdump -- no stack usage at all, so no SP setup needed before running
// it):
//
//   void flash_algo(uint16_t *src, uint16_t *dst, uint32_t count) {
//       volatile uint32_t *FLASH_SR = (volatile uint32_t *)0x4002200C;
//       volatile uint32_t *FLASH_CR = (volatile uint32_t *)0x40022010;
//       for (uint32_t i = 0; i < count; i++) {
//           dst[i] = src[i];
//           while (*FLASH_SR & 0x1) { } // wait BSY
//       }
//       *FLASH_CR &= ~0x1; // clear PG
//       __asm volatile ("bkpt #0"); // halts the core -- our "done" signal
//       while (1) { }
//   }
//
// R0/R1/R2 (src/dst/count) and PC are set via the standard Cortex-M debug
// core-register interface before each chunk's run; FLASH_CR's PG bit must
// already be set by the caller (the algorithm only clears it at the end).
const FLASH_ALGO = new Uint8Array([
    0x72, 0xb1, 0x02, 0x38, 0x02, 0x39, 0x00, 0xeb, 0x42, 0x0c, 0x09, 0x4a, 0x30, 0xf8, 0x02, 0x3f,
    0x21, 0xf8, 0x02, 0x3f, 0xd3, 0x68, 0x13, 0xf0, 0x01, 0x0f, 0xfb, 0xd1, 0x60, 0x45, 0xf5, 0xd1,
    0x03, 0x4a, 0x13, 0x69, 0x23, 0xf0, 0x01, 0x03, 0x13, 0x61, 0x00, 0xbe, 0xfe, 0xe7, 0x00, 0xbf,
    0x00, 0x20, 0x02, 0x40
]);
const ALGO_BASE = 0x20000000;          // start of SRAM
const DATA_BASE = 0x20000040;          // 64 bytes in -- well past the 52-byte algo
const CHUNK_BYTES = 2048;              // conservative for now -- see _waitForAlgoDone

// Core register selector numbers (ARMv7-M DCRSR REGSEL encoding).
const REG_R0 = 0, REG_R1 = 1, REG_R2 = 2, REG_PC = 15;

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
            // 1MHz, not 100kHz -- this is the same probe+chip combo the
            // VS Code extension's OpenOCD config (`adapter speed 1000`)
            // already runs reliably at 1MHz, and the 10x higher clock cuts
            // meaningfully into the real bottleneck below: _flashAPM32
            // does one SWD transaction per 2 bytes (write the halfword,
            // then poll FLASH_SR for BSY), so a 33KB firmware is ~17,000
            // round trips -- that's what actually dominates flash time,
            // far more than which of compile vs. prebuilt produced the bin.
            const processor = new DAPjs.CortexM(transport, 0, 1000000);
            await processor.connect();

            this.emit({ isConnected: true, processor });
            globalEventBus.emit('LOG', { message: "Connected via WebUSB (SWD: 1MHz).", type: 'success' });
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
        } catch (err) {
            // Real reported bug: this had no catch at all -- an exception
            // here (e.g. the flash algorithm timing out) just vanished into
            // an unhandled promise rejection, so the UI looked "stuck" at
            // whatever log line printed last instead of showing an error.
            globalEventBus.emit('LOG', { message: `Flash error: ${err.message}`, type: 'error' });
        } finally {
            this.emit({ isFlashing: false });
        }
    }

    // Standalone "Reboot" button -- the same software system reset flash()
    // already does after programming (processor.reset() + AIRCR
    // SYSRESETREQ), just without a flash in between. Works today with no
    // extra wiring; if the probe's RST line ever gets wired to the
    // target's NRST, this becomes a true hardware reset for free -- dapjs
    // would route it through the adapter's physical reset line instead,
    // same call site.
    async resetBoard() {
        if (!this.state.processor) {
            globalEventBus.emit('LOG', { message: "Connect via LINK first.", type: 'error' });
            return;
        }
        if (this.state.isFlashing) {
            globalEventBus.emit('LOG', { message: "Cannot reset while a flash is in progress.", type: 'error' });
            return;
        }

        try {
            globalEventBus.emit('LOG', { message: "Resetting device...", type: 'info' });
            await this.state.processor.reset();
            await this.state.processor.writeMem32(AIRCR, AIRCR_SYSRESETREQ);
            globalEventBus.emit('LOG', { message: "Device reset.", type: 'success' });
        } catch (err) {
            globalEventBus.emit('LOG', { message: "Reset error: " + err.message, type: 'error' });
        }
    }

    // Direct FMC register manipulation -- APM32F103 isn't an officially
    // catalogued DAPLink target, so DAPLink's own generic getFlash()/
    // flash-algorithm path (what this app briefly tried) was never going
    // to work regardless of transport. This talks straight to the flash
    // controller instead: unlock, mass-erase, program halfwords from the
    // base flash address, matching the pre-refactor implementation.
    //
    // Slow (one SWD round trip per halfword written -- see
    // _flashAPM32FastExperimental for why), but proven reliable on every
    // example size tested so far. A RAM-resident flash-algorithm version
    // was tried to fix that (see below) but hung indefinitely partway
    // through larger binaries in real testing, for a reason that needs
    // browser devtools console output to diagnose further (nothing threw,
    // so nothing could be logged) -- reverted to this one so uploading
    // still works while that gets investigated separately.
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

    // EXPERIMENTAL / not currently called by flash() -- see the comment on
    // _flashAPM32 above. Loads a tiny RAM-resident algorithm (FLASH_ALGO)
    // once, then per chunk: bulk-writes the chunk into SRAM, points R0/R1/
    // R2/PC at it, and lets the CPU run the write+poll loop at full core
    // speed instead of one SWD round trip per halfword. Worked completely
    // for small binaries (single chunk); hung with no thrown error partway
    // through larger ones in real testing. Kept here, unused, so whoever
    // picks this back up doesn't have to redo the RAM-algorithm plumbing
    // from scratch -- swap the call in flash() from _flashAPM32 to this
    // once the hang is understood.
    async _flashAPM32FastExperimental(processor, binArrayBuffer) {
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

        // Load the flash algorithm into SRAM once -- it's the same 52 bytes
        // for every chunk, only the data buffer changes below.
        await this._writeRamBlock(processor, ALGO_BASE, FLASH_ALGO);

        const fullData = new Uint8Array(binArrayBuffer);
        const totalBytes = fullData.length;
        let offset = 0;
        let flashAddr = FLASH_BASE_ADDR;

        while (offset < totalBytes) {
            const chunkLen = Math.min(CHUNK_BYTES, totalBytes - offset);
            const chunk = fullData.subarray(offset, offset + chunkLen);

            await this._writeRamBlock(processor, DATA_BASE, chunk);

            // PG must be set before each run -- the algorithm clears it
            // again right before its own BKPT, every time it finishes.
            await processor.writeMem32(FLASH_CR, 0x00000001);

            await processor.writeCoreRegister(REG_R0, DATA_BASE);
            await processor.writeCoreRegister(REG_R1, flashAddr);
            await processor.writeCoreRegister(REG_R2, chunkLen / 2); // halfword count
            await processor.writeCoreRegister(REG_PC, ALGO_BASE);

            await processor.resume(false);
            await this._waitForAlgoDone(processor);

            offset += chunkLen;
            flashAddr += chunkLen;

            const pct = Math.round((offset / totalBytes) * 100);
            globalEventBus.emit('LOG', { message: `Write progress: ${pct}%`, type: 'info' });
            globalEventBus.emit('FLASH_PROGRESS', { progress: pct });
        }

        globalEventBus.emit('LOG', { message: "[FMC] Programming completed successfully.", type: 'success' });
        globalEventBus.emit('FLASH_PROGRESS', { progress: 100 });
    }

    // Bulk-writes arbitrary bytes into target RAM via the MEM-AP's TAR
    // auto-increment block transfer (dapjs's writeBlock) instead of one
    // writeMem32 per word -- padded up to a whole number of 32-bit words
    // first since writeBlock operates on a Uint32Array; any padding past
    // the real byte count just sits unused in SRAM.
    async _writeRamBlock(processor, address, byteData) {
        const padded = new Uint8Array(Math.ceil(byteData.length / 4) * 4);
        padded.set(byteData);
        await processor.writeBlock(address, new Uint32Array(padded.buffer));
    }

    // The flash algorithm halts the core itself (BKPT) the instant it's
    // done with its chunk -- cheaper to poll for that once per chunk than
    // to poll FLASH_SR over SWD once per halfword like the old loop did.
    async _waitForAlgoDone(processor) {
        for (let i = 0; i < 4000; i++) {
            if (await processor.isHalted()) return;
            await new Promise(resolve => setTimeout(resolve, 5));
        }

        // Timed out -- log raw DHCSR/FLASH_SR so a stuck run leaves actual
        // evidence instead of nothing, since this can't be reproduced or
        // debugged further without real hardware in front of it.
        let dhcsr = 'unreadable', sr = 'unreadable';
        try { dhcsr = '0x' + (await processor.readMem32(DHCSR)).toString(16); } catch { /* ignore */ }
        try { sr = '0x' + (await processor.readMem32(FLASH_SR)).toString(16); } catch { /* ignore */ }
        throw new Error(`Flash algorithm did not complete in time (DHCSR=${dhcsr}, FLASH_SR=${sr})`);
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
