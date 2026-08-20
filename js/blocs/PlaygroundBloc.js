import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';

/**
 * PlaygroundBloc
 * Owns exec() -- Playground's manual "terminal" tab, the only way to
 * compile/run code there (see ConsoleUI.js). There used to also be a fixed
 * compile-then-run RUN button with its own run()/runOnServer() pair
 * (client-side WASM via WasmToolchain.js's compileAndRun(), falling back
 * to the old server-side /playground/run), removed once the terminal
 * became the default/only way students actually used this mode -- see
 * this file's own git history for that implementation if it's ever needed
 * again.
 */
export class PlaygroundBloc extends Bloc {
    get initialState() {
        return { isExecuting: false };
    }

    // Playground's manual "terminal" tab -- runs a raw command line the
    // student typed (own gcc flags, &&-chains, just "./prog", etc.) via
    // /playground/exec. Deliberately doesn't touch the Logs panel or
    // COMPILER_ERRORS markers -- ConsoleUI (see app.js) owns rendering this
    // into its own terminal-transcript panel. `binaryFiles` -- compiled
    // executables carried forward from a PREVIOUS exec()'s response (see
    // ConsoleUI.js) -- lets "gcc main.c -o test" in one command and
    // "./test" in a separate one work, even though each command runs in
    // its own fresh, disposable sandbox dir server-side.
    async exec(apiUrl, files, command, stdin, binaryFiles) {
        if (this.state.isExecuting) return null;
        this.emit({ isExecuting: true });

        try {
            const response = await fetch(`${apiUrl}/playground/exec`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files, command, stdin: stdin || '', binaryFiles })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Command failed');
            }
            return result;

        } catch (error) {
            return { success: false, stdout: '', stderr: error.message, code: -1, timedOut: false };
        } finally {
            this.emit({ isExecuting: false });
        }
    }
}
