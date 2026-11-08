/*
 * Signals & Systems utilities: pi-aware tick generation and formatting,
 * discrete sequence expansion, and geometry snapping for direct canvas drawing.
 */
import { Pt } from './geometry';
import { niceInterval } from './util';

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
    formulas: string[] = []
): boolean {
    if (mode === 'numeric') return false;
    if (mode === 'pi') return true;

    // In 'auto' mode:
    const labelStr = String(axisLabel ?? '').trim();
    if (/(?:[\u03c9\u03a9\u03b8\u03d5\u03c0]|\\?omega|\\?Omega|\\?theta|\\?phi|\\?pi|\brad\b|\bphase\b|\bfreq\b)/i.test(labelStr)) {
        return true;
    }

    const minStr = String(rawMin ?? '');
    const maxStr = String(rawMax ?? '');
    if (/\bpi\b/i.test(minStr) || /\bpi\b/i.test(maxStr)) {
        return true;
    }

    for (const f of formulas) {
        if (/\b(?:sin|cos|tan)\b/i.test(f) && /\bpi\b/i.test(f)) {
            return true;
        }
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
    // CASE A: Shift key held with a previous point (Strict H/V lock)
    // =========================================================================
    if (shiftHeld && lastPoint) {
        const dx = Math.abs(cursorMath.x - lastPoint.x);
        const dy = Math.abs(cursorMath.y - lastPoint.y);
        const isHorizontal = dx >= dy;

        // Base 1D constrained point
        const constrainedBase: Pt = isHorizontal
            ? { x: cursorMath.x, y: lastPoint.y }
            : { x: lastPoint.x, y: cursorMath.y };

        const baseSc = toScreen(constrainedBase);
        const baseDist = Math.hypot(baseSc.x - cursorPx.x, baseSc.y - cursorPx.y);

        let bestOnLine: Candidate = {
            point: constrainedBase,
            screen: baseSc,
            kind: 'shift',
            distPx: baseDist,
            tier: 1,
        };

        // Along the locked line, see if we snap to an existing point on this line
        if (existingPoints) {
            for (const ep of existingPoints) {
                const onLine = isHorizontal
                    ? Math.abs(ep.y - lastPoint.y) < 1e-5
                    : Math.abs(ep.x - lastPoint.x) < 1e-5;
                if (onLine) {
                    const sc = toScreen(ep);
                    const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
                    if (dist <= threshold && dist < bestOnLine.distPx) {
                        bestOnLine = { point: ep, screen: sc, kind: 'point', distPx: dist, tier: 1 };
                    }
                }
            }
        }

        // Along the locked line, see if we snap to the origin
        const originOnLine = isHorizontal
            ? Math.abs(lastPoint.y) < 1e-5
            : Math.abs(lastPoint.x) < 1e-5;
        if (originOnLine) {
            const sc = toScreen({ x: 0, y: 0 });
            const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
            if (dist <= threshold && dist < bestOnLine.distPx) {
                bestOnLine = { point: { x: 0, y: 0 }, screen: sc, kind: 'origin', distPx: dist, tier: 1 };
            }
        }

        // Along the locked line, see if we snap to a grid step along the line
        if (isHorizontal && stepX > 0) {
            const gx = Math.round(cursorMath.x / stepX) * stepX;
            const cand: Pt = { x: gx, y: lastPoint.y };
            const sc = toScreen(cand);
            const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
            if (dist <= threshold && dist < bestOnLine.distPx) {
                bestOnLine = { point: cand, screen: sc, kind: 'grid', distPx: dist, tier: 1 };
            }
        } else if (!isHorizontal && stepY > 0) {
            const gy = Math.round(cursorMath.y / stepY) * stepY;
            const cand: Pt = { x: lastPoint.x, y: gy };
            const sc = toScreen(cand);
            const dist = Math.hypot(sc.x - cursorPx.x, sc.y - cursorPx.y);
            if (dist <= threshold && dist < bestOnLine.distPx) {
                bestOnLine = { point: cand, screen: sc, kind: 'grid', distPx: dist, tier: 1 };
            }
        }

        return {
            point: bestOnLine.point,
            screen: bestOnLine.screen,
            kind: bestOnLine.kind,
            distPx: bestOnLine.distPx,
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
