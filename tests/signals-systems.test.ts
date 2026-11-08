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
    computeTickPlan,
} from '../src/signals';
import { computeScene2D } from '../src/scene';
import { MathContext, fmtNum } from '../src/mathcontext';
import { PointsTool, SegmentTool } from '../src/types';
import { SettingsManager } from '../src/settings';
import { EXAMPLES, recipes } from '../src/migrate';

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

    // Shift key constrains to horizontal or vertical line from lastPoint and snaps to nearby grid
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
    assert.equal(shiftSnapH!.kind, 'grid');
    near(shiftSnapH!.point.x, 3, 1e-4);
    near(shiftSnapH!.point.y, 1, 1e-4); // Locked horizontally to y = 1
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

test('isPiAxis policy: conservative detection of angular/phase vs time-domain waveforms', () => {
    // Explicit modes always override
    assert.equal(isPiAxis('pi', 'x', '-5', '5'), true, 'explicit pi mode');
    assert.equal(isPiAxis('pi', 't', '0', '6'), true, 'explicit pi mode overrides ordinary axis name');
    assert.equal(isPiAxis('numeric', 'x', '-pi', 'pi'), false, 'explicit numeric mode');
    assert.equal(isPiAxis('numeric', '\\omega', '-2*pi', '2*pi'), false, 'explicit numeric overrides angular label and pi bounds');

    // Bounds containing pi trigger pi ticks in auto mode
    assert.equal(isPiAxis('auto', 'x', '-2*pi', '2*pi'), true, 'bounds with -2*pi to 2*pi');
    assert.equal(isPiAxis('auto', 'x', '0', 'pi'), true, 'bounds with 0 to pi');

    // Angular frequency and phase axes trigger pi ticks
    assert.equal(isPiAxis('auto', '\\omega', '-5', '5'), true, 'omega label');
    assert.equal(isPiAxis('auto', 'ω', '-5', '5'), true, 'unicode omega label');
    assert.equal(isPiAxis('auto', '\\Omega', '-5', '5'), true, 'capital Omega label');
    assert.equal(isPiAxis('auto', 'theta', '-5', '5'), true, 'theta label');
    assert.equal(isPiAxis('auto', '\\phi', '-5', '5'), true, 'phi label');
    assert.equal(isPiAxis('auto', 'rad', '-5', '5'), true, 'rad unit label');
    assert.equal(isPiAxis('auto', 'radians', '-5', '5'), true, 'radians unit label');
    assert.equal(isPiAxis('auto', 'phase', '-5', '5'), true, 'phase label');
    assert.equal(isPiAxis('auto', 'angle', '-5', '5'), true, 'angle label');

    // Ordinary time axes retain numeric ticks even if plotted formulas contain 2*pi
    assert.equal(isPiAxis('auto', 't', '0', '6', ['exp(-0.4*t) * cos(2*pi*t)']), false, 'damped sinusoid on time axis t');
    assert.equal(isPiAxis('auto', 'time', '0', '10', ['cos(2*pi*t)']), false, 'cosine on time axis');
    assert.equal(isPiAxis('auto', 'sec', '0', '5', ['sin(2*pi*50*t)']), false, 'sec time axis');
    assert.equal(isPiAxis('auto', 's', '0', '5', ['sin(2*pi*t)']), false, 's time axis');
    assert.equal(isPiAxis('auto', 'ms', '0', '100', ['sin(2*pi*t)']), false, 'ms time axis');

    // Ordinary frequency in Hz retains numeric ticks
    assert.equal(isPiAxis('auto', 'f', '0', '1000'), false, 'frequency f in Hz');
    assert.equal(isPiAxis('auto', 'freq', '0', '1000'), false, 'freq label in Hz');
    assert.equal(isPiAxis('auto', 'frequency', '0', '1000'), false, 'frequency label in Hz');
    assert.equal(isPiAxis('auto', 'Hz', '0', '1000'), false, 'Hz unit label');

    // Gallery continuous-time waveform example retains numeric ticks
    const ctExample = EXAMPLES.find((ex) => ex.id === 'ct-waveform');
    assert.ok(ctExample !== undefined, 'ct-waveform gallery example exists');
    const ctIsPiX = isPiAxis(
        ctExample!.data.tickFormatX as 'auto' | 'numeric' | 'pi' | undefined,
        ctExample!.data.axis_label_x as string | undefined,
        ctExample!.data.xmin as string | undefined,
        ctExample!.data.xmax as string | undefined,
        (ctExample!.data.functions as any[])?.map((f: any) => f.expression)
    );
    assert.equal(ctIsPiX, false, 'ct-waveform X axis uses numeric ticks');
});

// ---------------------------------------------------------------------------
// Snapping Priority Hierarchy & Shift 1D Snapping
// ---------------------------------------------------------------------------

