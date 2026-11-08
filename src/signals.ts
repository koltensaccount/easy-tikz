/*
 * Signals & Systems utilities: pi-aware tick generation and formatting,
 * discrete sequence expansion, and geometry snapping for direct canvas drawing.
 */
import { Pt } from './geometry';
import { formatTick, nextNiceStep, niceInterval, tickValues } from './util';

// ---------------------------------------------------------------------------
// π Tick Generation & Formatting
// ---------------------------------------------------------------------------

/**
 * Standard fraction multipliers of pi:
 * pi/12, pi/6, pi/4, pi/3, pi/2, pi, 2*pi, 5*pi, 10*pi...
 */
const BASE_PI_FRACTIONS: readonly number[] = [
    1 / 12,
    1 / 6,
    1 / 4,
    1 / 3,
    1 / 2,
    1,
    2,
    5,
];

/**
 * Compute a rational, readable step in multiples of pi for a given span.
 */
export function piTickStep(span: number, targetCount = 6): number {
    const target = Math.max(2, targetCount);
    const rough = Math.abs(span) / target;
    const r = rough / Math.PI;

    if (r <= 0.05) {
        // Very zoomed in: scale down
        const mag = Math.pow(10, Math.floor(Math.log10(r)));
        return Math.max(1e-4, niceInterval(rough, target));
    }
    if (r <= 0.12) return (Math.PI / 12);
    if (r <= 0.20) return (Math.PI / 6);
    if (r <= 0.29) return (Math.PI / 4);
    if (r <= 0.40) return (Math.PI / 3);
    if (r <= 0.75) return (Math.PI / 2);
    if (r <= 1.5) return Math.PI;
    if (r <= 3.5) return 2 * Math.PI;
    if (r <= 7.5) return 5 * Math.PI;

    // For larger steps: standard nice multiples (10*pi, 20*pi, 50*pi, etc.)
    const mag = Math.pow(10, Math.floor(Math.log10(r)));
    const norm = r / mag;
    let nice = 10;
    if (norm <= 1.5) nice = 1;
    else if (norm <= 3) nice = 2;
    else if (norm <= 7) nice = 5;
    return nice * mag * Math.PI;
}

/**
 * Advance to the next larger pi step when labels would collide.
 */
export function nextPiStep(step: number): number {
    const k = step / Math.PI;
    if (k < 1 / 12 * 0.95) return (Math.PI / 12);
    if (k < 1 / 6 * 0.95) return (Math.PI / 6);
    if (k < 1 / 4 * 0.95) return (Math.PI / 4);
    if (k < 1 / 3 * 0.95) return (Math.PI / 3);
    if (k < 1 / 2 * 0.95) return (Math.PI / 2);
    if (k < 1 * 0.95) return Math.PI;
    if (k < 2 * 0.95) return 2 * Math.PI;
    if (k < 5 * 0.95) return 5 * Math.PI;

    // Above 5*pi: standard 10*pi, 20*pi, 50*pi...
    const mag = Math.pow(10, Math.floor(Math.log10(k)));
    const norm = k / mag;
    let nextNorm: number;
    if (norm < 1.95) nextNorm = 2;
    else if (norm < 4.95) nextNorm = 5;
    else nextNorm = 10;
    return nextNorm * mag * Math.PI;
}

/**
 * Generate tick values at exact integer multiples of a pi-step inside [min, max].
 */
