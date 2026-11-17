import { test, assert } from './_lib';
import { SettingsManager } from '../src/settings';
import { computeScene2D } from '../src/scene';
import { parseChartText } from '../src/text/parse';
import { printChartText } from '../src/text/print';
import { canonical } from '../src/chartdata';
import { EXAMPLES } from '../src/migrate';

function chart(period = '2', extra: Record<string, unknown> = {}) {
    return SettingsManager.fromJSON({
        v: 4,
        tools: [{
            id: 'ramp', name: 'S1', type: 'segment', path: '(0,0); (2,1)',
            period, start: 'dot', end: 'hollow', markerSize: 'large', ...extra,
        }],
    });
}
function scene(settings: SettingsManager, xmin = -3, xmax = 5) {
    const math = settings.createMathContext();
    return computeScene2D({
        math, tools: settings.toRendererConfig(math).tools!, functions: [],
        view: { xmin, xmax, ymin: -1, ymax: 2 },
        grid: { nx: 40, ny: 40 }, axisStyle: 'middle', polar: false,
    });
}

test('one ramp repeats both ways without joining discontinuities', () => {
    const item = scene(chart()).items[0];
    assert.equal(item.strokes.length, 5);
    assert.deepEqual(item.strokes.map((stroke) => stroke.lines[0][0].x), [-4, -2, 0, 2, 4]);
    assert.ok(item.strokes.every((stroke) => stroke.lines.length === 1 && stroke.lines[0].length === 2));
    assert.equal(item.markers.length, 10);
    assert.equal(item.markers.filter((marker) => marker.hollow).length, 5);
    assert.ok(item.markers.every((marker) => marker.size === 'large'));
    // Only the source period exposes editable handles.
    assert.equal(item.handles?.length, 3);
});

test('repetition follows the visible range and evaluates expressions', () => {
    const item = scene(chart('1+1'), 9, 13).items[0];
    assert.deepEqual(item.strokes.map((stroke) => stroke.lines[0][0].x), [8, 10, 12]);
    assert.equal(scene(chart(''), -3, 5).items[0].strokes.length, 1);
});

test('invalid and excessively dense repetition report a period error', () => {
    for (const period of ['0', '-2', 'missing', '1e-15']) {
        const output = scene(chart(period));
        assert.ok(output.issues.some((issue) => issue.field === 'period'));
        assert.equal(output.items.flatMap((item) => item.strokes).length, 0);
    }
});

test('periodic waveform survives JSON and chart text and exports repeated marks', () => {
    const settings = chart('2*pi');
    const serialized = settings.serialize();
    const parsed = parseChartText(printChartText(serialized));
    assert.deepEqual(parsed.problems, []);
    assert.equal(canonical(parsed.data), canonical(serialized));
    assert.equal((SettingsManager.fromJSON(serialized).serialize().tools as any[])[0].period, '2*pi');
    const code = chart().generateTikzCode();
    assert.ok(code.includes('fill=white'));
    assert.ok(code.includes('(4,0)'));
});

test('all Build examples use dollar-delimited LaTeX axis labels', () => {
    for (const example of EXAMPLES) {
        for (const axis of ['x', 'y', 'z']) {
            assert.match(String(example.data['axis_label_' + axis]), /^\$[^$]+\$$/, example.id);
        }
    }
});