test('Shift-constrained snapping snaps along the constraint line with strict priorities', () => {
    // 1 math unit = 50 screen px (so 12 screen px = 0.24 math units)
    const toScreen = (p: { x: number; y: number }) => ({ x: 200 + p.x * 50, y: 200 - p.y * 50 });
    const view = { xmin: -4, xmax: 4, ymin: -4, ymax: 4 };

    // 1. Horizontal Shift alignment to a nearby grid coordinate
    // lastPoint = (0, 1), cursor at (2.1, 1.05).
    // dx = 2.1 >= dy = 0.05 -> Horizontal lock to y = 1.
    // Distance along line from 2.1 to grid x=2 is 0.1 * 50 = 5 px <= 12 px.
    const hGridSnap = findSnapCandidate(
        { x: 2.1, y: 1.05 },
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
    assert.ok(hGridSnap !== null, 'hGridSnap not null');
    assert.equal(hGridSnap!.kind, 'grid');
    near(hGridSnap!.point.x, 2, 1e-4);
    near(hGridSnap!.point.y, 1, 1e-4); // Strictly on y = 1

    // 2. Vertical Shift alignment to a nearby grid coordinate
    // lastPoint = (1, 0), cursor at (1.05, 3.1).
    // dy = 3.1 > dx = 0.05 -> Vertical lock to x = 1.
    // Distance along line from 3.1 to grid y=3 is 0.1 * 50 = 5 px <= 12 px.
    const vGridSnap = findSnapCandidate(
        { x: 1.05, y: 3.1 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [],
            lastPoint: { x: 1, y: 0 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.ok(vGridSnap !== null, 'vGridSnap not null');
    assert.equal(vGridSnap!.kind, 'grid');
    near(vGridSnap!.point.x, 1, 1e-4); // Strictly on x = 1
    near(vGridSnap!.point.y, 3, 1e-4);

    // 3. Existing vertex on the constrained line
    // lastPoint = (0, 1), existing point at (2.5, 1). Cursor at (2.55, 1.02).
    const epOnLineSnap = findSnapCandidate(
        { x: 2.55, y: 1.02 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [{ x: 2.5, y: 1 }],
            lastPoint: { x: 0, y: 1 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.ok(epOnLineSnap !== null);
    assert.equal(epOnLineSnap!.kind, 'point');
    near(epOnLineSnap!.point.x, 2.5, 1e-4);
    near(epOnLineSnap!.point.y, 1, 1e-4);

    // 4. Existing vertex slightly off the constrained line (perpendicularly within threshold)
    // lastPoint = (0, 1), existing point at (2.5, 1.08) (4px off perpendicularly). Cursor at (2.52, 1.02).
    // Returned point must remain strictly on the constraint line y = 1.
    const epOffLineSnap = findSnapCandidate(
        { x: 2.52, y: 1.02 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [{ x: 2.5, y: 1.08 }],
            lastPoint: { x: 0, y: 1 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.ok(epOffLineSnap !== null);
    assert.equal(epOffLineSnap!.kind, 'point');
    near(epOffLineSnap!.point.x, 2.5, 1e-4);
    near(epOffLineSnap!.point.y, 1, 1e-4); // Strictly on constraint line y = 1

    // 5. Origin on the constrained line
    // lastPoint = (2, 0) -> horizontal constraint line is y = 0 (contains origin!).
    // Cursor at (0.1, 0.02) -> snaps to (0, 0).
    const originOnLineSnap = findSnapCandidate(
        { x: 0.1, y: 0.02 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [],
            lastPoint: { x: 2, y: 0 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.ok(originOnLineSnap !== null);
    assert.equal(originOnLineSnap!.kind, 'origin');
    near(originOnLineSnap!.point.x, 0, 1e-4);
    near(originOnLineSnap!.point.y, 0, 1e-4);

    // 6. Shift snapping at different zoom scales (100 px per math unit)
    const toScreenZoomed = (p: { x: number; y: number }) => ({ x: 400 + p.x * 100, y: 400 - p.y * 100 });
    // Cursor at offset 0.10 units = 10 px <= 12 px -> snaps to grid x=2
    const zoomSnapClose = findSnapCandidate(
        { x: 2.1, y: 1.01 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen: toScreenZoomed,
            existingPoints: [],
            lastPoint: { x: 0, y: 1 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.equal(zoomSnapClose!.kind, 'grid');
    near(zoomSnapClose!.point.x, 2, 1e-4);

    // Cursor at offset 0.15 units = 15 px > 12 px -> does not snap to grid, stays on line as shift
    const zoomSnapFar = findSnapCandidate(
        { x: 2.15, y: 1.01 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen: toScreenZoomed,
            existingPoints: [],
            lastPoint: { x: 0, y: 1 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.equal(zoomSnapFar!.kind, 'shift');
    near(zoomSnapFar!.point.x, 2.15, 1e-4);
    near(zoomSnapFar!.point.y, 1, 1e-4);

    // 7. Cursor far from valid targets (falls back to pure projection)
    // lastPoint = (0, 1), cursor at (2.45, 1.02). Distance to 2 and 3 is >= 22.5 px > 12 px.
    const farSnap = findSnapCandidate(
        { x: 2.45, y: 1.02 },
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
    assert.ok(farSnap !== null);
    assert.equal(farSnap!.kind, 'shift');
    near(farSnap!.point.x, 2.45, 1e-4);
    near(farSnap!.point.y, 1, 1e-4);

    // 8. Snapping explicitly disabled returns null
    const disabledSnap = findSnapCandidate(
        { x: 2.05, y: 1.02 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [],
            lastPoint: { x: 0, y: 1 },
            shiftHeld: true,
            snapEnabled: false,
            thresholdPx: 12,
        }
    );
    assert.equal(disabledSnap, null);

    // 9. Competing targets near threshold: Existing point wins over grid
    const compSnap = findSnapCandidate(
        { x: 2.06, y: 1.02 },
        {
            view,
            stepX: 1,
            stepY: 1,
            toScreen,
            existingPoints: [{ x: 2.08, y: 1 }],
            lastPoint: { x: 0, y: 1 },
            shiftHeld: true,
            thresholdPx: 12,
        }
    );
    assert.equal(compSnap!.kind, 'point', 'existing point has priority over grid');
    near(compSnap!.point.x, 2.08, 1e-4);
});

// ---------------------------------------------------------------------------
// Shared Tick Planning & Preview/Export Consistency
// ---------------------------------------------------------------------------

test('computeTickPlan ensures identical tick steps and values across preview and export', () => {
    // 1. Both axes using pi
    const bothPi = computeTickPlan(
        {
            width: 760,
            height: 480,
            tickFormatX: 'pi',
            tickFormatY: 'pi',
            xLabel: 'x',
            yLabel: 'y',
        },
        { xmin: -6.283, xmax: 6.283, ymin: -3.142, ymax: 3.142 }
    );
    assert.equal(bothPi.x.isPi, true);
    assert.equal(bothPi.y.isPi, true);
    near(bothPi.stepX, Math.PI, 1e-4);
    near(bothPi.stepY, Math.PI / 3, 1e-4);
    assert.ok(bothPi.x.labelsLatex.some((l) => l.includes('\\pi')));
    assert.ok(bothPi.y.labelsLatex.some((l) => l.includes('\\pi')));

    // 2. Mixed numeric and pi axes (X is pi, Y is numeric)
    const mixed = computeTickPlan(
        {
            width: 760,
            height: 480,
            tickFormatX: 'pi',
            tickFormatY: 'numeric',
            xLabel: '\\omega',
            yLabel: 'A',
        },
        { xmin: -6.283, xmax: 6.283, ymin: -2, ymax: 2 }
    );
    assert.equal(mixed.x.isPi, true);
    assert.equal(mixed.y.isPi, false);
    near(mixed.stepX, Math.PI, 1e-4);
    near(mixed.stepY, 0.5, 1e-4);

    // 3. Small plot width requires reduced tick density (widens step)
    const normalPlan = computeTickPlan(
        {
            width: 760,
            height: 480,
            tickFormatX: 'pi',
            xLabel: 'x',
        },
        { xmin: -3.5, xmax: 3.5, ymin: -2, ymax: 2 }
    );
    const smallPlan = computeTickPlan(
        {
            width: 250, // very small width forces widening
            height: 200,
            tickFormatX: 'pi',
            xLabel: 'x',
        },
        { xmin: -3.5, xmax: 3.5, ymin: -2, ymax: 2 }
    );
    assert.ok(smallPlan.stepX >= normalPlan.stepX, 'small plot widens pi tick step to avoid overcrowding');

    // 4. End-to-end equivalence between computeTickPlan and SettingsManager.generateTikzCode
    const sm = SettingsManager.fromJSON({
        v: 4,
        xmin: '-6.283',
        xmax: '6.283',
        ymin: '-3.142',
        ymax: '3.142',
        tickFormatX: 'pi',
        tickFormatY: 'pi',
        axis_style: 'middle',
        size_x_cm: 12,
        size_y_cm: 8,
    });
    const cfg = sm.toRendererConfig();
    const tikz = sm.generateTikzCode();
    // Verify TikZ export contains xtick and ytick matching the plan
    const plan = computeTickPlan(cfg, { xmin: cfg.xmin, xmax: cfg.xmax, ymin: cfg.ymin, ymax: cfg.ymax });
    const expectedXtick = plan.x.ticks.map(fmtNum).join(', ');
    assert.ok(tikz.includes(`xtick={${expectedXtick}}`), 'TikZ export xtick matches shared plan');
    const expectedYtick = plan.y.ticks.map(fmtNum).join(', ');
    assert.ok(tikz.includes(`ytick={${expectedYtick}}`), 'TikZ export ytick matches shared plan');
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
