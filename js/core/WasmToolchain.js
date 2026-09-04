/**
 * WasmToolchain.js
 * Client-side C compile+run for Learn mode -- a real Clang + LLD, compiled
 * to WebAssembly, running entirely in the browser. No network round trip
 * for compiling/running plain host C anymore; the ARM firmware pipeline
 * (IDE mode's /compile) is unrelated and stays server-side (confirmed
 * infeasible to replicate this way -- no published clang-as-WASM anywhere
 * ships the ARM Cortex-M backend, only the WebAssembly one; see the
 * investigation this whole feature was born from). Playground used to be
 * a second consumer (a fixed compile-then-run RUN button) -- removed once
 * its manual terminal tab (server-only, first a one-shot HTTP exec, now a
 * live pty session -- see ConsoleUI.js/backend/ptySession.js) became the
 * only way students actually used that mode.
 *
 * Second iteration of this file. The first used Wasmer's clang.wasm
 * (`@wasmer/sdk`, `Wasmer.fromRegistry('clang/clang')`), fetched live from
 * registry.wasmer.io on every first use -- that registry went unreachable
 * mid-session (confirmed from multiple independent network paths, and
 * from a real user's own browser), taking the feature down with it even
 * though nothing in this app was wrong. This version vendors the whole
 * toolchain locally instead (frontend/vendor/wasm-clang/, from
 * github.com/binji/wasm-clang) -- no registry, no live third-party
 * dependency at all once the page itself has loaded. See that folder's
 * own README.md for the full story and the small patches applied to its
 * vendored shared.js.
 *
 * Known limitations inherited from the vendored toolchain (see that
 * README for detail): stdout/stderr aren't separated (both come back as
 * one string); everything runs on the main thread, not a Worker.
 */

const SCRIPT_URL = 'vendor/wasm-clang/shared.js';
const ASSET_BASE = 'vendor/wasm-clang/';
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s) => (s || '').replace(ANSI_RE, '');

let api = null;
let readyPromise = null;

// hostWrite is a single callback shared by every clang/lld invocation AND
// the student's own compiled program -- withCapture() below is how
// different phases (compile diagnostics vs. the program's real stdout)
// get separated instead of all landing in one undifferentiated stream.
let sink = () => {};
function hostWrite(s) { sink(s); }

async function withCapture(fn) {
    let buf = '';
    const prevSink = sink;
    sink = (s) => { buf += s; };
    try {
        await fn();
        return { text: buf, error: null };
    } catch (err) {
        return { text: buf, error: err };
    } finally {
        sink = prevSink;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(script);
    });
}

// Idempotent -- safe to call every time Learn's RUN TESTS fires without
// redoing any of this after the first call. `onProgress(message)` is
// optional, used to drive a "loading compiler..." UI state on first use
// (the toolchain is ~60MB uncompressed, only fetched once, then cached by
// the browser).
export async function ensureReady(onProgress) {
    if (!readyPromise) {
        readyPromise = (async () => {
            if (onProgress) onProgress('Cargando compilador en el navegador (una sola vez)...');
            await loadScript(SCRIPT_URL);
            const API = window.WasmClangAPI;
            if (!API) throw new Error('shared.js cargó pero no expuso WasmClangAPI');

            api = new API({
                readBuffer: async (filename) => {
                    const res = await fetch(ASSET_BASE + filename);
                    if (!res.ok) throw new Error(`No se pudo descargar ${filename}`);
                    return res.arrayBuffer();
                },
                compileStreaming: async (filename) => {
                    const res = await fetch(ASSET_BASE + filename);
                    if (!res.ok) throw new Error(`No se pudo descargar ${filename}`);
                    return WebAssembly.compile(await res.arrayBuffer());
                },
                hostWrite,
            });

            if (onProgress) onProgress('Preparando entorno de compilación (sysroot)...');
            await api.ready;
        })();
    }
    return readyPromise;
}

export function isReady() {
    return api !== null;
}

// Compiles every .c file in `files` ({relPath: content}) into one linked
// wasm module. Non-.c files (headers) are written into the virtual
// filesystem first so #include can find them. Mirrors
// backend/learnRunner.js's runArbitrary() include-path handling:
// quote-form #include only searches the including file's own directory by
// default, so every directory that actually has a file in it gets its own
// -I.
export async function compileToWasm(files, onProgress) {
    await ensureReady(onProgress);

    for (const [relPath, content] of Object.entries(files)) {
        if (!relPath.endsWith('.c')) api.memfs.addFile(relPath, content);
    }

    const includeDirs = new Set(['.']);
    for (const relPath of Object.keys(files)) {
        const slash = relPath.lastIndexOf('/');
        if (slash > 0) includeDirs.add(relPath.slice(0, slash));
    }

    const objs = [];
    let diagnostics = '';
    for (const [relPath, content] of Object.entries(files)) {
        if (!relPath.endsWith('.c')) continue;
        if (onProgress) onProgress(`Compilando ${relPath}...`);
        const obj = relPath.replace(/\//g, '_').replace(/\.c$/, '.o');
        const { text, error } = await withCapture(() => api.compile({
            input: relPath, contents: content, obj, lang: 'c', includeDirs: [...includeDirs]
        }));
        diagnostics += text;
        if (error) {
            return { success: false, stderr: stripAnsi(diagnostics) };
        }
        objs.push(obj);
    }

    if (objs.length === 0) {
        return { success: false, stderr: 'No .c files to compile.' };
    }

    if (onProgress) onProgress('Enlazando...');
    const { text: linkText, error: linkError } = await withCapture(() => api.linkMulti(objs, 'out.wasm'));
    diagnostics += linkText;
    if (linkError) {
        return { success: false, stderr: stripAnsi(diagnostics) };
    }

    // getFileContents() returns a Uint8Array VIEW into the toolchain's own
    // wasm linear memory, not a copy -- slice() it immediately so it stays
    // valid even after that memory potentially grows/reallocates on a
    // later compile.
    const wasmBytes = api.memfs.getFileContents('out.wasm').slice();
    const module = await WebAssembly.compile(wasmBytes);

    return { success: true, module, stderr: stripAnsi(diagnostics) };
}

// Runs a compiled wasm module, capturing its output (stdout+stderr
// merged -- see this file's own header comment) and exit code. `stdin` is
// a plain string.
export async function runWasmModule(module, stdin) {
    await ensureReady();
    api.memfs.setStdinStr(stdin || '');
    // runQuiet(), not run() -- run() prefixes a "> out.wasm\n" hostLog
    // line (and a trailing blank line) that would otherwise leak into what
    // this treats as the program's real stdout, see shared.js's own
    // comment on runQuiet().
    const { text, error } = await withCapture(() => api.runQuiet(module, 'out.wasm'));
    const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
    return { code, stdout: stripAnsi(text), stderr: '' };
}
