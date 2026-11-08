import { test, assert, near } from './_lib';
import {
    formatPiTick,
    formatPiLatex,
    shouldUsePiTicks,
    parseSequenceToPoints,
    findSnapCandidate,
    formatCoord,
    piTickStep,
    nextPiStep,
    piTickValues,
    isPiAxis,
} from '../src/signals';
import { computeScene2D } from '../src/scene';
import { MathContext } from '../src/mathcontext';
import { PointsTool, SegmentTool } from '../src/types';
import { SettingsManager } from '../src/settings';
import { recipes } from '../src/migrate';

// ---------------------------------------------------------------------------
// π Tick Formatting & Auto-detection
// ---------------------------------------------------------------------------

test('formatPiTick formats rational multiples of π cleanly', () => {
    assert.equal(formatPiTick(0), '0');
    assert.equal(formatPiTick(Math.PI), 'π');
    assert.equal(formatPiTick(-Math.PI), '-π');
    assert.equal(formatPiTick(2 * Math.PI), '2π');
    assert.equal(formatPiTick(-2 * Math.PI), '-2π');
    assert.equal(formatPiTick(Math.PI / 2), 'π/2');
    assert.equal(formatPiTick(-Math.PI / 2), '-π/2');
    assert.equal(formatPiTick(3 * Math.PI / 2), '3π/2');
    assert.equal(formatPiTick(-3 * Math.PI / 2), '-3π/2');
    assert.equal(formatPiTick(Math.PI / 4), 'π/4');
    assert.equal(formatPiTick(3 * Math.PI / 4), '3π/4');
    assert.equal(formatPiTick(Math.PI / 3), 'π/3');
    assert.equal(formatPiTick(2 * Math.PI / 3), '2π/3');
    assert.equal(formatPiTick(Math.PI / 6), 'π/6');
    assert.equal(formatPiTick(5 * Math.PI / 6), '5π/6');
});

test('formatPiTick falls back to clean numeric formatting for non-π values', () => {
    assert.equal(formatPiTick(1.5), null);
    assert.equal(formatPiTick(2), null);
    assert.equal(formatPiTick(-3.5), null);
});

test('formatPiLatex formats pgfplots compatible LaTeX math labels', () => {
    assert.equal(formatPiLatex(0), '0');
    assert.equal(formatPiLatex(Math.PI), '$\\pi$');
    assert.equal(formatPiLatex(-Math.PI), '$-\\pi$');
    assert.equal(formatPiLatex(2 * Math.PI), '$2\\pi$');
    assert.equal(formatPiLatex(-2 * Math.PI), '$-2\\pi$');
    assert.equal(formatPiLatex(Math.PI / 2), '$\\pi/2$');
    assert.equal(formatPiLatex(-Math.PI / 2), '$-\\pi/2$');
    assert.equal(formatPiLatex(3 * Math.PI / 2), '$3\\pi/2$');
});

test('shouldUsePiTicks honors mode and auto-detects π values', () => {
    assert.equal(shouldUsePiTicks([0, 1, 2], 'pi'), true);
    assert.equal(shouldUsePiTicks([0, Math.PI, 2 * Math.PI], 'numeric'), false);
    assert.equal(shouldUsePiTicks([0, 1, 2], 'numeric'), false);

    // Auto mode with explicit expressions containing 'pi'
    assert.equal(shouldUsePiTicks([0, 1.57, 3.14], 'auto', ['-2*pi', '2*pi']), true);
    assert.equal(shouldUsePiTicks([0, 1, 2], 'auto', ['-5', '5']), false);

    // Auto mode with values that are multiples of π
    assert.equal(shouldUsePiTicks([-Math.PI, 0, Math.PI, 2 * Math.PI], 'auto'), true);
    assert.equal(shouldUsePiTicks([0, 1, 2, 3, 4], 'auto'), false);
});

// ---------------------------------------------------------------------------
// Discrete-Time Sequence Parsing
// ---------------------------------------------------------------------------

