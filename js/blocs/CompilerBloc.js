import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';
import { parseGccErrors } from '../core/gccErrorParser.js';

export class CompilerBloc extends Bloc {
    get initialState() {
        return {
            isCompiling: false,
            lastCompiledBin: null
        };
    }

    async compile(apiUrl, virtualFS) {
        if (this.state.isCompiling) return;
        
        this.emit({ isCompiling: true, lastCompiledBin: null });
        globalEventBus.emit('LOG', { message: "Compiling in cloud...", type: 'warn' });
        globalEventBus.emit('COMPILER_STATUS', { status: 'compiling' });

        try {
            const response = await fetch(`${apiUrl}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: virtualFS })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.details || "Compilation Failed");
            }

            const sizeText = response.headers.get('X-Size-Text') || '0';
            const sizeData = response.headers.get('X-Size-Data') || '0';
            const sizeBss = response.headers.get('X-Size-Bss') || '0';

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();

            this.emit({ isCompiling: false, lastCompiledBin: arrayBuffer });

            const flashUsed = parseInt(sizeText, 10) + parseInt(sizeData, 10);
            const ramUsed = parseInt(sizeData, 10) + parseInt(sizeBss, 10);

            globalEventBus.emit('LOG', {
                message: `Compilation successful! Firmware size: ${arrayBuffer.byteLength} bytes.`,
                type: 'success'
            });
            globalEventBus.emit('LOG', {
                message: `Memory: Flash: ${flashUsed} B | RAM: ${ramUsed} B`,
                type: 'info'
            });
            globalEventBus.emit('COMPILER_STATUS', { status: 'success' });
            globalEventBus.emit('MEMORY_USAGE', { flashUsed, ramUsed });
            
            return arrayBuffer;

        } catch (error) {
            this.emit({ isCompiling: false });
            globalEventBus.emit('LOG', { message: `Compile Error: ${error.message}`, type: 'error' });
            globalEventBus.emit('COMPILER_STATUS', { status: 'error' });
            
            // Emit syntax error markers if available (using regex on gcc output)
            const markers = parseGccErrors(error.message);
            if (markers.length > 0) {
                globalEventBus.emit('COMPILER_ERRORS', { markers });
            }

            return null;
        }
    }

    async downloadZip(virtualFS) {
        // eslint-disable-next-line no-undef
        const zip = new JSZip();
        for (const [filepath, content] of Object.entries(virtualFS)) {
            zip.file(filepath, content);
        }
        
        // Add a simple Makefile
        const makefileContent = `
CC=arm-none-eabi-gcc
CFLAGS=-mcpu=cortex-m3 -mthumb -O2 -Wall
LDFLAGS=-Tlinker.ld

all: firmware.bin

firmware.elf: src/main.c src/apm32_config.c src/delay.c
\\t$(CC) $(CFLAGS) $(LDFLAGS) -Iinc $^ -o $@

firmware.bin: firmware.elf
\\tarm-none-eabi-objcopy -O binary $< $@

clean:
\\trm -f *.o *.elf *.bin
`;
        zip.file('Makefile', makefileContent.trim());

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apm32_project_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        globalEventBus.emit('LOG', { message: "Project exported as ZIP.", type: 'success' });
    }

    downloadBin(binBuffer) {
        if (!binBuffer) return;
        const blob = new Blob([binBuffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "firmware.bin";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        globalEventBus.emit('LOG', { message: "Binary downloaded.", type: 'success' });
    }
}
