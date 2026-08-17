/**
 * gccErrorParser.js
 * Turns raw gcc/arm-none-eabi-gcc stderr into Monaco marker objects. Shared
 * by CompilerBloc (ARM firmware compile) and LearnBloc (host C grading) --
 * both toolchains produce the same `file:line:col: error|warning: msg` shape,
 * so there's exactly one regex to get right instead of two copies drifting.
 */
export function parseGccErrors(errorText) {
    const markers = [];
    const lines = errorText.split('\n');

    for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_/\\.]+):(\d+):(\d+):\s+(error|warning):\s+(.*)$/);
        if (match) {
            const [, file, lineNum, colNum, severity, msg] = match;
            markers.push({
                file: file,
                line: parseInt(lineNum, 10),
                column: parseInt(colNum, 10),
                severity: severity === 'error' ? 8 : 4, // 8=Error, 4=Warning in Monaco
                message: msg
            });
        }
    }

    return markers;
}