test('parseSequenceToPoints parses numbers into coordinate tuples', () => {
    const res1 = parseSequenceToPoints('1, 2, 0, -1, 2', 0);
    assert.equal(res1, '(0, 1); (1, 2); (2, 0); (3, -1); (4, 2)');

    // With negative starting offset n0 = -2
    const res2 = parseSequenceToPoints('[1, 2, 0, -1, 2]', -2);
    assert.equal(res2, '(-2, 1); (-1, 2); (0, 0); (1, -1); (2, 2)');

    // Space separated values
    const res3 = parseSequenceToPoints('0.5 -1.5 2', 1);
    assert.equal(res3, '(1, 0.5); (2, -1.5); (3, 2)');
});

test('parseSequenceToPoints supports periodic repetition', () => {
    const res = parseSequenceToPoints('1, -1', 0, { repeat: 3 });
    assert.equal(res, '(0, 1); (1, -1); (2, 1); (3, -1); (4, 1); (5, -1)');
});

// ---------------------------------------------------------------------------
// Direct Graph Drawing Snapping
// ---------------------------------------------------------------------------

test('findSnapCandidate snaps to grid, axes, origin, and points within threshold', () => {
    // 1 math unit = 50 screen px (so 12 screen px = 0.24 math units)
    const toScreen = (p: { x: number; y: number }) => ({ x: 200 + p.x * 50, y: 200 - p.y * 50 });
    const view = { xmin: -4, xmax: 4, ymin: -4, ymax: 4 };

    // Point close to origin (0.1, -0.05) -> dist in px = sqrt(5^2 + 2.5^2) = 5.59 px <= 12 px
    const originSnap = findSnapCandidate(
        { x: 0.1, y: -0.05 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [],
            lastPoint: null,
            shiftHeld: false,
            thresholdPx: 12,
        }
    );
    assert.ok(originSnap !== null);
    assert.equal(originSnap!.kind, 'origin');
    assert.equal(originSnap!.point.x, 0);
    assert.equal(originSnap!.point.y, 0);

    // Point close to grid intersection (2.05, 1.05) -> snap to (2, 1)
    const gridSnap = findSnapCandidate(
        { x: 2.05, y: 1.05 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [],
            lastPoint: null,
            shiftHeld: false,
            thresholdPx: 12,
        }
    );
    assert.ok(gridSnap !== null);
    assert.equal(gridSnap!.kind, 'grid');
    assert.equal(gridSnap!.point.x, 2);
    assert.equal(gridSnap!.point.y, 1);

    // Shift key constrains to horizontal or vertical line from lastPoint
    const shiftSnapH = findSnapCandidate(
        { x: 2.8, y: 1.15 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [],
            lastPoint: { x: 0, y: 1 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.ok(shiftSnapH !== null);
    assert.equal(shiftSnapH!.kind, 'shift');
    assert.equal(shiftSnapH!.point.y, 1); // Locked horizontally to y = 1
});

// ---------------------------------------------------------------------------
// Scene Generation for Stem Plots
// ---------------------------------------------------------------------------

test('computeScene2D generates stem strokes for PointsTool with stems: true', () => {
    const math = MathContext.create({});
    const pointTool: PointsTool = {
        id: 't0',
        name: 'P1',
        type: 'points',
        dim: 2,
        source: 'list',
        points: '(-1, 2); (0, 0); (1, -1.5)',
        ref1: '',
        ref2: '',
        regionName: '',
        objective: '',
        sense: 'max',
        color: 'blue',
        label: '',
        size: 'normal',
        dropLines: false,
        stems: true,
    };

    const scene = computeScene2D({
        functions: [],
        tools: [pointTool],
        math,
        view: { xmin: -3, xmax: 3, ymin: -3, ymax: 3 },
        grid: { nx: 100, ny: 100 },
        axisStyle: 'middle',
        polar: false,
    });

    assert.equal(scene.issues.length, 0);
    assert.ok(scene.items.length > 0);

    // There should be markers at (-1, 2), (0, 0), (1, -1.5)
    const markers = scene.items.flatMap((item) => item.markers);
    assert.equal(markers.length, 3);

    // There should be stem strokes extending from baseline y=0 to (-1, 2) and (1, -1.5)
    const strokes = scene.items.flatMap((item) => item.strokes);
    const stemLines = strokes.flatMap((s) => s.lines);
    assert.ok(stemLines.length >= 2, 'Stems generated as strokes');

    // Verify coordinates of the first stem from (-1, 0) to (-1, 2)
    const stem1 = stemLines.find((line) =>
        nearLine(line, [
            { x: -1, y: 0 },
            { x: -1, y: 2 },
        ])
    );
    assert.ok(stem1 !== undefined, 'Stem for (-1, 2) found');

    // Verify coordinates of the negative stem from (1, 0) to (1, -1.5)
    const stem2 = stemLines.find((line) =>
        nearLine(line, [
            { x: 1, y: 0 },
            { x: 1, y: -1.5 },
        ])
    );
    assert.ok(stem2 !== undefined, 'Stem for (1, -1.5) found');
});

// Helper to compare line segments
function nearLine(l1: { x: number; y: number }[], l2: { x: number; y: number }[]): boolean {
    if (l1.length !== l2.length) return false;
    for (let i = 0; i < l1.length; i++) {
        if (Math.hypot(l1[i].x - l2[i].x, l1[i].y - l2[i].y) > 1e-4) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// TikZ Export with π Ticks & Stems
// ---------------------------------------------------------------------------

test('SettingsManager generates TikZ code with π tick labels when active', () => {
    const s = SettingsManager.fromJSON({
        v: 4,
        xmin: '-6.283',
        xmax: '6.283',
        ymin: '-2',
        ymax: '2',
        tickFormatX: 'pi',
        axis_style: 'middle',
        tools: [
            {
                type: 'points',
                name: 'P1',
                points: '(-3.142, 1); (0, 0); (3.142, -1)',
                stems: true,
                color: 'blue',
            },
        ],
    });

    const tikz = s.generateTikzCode();
    assert.ok(tikz.includes('xtick='), 'xtick present');
    assert.ok(tikz.includes('xticklabels='), 'xticklabels present');
    assert.ok(tikz.includes('\\pi'), 'pi tick labels present in TikZ export');
    assert.ok(tikz.includes('draw='), 'stem draws present');
});

// ---------------------------------------------------------------------------
// π Tick Generation & Steps
// ---------------------------------------------------------------------------

test('piTickStep chooses rational π step based on span', () => {
    // Span 14 (e.g. -7 to 7, targetCount 5) -> step should be Math.PI
    const step14 = piTickStep(14, 5);
    near(step14, Math.PI, 1e-4);

    // Span 7 (e.g. -3.5 to 3.5, targetCount 5) -> step should be Math.PI / 2
    const step7 = piTickStep(7, 5);
    near(step7, Math.PI / 2, 1e-4);

    // Span 3 (e.g. -1.5 to 1.5, targetCount 5) -> step should be Math.PI / 6, Math.PI / 4, or Math.PI / 3
    const step3 = piTickStep(3, 5);
    assert.ok(step3 === Math.PI / 6 || step3 === Math.PI / 4 || step3 === Math.PI / 3);

    // nextPiStep widens to the next standard pi increment
    const wider = nextPiStep(Math.PI / 2);
    near(wider, Math.PI, 1e-4);
});

test('piTickValues produces exact multiples of pi step within range', () => {
    const ticks = piTickValues(-7, 7, Math.PI);
    // Multiples: -2*pi (-6.28), -pi (-3.14), 0, pi (3.14), 2*pi (6.28)
    assert.equal(ticks.length, 5);
    near(ticks[0], -2 * Math.PI, 1e-4);
    near(ticks[1], -Math.PI, 1e-4);
    near(ticks[2], 0, 1e-4);
    near(ticks[3], Math.PI, 1e-4);
    near(ticks[4], 2 * Math.PI, 1e-4);
});

test('isPiAxis detects explicit and auto conditions', () => {
    assert.equal(isPiAxis('pi', 'x', '-5', '5'), true);
    assert.equal(isPiAxis('numeric', 'x', '-pi', 'pi'), false);
    assert.equal(isPiAxis('auto', '\\omega', '-5', '5'), true);
    assert.equal(isPiAxis('auto', 'theta', '-5', '5'), true);
    assert.equal(isPiAxis('auto', 'x', '-2*pi', '2*pi'), true);
    assert.equal(isPiAxis('auto', 'x', '-5', '5', ['sin(2*pi*x)']), true);
    assert.equal(isPiAxis('auto', 'x', '-5', '5', ['x^2']), false);
});

// ---------------------------------------------------------------------------
// Snapping Priority Hierarchy
// ---------------------------------------------------------------------------

test('findSnapCandidate enforces strict priority tiers', () => {
    const toScreen = (p: { x: number; y: number }) => ({ x: 200 + p.x * 50, y: 200 - p.y * 50 });
    const view = { xmin: -4, xmax: 4, ymin: -4, ymax: 4 };

    // Tier 1: Shift-constraint locks to horizontal line, even when near a competing grid point
    const shiftSnap = findSnapCandidate(
        { x: 1.05, y: 2.08 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [{ x: 1, y: 2 }],
            lastPoint: { x: 0, y: 2.08 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.ok(shiftSnap !== null);
    assert.equal(shiftSnap!.kind, 'shift');
    near(shiftSnap!.point.y, 2.08, 1e-4);

    // Tier 2: Existing point has priority over Origin when cursor is closer to existing point
    const ptNearOrigin = findSnapCandidate(
        { x: 0.04, y: 0.04 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [{ x: 0.04, y: 0.04 }],
            lastPoint: null,
            shiftHeld: false,
            thresholdPx: 12,
        }
    );
    assert.ok(ptNearOrigin !== null);
    assert.equal(ptNearOrigin!.kind, 'point');
    near(ptNearOrigin!.point.x, 0.04, 1e-4);

    // Snap disabled returns null
    const noSnap = findSnapCandidate(
        { x: 0.01, y: 0.01 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [],
            lastPoint: null,
            shiftHeld: false,
            snapEnabled: false,
            thresholdPx: 12,
        }
    );
    assert.equal(noSnap, null);
});

// ---------------------------------------------------------------------------
// Unit Step Recipe Discontinuity Verification
// ---------------------------------------------------------------------------

test('unit-step recipe creates two discontinuous segments without vertical connector', () => {
    const r = recipes(false).find((rec) => rec.id === 'unit-step');
    assert.ok(r !== undefined);
    const result = r!.build({ is3D: false, functions: [], tools: [], parameters: [] });
    assert.equal(result.kind, 'tools');
    if (result.kind === 'tools') {
        assert.equal(result.tools.length, 2);
        const seg1 = result.tools[0] as SegmentTool;
        const seg2 = result.tools[1] as SegmentTool;
        assert.equal(seg1.type, 'segment');
        assert.equal(seg2.type, 'segment');
        assert.equal(seg1.end, 'hollow', 'Segment 1 ends with hollow point at (0, 0)');
        assert.equal(seg2.start, 'dot', 'Segment 2 starts with solid dot at (0, 1)');
        assert.equal(seg2.label, 'u(t)');
        // Ensure path does not contain vertical jump connector (0, 0) -> (0, 1) in a single segment
        assert.ok(!seg1.path.includes('(0, 1)'));
        assert.ok(!seg2.path.includes('(0, 0)'));
    }
});

// ---------------------------------------------------------------------------
// TikZ Export Parity for Y-Axis π Ticks
// ---------------------------------------------------------------------------

test('SettingsManager exports ytick and yticklabels with \\pi when tickFormatY is pi', () => {
    const s = SettingsManager.fromJSON({
        v: 4,
        xmin: '-2',
        xmax: '2',
        ymin: '-3.142',
        ymax: '3.142',
        tickFormatY: 'pi',
        axis_style: 'middle',
    });

    const tikz = s.generateTikzCode();
    assert.ok(tikz.includes('ytick='), 'ytick present');
    assert.ok(tikz.includes('yticklabels='), 'yticklabels present');
    assert.ok(tikz.includes('$\\pi$') || tikz.includes('\\pi'), 'pi tick labels present on y-axis export');
});
