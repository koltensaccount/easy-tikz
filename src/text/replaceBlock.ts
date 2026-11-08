import { chartFences } from './fences';

/** Replace one uniquely identified chart without touching its surrounding quote/callout. */
export function replaceChartBlock(content: string, original: string, replacement: string): string | null {
    const oldLines = original.split(/\r?\n/);
    const old = chartFences(oldLines.length, n => oldLines[n - 1], new Set(['easy-tikz', 'tikz']));
    const newLines = replacement.split(/\r?\n/);
    const next = chartFences(newLines.length, n => newLines[n - 1], new Set(['easy-tikz', 'tikz']));
    if (old.length !== 1 || next.length !== 1 || !next[0].closed) return null;
    const lines = content.split(/\r?\n/);
    const matches = chartFences(lines.length, n => lines[n - 1], new Set([old[0].tag]))
        .filter(f => f.closed && f.body.trimEnd() === old[0].body.trimEnd());
    if (matches.length !== 1) return null;
    const found = matches[0];
    const opening = lines[found.first - 1];
    const prefix = /^(?:[ \t]*>[ ]?)*[ \t]*/.exec(opening)?.[0] ?? '';
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const body = next[0].body.split('\n').map(line => prefix + line);
    lines.splice(found.first - 1, found.last - found.first + 1,
        opening, ...body, lines[found.last - 1]);
    return lines.join(eol);
}
