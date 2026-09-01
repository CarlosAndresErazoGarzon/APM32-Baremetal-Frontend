/**
 * ConsoleUI
 * Playground's manual "terminal" tab -- a real command line the student
 * types themselves (their own gcc flags, &&-chains, just "./prog" after a
 * previous compile, etc.) instead of the fixed compile-then-run RUN button
 * does. The prompt lives at the bottom of the panel, like a real terminal,
 * not a text box up in the tab header. Owns #consoleOutput/
 * #consoleCommandInput/#consoleClearBtn exclusively; visibility (Playground
 * mode only) is owned by ModeSwitcherUI, tab switching by TerminalUI --
 * this class only owns what happens once the tab is actually showing.
 *
 * Each submitted command is a fresh, disposable sandbox job seeded from
 * the CURRENT file manager state (see backend/learnRunner.js's
 * execCommand()) -- there's no real persistent shell/cwd across commands,
 * but since every run's outputFiles get merged back into the file manager
 * before the next command starts, it still *feels* stateful across
 * commands (a file one command creates is there for the next one).
 *
 * Compiled binaries are a special case: they're deliberately never merged
 * into the file manager (they'd just render as garbage in Monaco), but
 * they still need to survive to the NEXT command -- "gcc main.c -o test"
 * then, separately, "./test" -- so they're kept in `this.sessionBinaries`
 * instead, a private base64 bucket only this class ever sees, sent along
 * with every exec() call and refreshed from every response.
 *
 * Tab completes filenames/compiled-binary names (see handleTabComplete())
 * -- not PATH commands, this client has no authoritative list of what the
 * sandbox's shell actually has installed.
 */
