/*
 * Signals & Systems utilities: pi-aware tick formatting, discrete sequence
 * expansion, and geometry snapping for direct canvas drawing.
 */
import { Pt } from './geometry';

/**
 * Format a number as a multiple of pi when it is close to a rational fraction of pi.
 * Supports denominators 1, 2, 3, 4, 6 (e.g. -2pi, -pi, -pi/2, 0, pi/2, pi, 2pi).
 * Returns null when the number is not close to a recognized fraction of pi.
 */
export function formatPiTick(value: number, tolerance = 1e-4): string | null {
    if (Math.abs(value) < 1e-9) return '0';

    const k = value / Math.PI;
    const denominators = [1, 2, 3, 4, 6];

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
export function formatPiLatex(value: number, tolerance = 1e-4): string | null {
    if (Math.abs(value) < 1e-9) return '0';

    const k = value / Math.PI;
    const denominators = [1, 2, 3, 4, 6];

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
 * Check whether a series of tick values naturally warrants pi-formatting.
 */
export function shouldUsePiTicks(
    values: readonly number[],
    mode: 'auto' | 'numeric' | 'pi' = 'auto',
    explicitExprs: string[] = []
): boolean {
    if (mode === 'numeric') return false;
    if (mode === 'pi') return true;

    // In 'auto' mode, check if any bound or formula explicitly mentions 'pi'
    for (const expr of explicitExprs) {
        if (/\bpi\b/i.test(expr)) return true;
    }

    // Check if at least two non-zero ticks match a fraction of pi
    let matches = 0;
    for (const v of values) {
        if (Math.abs(v) > 1e-6 && formatPiTick(v) !== null) {
            matches++;
        }
    }

    return matches >= 2;
}

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
    // Strip brackets and clean up commas / whitespace
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

/**
 * Snapping target description.
 */
export interface SnapResult {
    point: Pt;
    screen: Pt;
    kind: 'grid' | 'point' | 'axis' | 'origin' | 'shift';
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
}

/**
 * Compute the best snap candidate within thresholdPx (default 12 px).
 */
export function findSnapCandidate(
    cursorMath: Pt,
    context: SnapContext
): SnapResult | null {
    const { view, stepX, stepY, toScreen, existingPoints, lastPoint, shiftHeld } = context;
    const threshold = context.thresholdPx ?? 12;
    const cursorPx = toScreen(cursorMath);

    let best: SnapResult | null = null;
    const check = (candidate: Pt, kind: SnapResult['kind']) => {
        const sc = toScreen(candidate);
        const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
        if (dist <= threshold) {
            if (!best || dist < best.distPx) {
                best = { point: candidate, screen: sc, kind, distPx: dist };
            }
        }
    };

    // 1. Shift constraint (horizontal or vertical alignment with last placed point)
    if (shiftHeld && lastPoint) {
        const dx = Math.abs(cursorMath.x - lastPoint.x);
        const dy = Math.abs(cursorMath.y - lastPoint.y);
        const aligned = dx >= dy ? { x: cursorMath.x, y: lastPoint.y } : { x: lastPoint.x, y: cursorMath.y };
        const sc = toScreen(aligned);
        const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
        if (dist <= threshold * 2) {
            best = { point: aligned, screen: sc, kind: 'shift', distPx: dist };
        }
    }

    // 2. Existing points (highest priority for connectivity)
    if (existingPoints) {
        for (const ep of existingPoints) {
            check(ep, 'point');
        }
    }

    // 3. Axes (x=0 or y=0)
    if (view.ymin <= 0 && view.ymax >= 0) {
        check({ x: cursorMath.x, y: 0 }, 'axis');
    }
    if (view.xmin <= 0 && view.xmax >= 0) {
        check({ x: 0, y: cursorMath.y }, 'axis');
    }

    // 4. Origin (0, 0) - takes precedence over 1D axis lines when within threshold
    if (view.xmin <= 0 && view.xmax >= 0 && view.ymin <= 0 && view.ymax >= 0) {
        const sc = toScreen({ x: 0, y: 0 });
        const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
        if (dist <= threshold) {
            best = { point: { x: 0, y: 0 }, screen: sc, kind: 'origin', distPx: dist };
        }
    }

    // 5. Grid intersections
    if (stepX > 0 && stepY > 0) {
        const gx = Math.round(cursorMath.x / stepX) * stepX;
        const gy = Math.round(cursorMath.y / stepY) * stepY;
        check({ x: gx, y: gy }, 'grid');
    }

    return best;
}

/**
 * Format coordinates cleanly for path / point serialization.
 */
export function formatCoord(v: number): string {
    if (Math.abs(v) < 1e-6) return '0';
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-4) return String(r);
    // Trim unnecessary decimals
    return parseFloat(v.toFixed(3)).toString();
}
