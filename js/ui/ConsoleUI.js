import { globalEventBus } from '../core/EventBus.js';

// How long to wait before opening a fresh session after the shell exits
// (typing `exit`, or the idle/max-session timeout on the backend -- see
// ptySession.js) -- long enough that a rapid-fire reconnect loop can't spam
// the server if something's genuinely broken, short enough that it doesn't
// feel like a dead terminal.
const RECONNECT_DELAY_MS = 1000;

/**
 * ConsoleUI
 * Playground's manual "terminal" tab -- a REAL interactive terminal now
 * (xterm.js rendering, a live pty streamed over a WebSocket -- see
 * backend/ptySession.js), not a request/response transcript with a
 * separate stdin box. Typing while a program is running (even one blocked
 * on scanf()/getchar()) sends keystrokes straight to it, exactly like a
 * real terminal, because there IS a real, persistent process on the other
 * end now instead of a fresh disposable sandbox per command.
 *
 * Connects lazily -- the first time the Console tab is actually shown (see
 * TerminalUI.js's CONSOLE_TAB_SHOWN event), not at page load -- so a
 * student who never opens Playground's terminal never costs the server a
 * live shell process. Reconnects automatically if the shell exits (typing
 * `exit`, or the backend's own idle/max-session timeout) so the tab never
 * just goes dead.
 *
 * File sync -- deliberately NOT a background timer in either direction
 * anymore (see this session's own history: a 2s jobDir poll + a 500ms
 * editor-change debounce independently caused three separate real bugs --
 * the editor's cursor jumping mid-typing, a deleted file resurrecting
 * itself, and a command racing a just-finished edit -- because a clock
 * ticking on its own schedule has no idea whether "now" is actually a safe
 * moment to compare snapshots). Both directions are tied to an explicit,
 * observable trigger instead:
 *   - client -> jobDir: this class just tracks a `dirty` flag (any editor
 *     change sets it, see the EDITOR_CONTENT_CHANGED listener) and flushes
 *     it synchronously the instant Enter is forwarded to the pty (see
 *     term.onData below) -- i.e. exactly, and only, right before a command
 *     could possibly run. There's no window to race at all: not a smaller
 *     one, none.
 *   - jobDir -> client: the SERVER debounces on its own pty's OUTPUT
 *     instead of a fixed clock (see ptySession.js) -- it polls jobDir once
 *     shortly after the shell goes quiet again, which is naturally close
 *     to "a command just finished", and never polls at all while the
 *     student is just sitting in the editor with the terminal idle.
 */
export class ConsoleUI {
    constructor(playgroundFsBloc, apiUrl) {
        this.playgroundFsBloc = playgroundFsBloc;
        this.apiUrl = apiUrl;

        this.mount = document.getElementById('consoleXtermMount');
        this.clearBtn = document.getElementById('consoleClearBtn');

        this.term = null;
        this.fitAddon = null;
        this.ws = null;
        this.connectStarted = false;
        // True from the moment a connection drop is first reported until
        // it either succeeds again or a clean shell exit takes over --
        // see connect()'s own comment on why this exists (without it, a
        // backend that's down for a while prints a fresh "reconnecting"
        // line on every single retry, once a second, forever).
        this.reconnecting = false;
        // Echoed back on the NEXT session's 'start' message so reopening
        // the terminal (after `exit`, a timeout, or just a page reload)
        // resumes wherever the student last `cd`'d instead of always
        // landing back at the project root -- same idea as the old
        // batch flow's cwd round-trip, just sourced from the live pty's
        // actual OS-level cwd instead of parsing a marker out of stdout.
        this.lastCwd = '';
        // The exact file snapshot last SENT to the server (via 'start' or
        // 'sync'), not a fresh re-read of live bloc state -- see the
        // 'files' handler's own comment for the real bug this fixes.
        this.lastSyncedFiles = {};
        // Set by any editor change (see EDITOR_CONTENT_CHANGED below),
        // cleared by flushSync() -- replaces the old debounce timer.
        // "Is there an edit the server hasn't seen yet" is a plain fact
        // about the world, not something that needs its own clock.
        this.dirty = false;

        this.initTerminal();
        this.initEventListeners();

        // Catches a real reported bug: TerminalUI is constructed BEFORE
        // this class in app.js, and its modeBloc.subscribe() callback
        // fires SYNCHRONOUSLY with the CURRENT mode the moment it
        // subscribes (see Bloc.js's subscribe() -- it calls back
        // immediately, not just on future changes). If the page loads
        // directly into Playground mode (persisted from a previous visit,
        // not a live click), that synchronous fire calls
        // switchTerminalTab('console') and emits CONSOLE_TAB_SHOWN before
        // this class -- and its listener for that exact event -- even
        // exists yet. The event fires into nothing, connect() never gets
        // called, and the terminal sits there forever with a blank
        // cursor: mounted, but never actually connected, so typing does
        // nothing (xterm has no local echo of its own -- it relies
        // entirely on the pty echoing back whatever was sent).
        // Checking the DOM directly here doesn't care about construction
        // order at all: whatever hid/showed #consolePanel already ran by
        // the time THIS constructor executes, regardless of whether the
        // event that used to signal it was heard.
        if (this.mount && !document.getElementById('consolePanel')?.classList.contains('hidden')) {
            this.connect();
        }
    }