export class ConsoleUI {
    constructor(playgroundBloc, playgroundFsBloc, apiUrl) {
        this.playgroundBloc = playgroundBloc;
        this.playgroundFsBloc = playgroundFsBloc;
        this.apiUrl = apiUrl;
        this.sessionBinaries = {};

        this.output = document.getElementById('consoleOutput');
        this.input = document.getElementById('consoleCommandInput');
        this.clearBtn = document.getElementById('consoleClearBtn');
        this.stdinInput = document.getElementById('consoleStdinInput');
        this.stdinToggle = document.getElementById('consoleStdinToggle');

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.stdinToggle && this.stdinInput) {
            this.stdinToggle.onclick = () => {
                const nowHidden = this.stdinInput.classList.toggle('hidden');
                this.stdinToggle.textContent = nowHidden ? '[+] Stdin' : '[-] Stdin';
                if (!nowHidden) this.stdinInput.focus();
            };
        }
        if (this.input) {
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.execute();
                } else if (e.key === 'Tab') {
                    // Default Tab behavior would jump focus to the next
                    // element on the page -- a real terminal keeps focus
                    // and completes instead.
                    e.preventDefault();
                    this.handleTabComplete();
                }
            });
        }
        if (this.clearBtn && this.output) {
            // Clearing the transcript also drops any compiled binaries from
            // this session -- a clean slate, not just a visual reset, so a
            // stale "./test" from a previous unrelated attempt can't linger
            // silently.
            this.clearBtn.onclick = () => {
                this.output.innerHTML = '';
                this.sessionBinaries = {};
                this.playgroundFsBloc.setBinaryNames([]);
            };
        }
    }

    async execute() {
        if (!this.input || !this.output) return;
        const command = this.input.value.trim();
        if (!command) return;
        if (this.playgroundBloc.state.isExecuting) return;

        // Special-cased client-side instead of sent to the sandbox: this
        // transcript is a plain scrolling div, not a real terminal emulator
        // (no xterm.js), so it can't interpret ANSI escape codes -- the
        // real Unix `clear` binary would just dump its literal control
        // bytes as visible garbage ("[H[2J[3J") instead of actually
        // clearing anything. Only wipes the transcript, unlike the Clear
        // BUTTON, which also drops compiled binaries -- `clear` the shell
        // command doesn't touch program state in a real terminal either.
        if (command === 'clear') {
            this.output.innerHTML = '';
            this.input.value = '';
            return;
        }

        this.appendLine(`$ ${command}`, 'command');
        this.input.value = '';
        this.setBusy(true);

        // virtualFS always holds the current file's latest text already --
        // EditorUI pushes every keystroke into the bloc synchronously (see
        // EditorUI.js) -- so the live file manager state is exactly what
        // this request should be seeded from.
        const state = this.playgroundFsBloc.state;
        const files = { ...state.virtualFS };

        // Whatever's in the (optional, collapsed-by-default) stdin box --
        // there's no live/interactive stdin since each command is a fresh,
        // non-interactive sandbox job that runs to completion before
        // returning (see this file's own header comment and
        // learnRunner.js's execCommand()), so a program that calls
        // scanf()/getchar() needs its input supplied up front instead.
        const stdin = this.stdinInput ? this.stdinInput.value : '';
        const result = await this.playgroundBloc.exec(this.apiUrl, files, command, stdin, this.sessionBinaries);
        this.setBusy(false);

        if (result.stdout) this.appendLine(result.stdout.replace(/\n$/, ''), 'stdout');
        if (result.stderr) this.appendLine(result.stderr.replace(/\n$/, ''), 'stderr');

        if (result.timedOut) {
            this.appendLine('[timed out]', 'stderr');
        } else if (typeof result.code === 'number') {
            this.appendLine(`[exit code ${result.code}]`, result.code === 0 ? 'success' : 'stderr');
        }

        if (result.outputFiles) {
            this.playgroundFsBloc.mergeChangedFiles(files, result.outputFiles);
        }
        // Carry compiled binaries (or any other genuinely binary output)
        // forward for the next command -- overwrite, don't merge-forever:
        // this IS the full current set the server just reported back.
        if (result.binaryFiles) {
            this.sessionBinaries = result.binaryFiles;
            // Names only (not the base64 bytes) so the file manager can
            // show that they exist -- see FileSystemBloc.setBinaryNames().
            this.playgroundFsBloc.setBinaryNames(Object.keys(this.sessionBinaries));
        }
    }

    // Filename/binary completion only -- no PATH command-name completion,
    // since the real available command set (gcc, make, coreutils...) lives
    // in the sandbox's own PATH, not anywhere this client knows about, and
    // a hardcoded guess could confidently complete to something that
    // doesn't actually exist there. Filenames are something this client
    // genuinely has an authoritative answer for: virtualFS's own keys plus
    // this session's compiled binaries (offered "./name", how you'd
    // actually run one).
    handleTabComplete() {
        const value = this.input.value;
        const cursorPos = this.input.selectionStart;
        const before = value.slice(0, cursorPos);
        const match = before.match(/(\S*)$/);
        const partial = match ? match[1] : '';
        if (!partial) return; // bare Tab on empty/trailing-space -- nothing to anchor a guess to

        const candidates = this.completionCandidates(partial);
        if (candidates.length === 0) return;

        if (candidates.length === 1) {
            this.applyCompletion(before, partial, candidates[0], value, cursorPos);
            return;
        }

        // Several matches -- complete as far as their shared prefix goes
        // (same as a real shell's double-Tab-adjacent behavior), and list
        // the options so pressing Tab again isn't a silent no-op.
        const commonPrefix = this.longestCommonPrefix(candidates);
        if (commonPrefix.length > partial.length) {
            this.applyCompletion(before, partial, commonPrefix, value, cursorPos);
        } else {
            this.appendLine(candidates.join('  '), 'stdout');
        }
    }

    completionCandidates(partial) {
        const names = new Set();
        Object.keys(this.playgroundFsBloc.state.virtualFS).forEach(f => names.add(f));
        Object.keys(this.sessionBinaries).forEach(f => names.add(`./${f}`));
        return [...names].filter(n => n.startsWith(partial)).sort();
    }

    applyCompletion(before, partial, completion, fullValue, cursorPos) {
        const prefix = before.slice(0, before.length - partial.length);
        const after = fullValue.slice(cursorPos);
        const newValue = prefix + completion + after;
        this.input.value = newValue;
        const newCursor = (prefix + completion).length;
        this.input.setSelectionRange(newCursor, newCursor);
    }

    longestCommonPrefix(strings) {
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (!strings[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
                if (!prefix) return '';
            }
        }
        return prefix;
    }

    setBusy(busy) {
        if (this.input) this.input.disabled = busy;
        // preventScroll: focusing this while the terminal pane is
        // collapsed (overflow:hidden, no scrollable ancestor to satisfy
        // the browser's default scroll-into-view) misplaces
        // #terminalHeader -- see TerminalUI.js's own switchTerminalTab()
        // for the confirmed repro of this exact bug.
        if (!busy && this.input) this.input.focus({ preventScroll: true });
    }

    appendLine(text, kind) {
        if (!text && kind !== 'command') return;
        const div = document.createElement('div');
        // stdout deliberately isn't pure/bright white -- same muted tone
        // the Logs panel already uses for message text (TerminalUI.js's
        // logMessage()), so a normal program's output doesn't glare against
        // the near-black background the way full-brightness text would.
        const isDark = !document.body.classList.contains('light-theme');
        // stderr/success: same theme-aware red/emerald pairing TerminalUI's
        // own logMessage() already uses -- the -400 shades read fine on the
        // near-black dark background but wash out on light's near-white one.
        const colorClass = {
            command: isDark ? 'text-[var(--accent-text)] font-bold' : 'text-[var(--header-color)] font-bold',
            stdout: isDark ? 'text-[var(--text-main)]' : 'text-[var(--text-main)]',
            stderr: isDark ? 'text-red-400 font-semibold' : 'text-red-700 font-semibold',
            success: isDark ? 'text-emerald-400 font-semibold' : 'text-emerald-800 font-semibold',
        }[kind] || (isDark ? 'text-[var(--text-main)]' : 'text-[var(--text-main)]');
        div.className = `whitespace-pre-wrap mb-0.5 ${colorClass}`;
        div.textContent = text;
        this.output.appendChild(div);
        this.output.scrollTop = this.output.scrollHeight;
    }
}
