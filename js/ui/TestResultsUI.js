import { globalEventBus } from '../core/EventBus.js';

/**
 * TestResultsUI
 * Renders into #resultsOutput. Listens for LEARN_RESULT (emitted by
 * LearnBloc.runTests) and shows a card per test case -- the student's actual
 * output plus the expected one on failure, per the confirmed decision to
 * reveal the full diff rather than pass/fail alone. Status (pass/fail) is a
 * small pill, not a colored border around the whole card -- a full-color
 * "frame" per card read as noisy; the pill keeps the card itself neutral and
 * puts the accent only on the one thing that's actually state.
 */
export class TestResultsUI {
    constructor() {
        this.container = document.getElementById('resultsOutput');
        this.clearBtn = document.getElementById('clearResultsBtn');

        if (this.clearBtn) {
            this.clearBtn.onclick = () => {
                if (this.container) this.container.innerHTML = '';
            };
        }

        globalEventBus.on('LEARN_RESULT', result => this.render(result));
    }

    render(result) {
        if (!this.container) return;
        this.container.innerHTML = '';

        if (result.stage === 'compile') {
            const body = `<pre class="whitespace-pre-wrap" style="color: var(--sidebar-text);">${this.escapeHtml(result.stderr || '')}</pre>`;
            this.container.appendChild(this.renderCard('Compile Error', 'ERROR', 'bad', body));
            return;
        }

        (result.results || []).forEach(test => {
            const status = test.timedOut ? 'TIMED OUT' : (test.passed ? 'PASS' : 'FAIL');
            const tone = test.passed ? 'ok' : 'bad';

            let body = `<div class="mb-1 opacity-70">Your output:</div>`;
            body += `<pre class="whitespace-pre-wrap mb-2" style="color: var(--sidebar-text);">${this.escapeHtml(test.actualStdout || '(nothing printed)')}</pre>`;
            if (test.timedOut) {
                body += `<div class="opacity-70">Took too long to finish -- check for an infinite loop.</div>`;
            } else if (!test.passed) {
                body += `<div class="mb-1 opacity-70">Expected:</div>`;
                body += `<pre class="whitespace-pre-wrap" style="color: var(--sidebar-text);">${this.escapeHtml(test.expectedStdout || '')}</pre>`;
            }

            this.container.appendChild(this.renderCard(`Test ${test.index + 1}`, status, tone, body));
        });
    }

    renderCard(title, statusLabel, tone, bodyHtml) {
        const div = document.createElement('div');
        div.className = "p-3 rounded border text-xs font-mono";
        div.style.borderColor = "var(--border-color)";
        div.style.backgroundColor = "var(--track-bg)";

        const pillColor = tone === 'ok' ? 'var(--btn-green-text)' : 'var(--btn-red-text)';
        const pillBg = tone === 'ok' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(248, 113, 113, 0.12)';

        div.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="font-bold" style="color: var(--sidebar-text);">${title}</span>
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style="color: ${pillColor}; background: ${pillBg};">${statusLabel}</span>
            </div>
            ${bodyHtml}
        `;
        return div;
    }

    // A student's own printed output ends up in innerHTML below -- escape it
    // so nothing they print (accidentally or otherwise) can inject markup.
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