    initTerminal() {
        // eslint-disable-next-line no-undef
        if (!this.mount || typeof Terminal === 'undefined') return;
        // eslint-disable-next-line no-undef
        this.term = new Terminal({
            fontFamily: "'Inconsolata', monospace",
            fontSize: 13,
            cursorBlink: true,
            scrollback: 5000,
            theme: this.computeXtermTheme(),
        });
        // eslint-disable-next-line no-undef
        this.fitAddon = new FitAddon.FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.term.open(this.mount);
        this.safeFit();

        // Every keystroke (including ones a real terminal would treat
        // specially -- Ctrl+C, arrow keys, backspace) goes straight to the
        // pty as raw bytes; bash's own readline on the other end is what
        // makes backspace/history/Ctrl+C work, not anything client-side.
        //
        // Enter (\r) flushes any pending edit FIRST, real reported bug:
        // compiling/running a command in the SAME breath as finishing an
        // edit (a totally normal workflow -- type, hit Enter to compile)
        // raced the old 500ms debounce. Within that window the server's
        // jobDir still had the file's PREVIOUS content, so the command ran
        // against stale code -- missing the student's last few lines, or
        // "No such file" entirely for a file just created. Flushing
        // synchronously before forwarding Enter means the 'sync' WS
        // message is always enqueued (and processed server-side) before
        // the keystroke that actually triggers the command -- WebSocket
        // preserves per-connection message order, so this isn't a smaller
        // race window, it's not a race at all: the sync isn't scheduled
        // for "soon", it just always already happened by the time Enter
        // lands.
        //
        // Gated on this.dirty -- flushSync() unconditionally
        // fs.writeFileSync()s every project file server-side
        // (writeFilesIntoDir has no unchanged-file skip), and the WS
        // handler/syncFiles() are fully synchronous, blocking Node's ONE
        // event loop for every connected session. A running program that
        // just reads a few lines of input (a menu loop, several scanf()
        // prompts) would otherwise re-trigger that full disk write on
        // EVERY Enter, with nothing having actually changed since the
        // last sync -- exactly the per-keystroke server cost this flag
        // exists to avoid. Only flushing when there's a genuinely unsynced
        // edit keeps this scoped to the real race (Enter arriving before
        // an edit the server hasn't seen yet).
        this.term.onData(data => {
            if ((data.includes('\r') || data.includes('\n')) && this.dirty) this.flushSync();
            this.sendWs({ type: 'input', data });
        });
        this.term.onResize(({ cols, rows }) => this.sendWs({ type: 'resize', cols, rows }));

        window.addEventListener('resize', () => this.safeFit());
    }