export function piTickValues(min: number, max: number, step: number, cap = 1000): number[] {
    if (!(step > 0) || !Number.isFinite(step) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
    const slack = step * 1e-9;
    const first = Math.ceil((min - slack) / step);
    const last = Math.floor((max + slack) / step);
    if (last - first + 1 > cap) return [];
    const out: number[] = [];
    for (let k = first; k <= last; k++) {
        out.push(k === 0 ? 0 : k * step);
    }
    return out;
}

/**
 * Determine whether an axis should use pi-based ticks.
 */
export function isPiAxis(
    mode: 'auto' | 'numeric' | 'pi' | undefined,
    axisLabel?: string,
    rawMin?: string | number,
    rawMax?: string | number,
    _formulas: string[] = []
): boolean {
    if (mode === 'numeric') return false;
    if (mode === 'pi') return true;

    // In 'auto' mode:
    // 1. Explicit pi-based bounds (e.g. -2*pi, 2*pi, pi/2, etc.)
    const minStr = String(rawMin ?? '');
    const maxStr = String(rawMax ?? '');
    if (/(?:\\pi|\bpi\b|[\u03c0])/i.test(minStr) || /(?:\\pi|\bpi\b|[\u03c0])/i.test(maxStr)) {
        return true;
    }

    const labelStr = String(axisLabel ?? '').trim();
    // 2. Explicit time or ordinary frequency (Hz) retain numeric ticks
    if (/^(?:t|time|sec|seconds?|s|ms|f|freq|frequency|hz)$/i.test(labelStr)) {
        return false;
    }

    // 3. Strong evidence that the axis represents angular position, phase, or angular frequency
    if (/(?:[\u03c9\u03a9\u03b8\u03d5\u03c8\u03c0]|\\?(?:omega|Omega|theta|phi|psi|pi)\b|\brad\b|\bradians?\b|\brad\/s\b|\bphase\b|\bangle\b|\bangular\b)/i.test(labelStr)) {
        return true;
    }

    return false;
}

/**
 * Format a number as a multiple of pi when it is close to a rational fraction of pi.
 * Supports denominators 1, 2, 3, 4, 6, 12.
 */
export function formatPiTick(value: number, tolerance = 1e-3): string | null {
    if (Math.abs(value) < 1e-9) return '0';

    const k = value / Math.PI;
    const denominators = [1, 2, 3, 4, 6, 12];

    for (const q of denominators) {
        const p = Math.round(k * q);
        if (Math.abs(value - (p / q) * Math.PI) <= tolerance) {
            return formatPiFraction(p, q, 'unicode');
        }
    }

    return null;
}

/**
 * Format a number as LaTeX for TikZ export when it is a multiple of pi.
 */
export function formatPiLatex(value: number, tolerance = 1e-3): string | null {
    if (Math.abs(value) < 1e-9) return '0';

    const k = value / Math.PI;
    const denominators = [1, 2, 3, 4, 6, 12];

    for (const q of denominators) {
        const p = Math.round(k * q);
        if (Math.abs(value - (p / q) * Math.PI) <= tolerance) {
            return formatPiFraction(p, q, 'latex');
        }
    }

    return null;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x;
}

function formatPiFraction(p: number, q: number, mode: 'unicode' | 'latex'): string {
    const sign = p < 0 ? '-' : '';
    const absP = Math.abs(p);
    const g = gcd(absP, q);
    const num = absP / g;
    const den = q / g;

    const piSym = mode === 'latex' ? '\\pi' : 'π';

    if (num === 0) return '0';

    let body = '';
    if (den === 1) {
        body = num === 1 ? piSym : `${num}${piSym}`;
    } else {
        if (num === 1) {
            body = `${piSym}/${den}`;
        } else {
            body = `${num}${piSym}/${den}`;
        }
    }

    const res = `${sign}${body}`;
    return mode === 'latex' ? `$${res}$` : res;
}

/**
 * Backwards compatibility check for existing tests.
 */
export function shouldUsePiTicks(
    values: readonly number[],
    mode: 'auto' | 'numeric' | 'pi' = 'auto',
    explicitExprs: string[] = []
): boolean {
    if (mode === 'numeric') return false;
    if (mode === 'pi') return true;

    for (const expr of explicitExprs) {
        if (/\bpi\b/i.test(expr)) return true;
    }

    let matches = 0;
    for (const v of values) {
        if (Math.abs(v) > 1e-6 && formatPiTick(v) !== null) {
            matches++;
        }
    }

    return matches >= 2;
}

// ---------------------------------------------------------------------------
// Shared Tick Planning (Consistent Preview & Export)
// ---------------------------------------------------------------------------

export interface AxisTickPlan {
    isPi: boolean;
    step: number;
    ticks: number[];
    labelsSvg: string[];
    labelsLatex: string[];
}

export interface ChartTickPlan {
    x: AxisTickPlan;
    y: AxisTickPlan;
    stepX: number;
    stepY: number;
}

/**
 * Compute the shared tick plan used consistently by both SVG preview and TikZ export.
 */
export function computeTickPlan(
    config: {
        width?: number;
        height?: number;
        paperWidthCm?: number;
        majorTickNum?: number;
        equalScale?: boolean;
        polar?: boolean;
        coordinateSystem?: string;
        tickFormatX?: 'auto' | 'numeric' | 'pi';
        tickFormatY?: 'auto' | 'numeric' | 'pi';
        xLabel?: string;
        yLabel?: string;
        rawRanges?: { xmin?: string; xmax?: string; ymin?: string; ymax?: string };
        functions?: { expression?: string }[];
    },
    view: { xmin: number; xmax: number; ymin: number; ymax: number }
): ChartTickPlan {
    const formulas = config.functions?.map((f) => f.expression || '') || [];
    const isPiX = isPiAxis(config.tickFormatX, config.xLabel, config.rawRanges?.xmin, config.rawRanges?.xmax, formulas);
    const isPiY = isPiAxis(config.tickFormatY, config.yLabel, config.rawRanges?.ymin, config.rawRanges?.ymax, formulas);

    const targetX = config.majorTickNum && config.majorTickNum > 0 ? config.majorTickNum : 8;
    const targetY = Math.max(2, Math.round(targetX * 0.7));

    const dx = view.xmax - view.xmin;
    const dy = view.ymax - view.ymin;
    const equal = !!(config.equalScale || config.polar || config.coordinateSystem === 'polar');

    const plotW = config.width && config.width > 0 ? config.width * 0.85 : 650;
    const plotH = config.height && config.height > 0 ? config.height * 0.8 : 380;
    const paperCm = Number(config.paperWidthCm);
    const paperPt = (Number.isFinite(paperCm) && paperCm > 0 ? paperCm : 10) * 28.4527559;
    const ptPx = Math.max(1, Math.min(2.5, config.width && config.width > 0 ? config.width / paperPt : 1));
    const fs = 10 * ptPx;
    const charWidthEm = 0.56;

    let sx = isPiX ? piTickStep(dx, targetX) : (equal ? niceInterval(Math.max(dx, dy), targetX) : niceInterval(dx, targetX));
    let sy = isPiY ? piTickStep(dy, targetY) : (equal ? sx : niceInterval(dy, targetY));

    const formatX = (x: number) => (isPiX ? formatPiTick(x) ?? formatTick(x) : formatTick(x));
    const formatY = (y: number) => (isPiY ? formatPiTick(y) ?? formatTick(y) : formatTick(y));

    const fitsX = (step: number) => {
        const ticks = isPiX ? piTickValues(view.xmin, view.xmax, step) : tickValues(view.xmin, view.xmax, step);
        const widest = ticks.reduce((m, t) => Math.max(m, formatX(t).length), 1) * fs * charWidthEm;
        return ticks.length < 2 || (plotW * step) / dx >= widest + fs * 0.8;
    };
    const fitsY = (step: number) => (plotH * step) / dy >= fs * 1.6;

    for (let k = 0; k < 8 && !(fitsX(sx) && (!equal || fitsY(sx))); k++) {
        sx = isPiX ? nextPiStep(sx) : nextNiceStep(sx);
    }
    if (equal) {
        sy = sx;
    } else {
        for (let k = 0; k < 8 && !fitsY(sy); k++) {
            sy = isPiY ? nextPiStep(sy) : nextNiceStep(sy);
        }
    }

    const ticksX = isPiX ? piTickValues(view.xmin, view.xmax, sx) : tickValues(view.xmin, view.xmax, sx);
    const ticksY = isPiY ? piTickValues(view.ymin, view.ymax, sy) : tickValues(view.ymin, view.ymax, sy);

    return {
        x: {
            isPi: isPiX,
            step: sx,
            ticks: ticksX,
            labelsSvg: ticksX.map(formatX),
            labelsLatex: ticksX.map((x) => (isPiX ? formatPiLatex(x) ?? `$${formatTick(x)}$` : `$${formatTick(x)}$`)),
        },
        y: {
            isPi: isPiY,
            step: sy,
            ticks: ticksY,
            labelsSvg: ticksY.map(formatY),
            labelsLatex: ticksY.map((y) => (isPiY ? formatPiLatex(y) ?? `$${formatTick(y)}$` : `$${formatTick(y)}$`)),
        },
        stepX: sx,
        stepY: sy,
    };
}

// ---------------------------------------------------------------------------
// Discrete Sequence Parser
// ---------------------------------------------------------------------------

/**
 * Expand a discrete sequence specified as values, e.g. "1, 2, 0, -1, 2" or "[1, 2, 0, -1, 2]"
 * starting at integer index n0, into tuple points: `(-2, 1); (-1, 2); (0, 0); ...`.
 * Supports optional periodic repetition.
 */
export function parseSequenceToPoints(
    raw: string,
    n0 = 0,
    options: { repeat?: number; period?: number } = {}
): string {
    const cleaned = raw.replace(/[\[\]]/g, '').trim();
    if (!cleaned) return '';

    const parts = cleaned.split(/[,;\s]+/).filter((p) => p.length > 0);
    const values: string[] = [];

    for (const p of parts) {
        values.push(p);
    }

    if (!values.length) return '';

    const tuples: string[] = [];
    const repeatCount = Math.max(1, Math.min(20, options.repeat ?? 1));
    const period = Math.max(values.length, options.period ?? values.length);

    for (let r = 0; r < repeatCount; r++) {
        const offset = n0 + r * period;
        for (let i = 0; i < values.length; i++) {
            const n = offset + i;
            const val = values[i];
            tuples.push(`(${n}, ${val})`);
        }
    }

    return tuples.join('; ');
}

// ---------------------------------------------------------------------------
// Snapping Engine with Multi-Tier Priority Policy
// ---------------------------------------------------------------------------

/**
 * Snapping target description.
 */
export interface SnapResult {
    point: Pt;
    screen: Pt;
    kind: 'shift' | 'point' | 'origin' | 'grid' | 'axis';
    distPx: number;
}

export interface SnapContext {
    view: { xmin: number; xmax: number; ymin: number; ymax: number };
    stepX: number;
    stepY: number;
    toScreen: (p: Pt) => Pt;
    existingPoints?: readonly Pt[];
    lastPoint?: Pt | null;
    shiftHeld?: boolean;
    thresholdPx?: number;
    snapEnabled?: boolean;
}

interface Candidate {
    point: Pt;
    screen: Pt;
    kind: SnapResult['kind'];
    distPx: number;
    tier: number; // 1 = shift, 2 = point, 3 = origin, 4 = grid, 5 = axis
}

/**
 * Compute the best snap candidate respecting the strict priority hierarchy:
 * 1. Shift-constrained alignment (never overridden to off-axis coordinates)
 * 2. User existing points/vertices
 * 3. Origin (0,0) (unless closer existing point)
 * 4. Grid intersections (0D points)
 * 5. Axis lines (1D projections)
 */
export function findSnapCandidate(
    cursorMath: Pt,
    context: SnapContext
): SnapResult | null {
    if (context.snapEnabled === false) return null;

    const { view, stepX, stepY, toScreen, existingPoints, lastPoint, shiftHeld } = context;
    const threshold = context.thresholdPx ?? 12;
    const cursorPx = toScreen(cursorMath);

    // =========================================================================
    // CASE A: Shift key held with a previous point (Strict H/V lock + 1D snap)
    // =========================================================================
    if (shiftHeld && lastPoint) {
        const lastPx = toScreen(lastPoint);
        const isHorizontal = Math.abs(cursorPx.x - lastPx.x) >= Math.abs(cursorPx.y - lastPx.y);

        // Base 1D constrained point
        const constrainedBase: Pt = isHorizontal
            ? { x: cursorMath.x, y: lastPoint.y }
            : { x: lastPoint.x, y: cursorMath.y };

        const baseSc = toScreen(constrainedBase);

        // Fallback candidate: pure projection along constraint line
        const bestCandidate: Candidate = {
            point: constrainedBase,
            screen: baseSc,
            kind: 'shift',
            distPx: Math.hypot(baseSc.x - cursorPx.x, baseSc.y - cursorPx.y),
            tier: 4,
        };

        // Priority 1: Existing vertices on or projecting to the constraint line
        let bestPtCandidate: Candidate | null = null;
        if (existingPoints) {
            for (const ep of existingPoints) {
                const epSc = toScreen(ep);
                const distPerp = isHorizontal ? Math.abs(epSc.y - baseSc.y) : Math.abs(epSc.x - baseSc.x);
                if (distPerp <= threshold) {
                    const candPt: Pt = isHorizontal ? { x: ep.x, y: lastPoint.y } : { x: lastPoint.x, y: ep.y };
                    const candSc = toScreen(candPt);
                    const distAlong = isHorizontal ? Math.abs(candSc.x - baseSc.x) : Math.abs(candSc.y - baseSc.y);
                    if (distAlong <= threshold && (!bestPtCandidate || distAlong < bestPtCandidate.distPx)) {
                        bestPtCandidate = { point: candPt, screen: candSc, kind: 'point', distPx: distAlong, tier: 1 };
                    }
                }
            }
        }

        // Priority 2: Origin on the constraint line
        let originCandidate: Candidate | null = null;
        const originOnLine = isHorizontal ? Math.abs(lastPoint.y) < 1e-5 : Math.abs(lastPoint.x) < 1e-5;
        if (originOnLine) {
            const candPt: Pt = isHorizontal ? { x: 0, y: lastPoint.y } : { x: lastPoint.x, y: 0 };
            const candSc = toScreen(candPt);
            const distAlong = isHorizontal ? Math.abs(candSc.x - baseSc.x) : Math.abs(candSc.y - baseSc.y);
            if (distAlong <= threshold) {
                originCandidate = { point: candPt, screen: candSc, kind: 'origin', distPx: distAlong, tier: 2 };
            }
        }

        // Priority 3: Grid position along the constraint line
        let gridCandidate: Candidate | null = null;
        if (isHorizontal && stepX > 0) {
            const gx = Math.round(cursorMath.x / stepX) * stepX;
            const candPt: Pt = { x: gx, y: lastPoint.y };
            const candSc = toScreen(candPt);
            const distAlong = Math.abs(candSc.x - baseSc.x);
            if (distAlong <= threshold) {
                gridCandidate = { point: candPt, screen: candSc, kind: 'grid', distPx: distAlong, tier: 3 };
            }
        } else if (!isHorizontal && stepY > 0) {
            const gy = Math.round(cursorMath.y / stepY) * stepY;
            const candPt: Pt = { x: lastPoint.x, y: gy };
            const candSc = toScreen(candPt);
            const distAlong = Math.abs(candSc.y - baseSc.y);
            if (distAlong <= threshold) {
                gridCandidate = { point: candPt, screen: candSc, kind: 'grid', distPx: distAlong, tier: 3 };
            }
        }

        const chosen = bestPtCandidate ?? originCandidate ?? gridCandidate ?? bestCandidate;
        return {
            point: chosen.point,
            screen: chosen.screen,
            kind: chosen.kind,
            distPx: chosen.distPx,
        };
    }

    // =========================================================================
    // CASE B: Free snapping (No Shift held)
    // =========================================================================
    let bestCandidate: Candidate | null = null;

    const consider = (cand: Candidate) => {
        if (cand.distPx > threshold) return;
        if (!bestCandidate) {
            bestCandidate = cand;
            return;
        }

        // Higher priority tier (lower tier index) wins
        if (cand.tier < bestCandidate.tier) {
            // Special care between Tier 2 (existing point) and Tier 3 (origin):
            // Existing point wins unless origin is closer by at least 2 pixels
            if (bestCandidate.tier === 2 && cand.tier === 3) {
                if (cand.distPx < bestCandidate.distPx - 2) {
                    bestCandidate = cand;
                }
                return;
            }
            bestCandidate = cand;
            return;
        }

        if (cand.tier === bestCandidate.tier) {
            // Same tier: strictly closer screen distance wins
            if (cand.distPx < bestCandidate.distPx) {
                bestCandidate = cand;
            }
            return;
        }

        // Lower priority tier: only wins if competing against axis line (tier 5) with a significantly closer point
        if (cand.tier === 3 && bestCandidate.tier === 2) {
            if (cand.distPx < bestCandidate.distPx - 2) {
                bestCandidate = cand;
            }
        }
    };

    // 1. Tier 2: User Existing Points (Highest geometric priority)
    if (existingPoints) {
        for (const ep of existingPoints) {
            const sc = toScreen(ep);
            const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
            consider({ point: ep, screen: sc, kind: 'point', distPx: dist, tier: 2 });
        }
    }

    // 2. Tier 3: Origin (0,0) (Landmark 0D point)
    if (view.xmin <= 0 && view.xmax >= 0 && view.ymin <= 0 && view.ymax >= 0) {
        const sc = toScreen({ x: 0, y: 0 });
        const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
        consider({ point: { x: 0, y: 0 }, screen: sc, kind: 'origin', distPx: dist, tier: 3 });
    }

    // 3. Tier 4: Grid Intersections (0D intersection points)
    if (stepX > 0 && stepY > 0) {
        const gx = Math.round(cursorMath.x / stepX) * stepX;
        const gy = Math.round(cursorMath.y / stepY) * stepY;
        const sc = toScreen({ x: gx, y: gy });
        const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
        consider({ point: { x: gx, y: gy }, screen: sc, kind: 'grid', distPx: dist, tier: 4 });
    }

    // 4. Tier 5: Axis Lines (1D line projections)
    if (view.ymin <= 0 && view.ymax >= 0) {
        const ptOnX: Pt = { x: cursorMath.x, y: 0 };
        const sc = toScreen(ptOnX);
        const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
        consider({ point: ptOnX, screen: sc, kind: 'axis', distPx: dist, tier: 5 });
    }
    if (view.xmin <= 0 && view.xmax >= 0) {
        const ptOnY: Pt = { x: 0, y: cursorMath.y };
        const sc = toScreen(ptOnY);
        const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
        consider({ point: ptOnY, screen: sc, kind: 'axis', distPx: dist, tier: 5 });
    }

    const winner = bestCandidate as Candidate | null;
    if (!winner) return null;
    return {
        point: winner.point,
        screen: winner.screen,
        kind: winner.kind,
        distPx: winner.distPx,
    };
}

/**
 * Format coordinates cleanly for path / point serialization.
 */
export function formatCoord(v: number): string {
    if (Math.abs(v) < 1e-6) return '0';
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-4) return String(r);
    return parseFloat(v.toFixed(3)).toString();
}