    initEventListeners() {
        if (this.clearBtn) {
            this.clearBtn.onclick = () => { if (this.term) this.term.clear(); };
        }

        globalEventBus.on('CONSOLE_TAB_SHOWN', () => {
            if (!this.connectStarted) this.connect();
            this.safeFit();
            if (this.term) this.term.focus();
        });

        // Marks the jobDir as stale -- without this, editing main.c AFTER
        // the terminal already connected would silently keep compiling
        // whatever the file looked like at connect time (the session's
        // jobDir is only ever seeded once). Just a flag, no timer: the
        // actual sync happens synchronously right before the next Enter
        // (see term.onData above) -- there's no "soon" to schedule here,
        // only "not yet". Fires for every mode's editor, not just
        // Playground's, and for every kind of change FileSystemBloc makes
        // (create/delete/rename/edit all emit this), but reads
        // this.playgroundFsBloc regardless -- a no-op flush (same content
        // as last time) when the change came from IDE/Learn's own
        // unrelated editor. Gated on connectStarted so it's silent until
        // the student has actually opened the terminal at least once.
        globalEventBus.on('EDITOR_CONTENT_CHANGED', () => {
            if (!this.connectStarted) return;
            this.dirty = true;
        });

        // Monaco isn't the only thing that can't read CSS custom properties
        // directly -- xterm.js renders via canvas too. See EditorUI.js's
        // refreshMonacoThemes() for the same pattern.
        globalEventBus.on('THEME_TOKENS_CHANGED', () => this.refreshXtermTheme());

        // See FontScaleUI.js's own comment on why this is needed -- a CSS
        // zoom change resizes the terminal visually without ever firing a
        // 'resize' event on window, so xterm's cached cols/rows would
        // otherwise silently go stale.
        globalEventBus.on('FONT_SCALE_CHANGED', () => this.safeFit());
    }

    // Sends the CURRENT editor state to the server right now. Called by
    // term.onData's Enter-key interception above, and ONLY from there --
    // see that comment for the race this closes.
    flushSync() {
        if (!this.connectStarted) return;
        this.dirty = false;
        const files = { ...this.playgroundFsBloc.state.virtualFS };
        this.lastSyncedFiles = files;
        this.sendWs({ type: 'sync', files });
    }

    safeFit() {
        if (!this.fitAddon) return;
        try { this.fitAddon.fit(); } catch { /* mount not visible/sized yet */ }
    }

    sendWs(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    connect() {
        this.connectStarted = true;
        const wsUrl = this.apiUrl.replace(/^http/, 'ws') + '/playground/pty';
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            if (this.reconnecting && this.term) {
                this.reconnecting = false;
                this.term.write('\r\n\x1b[90m[reconnected]\x1b[0m\r\n');
            }
            const files = { ...this.playgroundFsBloc.state.virtualFS };
            this.lastSyncedFiles = files;
            // Whatever was dirty before is already included in this
            // fresh read -- 'start' always carries the CURRENT bloc
            // state, not a stale snapshot, so there's nothing left
            // pending once this message goes out.
            this.dirty = false;
            // cols/rows here, not left for a later 'resize' message: a
            // real reported bug -- the pty always spawned at a hardcoded
            // 80x24 (see ptySession.js) and only got resized if term's
            // OWN onResize fired, which it doesn't for a redundant
            // resize() call (xterm.js skips firing it when the computed
            // size already matches what's internally set) -- and the
            // FIRST real fit(), computed in initTerminal() before this.ws
            // even exists, already set term's internal cols/rows once,
            // silently, with nowhere to send it. Net effect: bash wrapped
            // long lines against 80 columns while xterm rendered at
            // whatever the container's ACTUAL width was, and the two
            // disagreeing about where the line wraps is exactly what
            // made the cursor visibly jump mid-line and scramble the
            // redraw. Sending the real size with 'start' spawns the pty
            // already correct from its very first prompt, instead of
            // hoping a resize message shows up later.
            this.sendWs({ type: 'start', files, cwd: this.lastCwd, cols: this.term?.cols, rows: this.term?.rows });
        };

        this.ws.onmessage = (ev) => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch { return; }

            if (msg.type === 'data') {
                if (this.term) this.term.write(msg.data);
            } else if (msg.type === 'files') {
                // The REAL, reported bug this fixes: the cursor jumping to
                // the start of the file and swallowing a keystroke there,
                // while actively typing. Root cause -- mergeChangedFiles()
                // is meant to answer "did the terminal/a compiled program
                // change a file underneath us" (a genuine external write),
                // but a fresh `{...virtualFS}` read here compares the
                // server's echo against whatever the editor holds RIGHT
                // NOW -- which, for the file being actively typed into, is
                // ALWAYS ahead of what the 2-second-old poll snapshot the
                // server just sent back reflects. Every single poll tick
                // during typing looked like "an external change" purely
                // because of that lag, so EditorUI's own contentChanged
                // check (see renderMode()) kept calling editor.setValue()
                // with the STALE content -- which both reverted whatever
                // was typed in the last ~2s AND reset Monaco's cursor to
                // (1,1) as setValue()'s own side effect, right where the
                // student's next keystroke then landed.
                // Comparing against this.lastSyncedFiles instead (the
                // EXACT snapshot last actually sent to the server, not a
                // live re-read) fixes this correctly: it only looks like
                // a change when the server's content differs from what we
                // ourselves told it, which is genuinely true for a file
                // the terminal/a program wrote to, and genuinely false
                // for an echo of the student's own typing racing ahead of
                // the server's last poll.
                this.playgroundFsBloc.mergeChangedFiles(this.lastSyncedFiles, msg.outputFiles);
                this.playgroundFsBloc.setBinaryNames(Object.keys(msg.binaryFiles || {}));
            } else if (msg.type === 'exit') {
                if (typeof msg.cwd === 'string') this.lastCwd = msg.cwd;
                if (this.term) {
                    this.term.write('\r\n\x1b[90m[session ended -- starting a new one]\x1b[0m\r\n');
                }
                this.connectStarted = false;
                setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
            } else if (msg.type === 'error' && this.term) {
                this.term.write(`\r\n\x1b[31m[error] ${msg.message}\x1b[0m\r\n`);
            }
        };

        // A network drop (not a clean shell exit -- that's the 'exit'
        // message above) leaves connectStarted true forever otherwise,
        // permanently blocking the CONSOLE_TAB_SHOWN handler's reconnect
        // check from ever firing again.
        //
        // reconnecting-flag gate: a real reported bug -- a backend that's
        // down for a while (e.g. mid dev-server restart) got a fresh
        // "[connection lost -- reconnecting]" line every single retry,
        // once a second, filling the transcript with dozens of identical
        // lines in well under a minute. Only the FIRST drop in a losing
        // streak prints anything now; onopen's own reconnecting check
        // above prints exactly one "[reconnected]" once it actually comes
        // back, so the signal (something happened) survives without the
        // spam (it's still happening, still happening, still happening...).
        this.ws.onclose = () => {
            if (this.connectStarted) {
                this.connectStarted = false;
                if (!this.reconnecting) {
                    this.reconnecting = true;
                    if (this.term) {
                        this.term.write('\r\n\x1b[90m[connection lost -- reconnecting]\x1b[0m\r\n');
                    }
                }
                setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
            }
        };
    }

    computeXtermTheme() {
        const cs = getComputedStyle(document.documentElement);
        const read = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
        return {
            background: read('--log-bg', '#000000'),
            foreground: read('--text-main', '#e5e5e5'),
            cursor: read('--accent-text', '#e5e5e5'),
            selectionBackground: read('--accent-text', '#666666'),
        };
    }

    refreshXtermTheme() {
        if (this.term) this.term.options.theme = this.computeXtermTheme();
    }
}
