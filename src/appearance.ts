/*
 * Graph appearance presets: professional aspect ratios, axis styles, tick
 * densities and grid configurations (Academic 4:3, Wide 16:9, Signals & Systems 5:2,
 * Clean Cartesian 3:2, Portrait 3:4, Classic Square 1:1, and Custom).
 */
import { AxisStyle, FunctionParameters, Tool } from './types';
import { SettingsManager } from './settings';
import { MathContext } from './mathcontext';
import { EXAMPLES } from './migrate';
import { cloneData } from './util';

export type AppearancePresetId =
    | 'academic'
    | 'wide'
    | 'signals-systems'
    | 'clean-cartesian'
    | 'portrait'
    | 'classic-square'
    | 'custom';

export interface AppearancePreset {
    id: AppearancePresetId;
    name: string;
    ratio: string;
    description: string;
    size_x_cm: number;
    size_y_cm: number;
    axis_style: AxisStyle;
    showLargeGrid: boolean;
    showSmallGrid: boolean;
    majorTickNum: number;
    gridSize: number;
}

export const GRAPH_APPEARANCE_PRESETS: readonly AppearancePreset[] = [
    {
        id: 'academic',
        name: 'Academic',
        ratio: '4:3',
        description: 'Balanced landscape graph with subtle axes, restrained ticks, minimal grid',
        size_x_cm: 12,
        size_y_cm: 9,
        axis_style: 'box',
        showLargeGrid: true,
        showSmallGrid: false,
        majorTickNum: 6,
        gridSize: 5,
    },
    {
        id: 'wide',
        name: 'Wide',
        ratio: '16:9',
        description: 'Elegant, wide graph suitable for presentations and notes',
        size_x_cm: 16,
        size_y_cm: 9,
        axis_style: 'box',
        showLargeGrid: true,
        showSmallGrid: false,
        majorTickNum: 8,
        gridSize: 5,
    },
    {
        id: 'signals-systems',
        name: 'Signals & Systems',
        ratio: '5:2',
        description: 'Wide, relatively short plotting area ideal for waveforms and time-domain signals',
        size_x_cm: 15,
        size_y_cm: 6,
        axis_style: 'middle',
        showLargeGrid: true,
        showSmallGrid: false,
        majorTickNum: 8,
        gridSize: 5,
    },
    {
        id: 'clean-cartesian',
        name: 'Clean Cartesian',
        ratio: '3:2',
        description: 'Axes through the origin, no enclosing box, minimal clutter',
        size_x_cm: 12,
        size_y_cm: 8,
        axis_style: 'middle',
        showLargeGrid: false,
        showSmallGrid: false,
        majorTickNum: 6,
        gridSize: 5,
    },
    {
        id: 'portrait',
        name: 'Portrait',
        ratio: '3:4',
        description: 'Taller plotting area for vertically oriented graphs',
        size_x_cm: 9,
        size_y_cm: 12,
        axis_style: 'box',
        showLargeGrid: true,
        showSmallGrid: false,
        majorTickNum: 6,
        gridSize: 5,
    },
    {
        id: 'classic-square',
        name: 'Classic Square',
        ratio: '1:1',
        description: 'Original square-style layout',
        size_x_cm: 10,
        size_y_cm: 10,
        axis_style: 'box',
        showLargeGrid: false,
        showSmallGrid: false,
        majorTickNum: 8,
        gridSize: 5,
    },
];

export const DEFAULT_APPEARANCE_ID: AppearancePresetId = 'academic';

export const APPEARANCE_OPTIONS: Array<{ value: AppearancePresetId; text: string }> = [
    { value: 'academic', text: 'Academic (4:3)' },
    { value: 'wide', text: 'Wide (16:9)' },
    { value: 'signals-systems', text: 'Signals & Systems (5:2)' },
    { value: 'clean-cartesian', text: 'Clean Cartesian (3:2)' },
    { value: 'portrait', text: 'Portrait (3:4)' },
    { value: 'classic-square', text: 'Classic Square (1:1)' },
    { value: 'custom', text: 'Custom' },
];

export function getPresetById(id: string): AppearancePreset | undefined {
    return GRAPH_APPEARANCE_PRESETS.find((p) => p.id === id);
}

/** Check whether current settings match a preset definition. */
export function matchesPreset(preset: AppearancePreset, settings: SettingsManager): boolean {
    const w = Number(settings.getValue('size_x_cm'));
    const h = Number(settings.getValue('size_y_cm'));
    if (!Number.isFinite(w) || !Number.isFinite(h)) return false;
    if (Math.abs(w - preset.size_x_cm) > 0.05 || Math.abs(h - preset.size_y_cm) > 0.05) return false;

    const axisStyle = (settings.getValue('axis_style') as AxisStyle) || 'box';
    if (axisStyle !== preset.axis_style) return false;

    const largeGrid = settings.getValue('showLargeGrid') === true;
    if (largeGrid !== preset.showLargeGrid) return false;

    const smallGrid = settings.getValue('showSmallGrid') === true;
    if (smallGrid !== preset.showSmallGrid) return false;

    const majorTicks = Number(settings.getValue('majorTickNum') ?? 8);
    if (majorTicks !== preset.majorTickNum) return false;

    const gridSize = Number(settings.getValue('gridSize') ?? 5);
    if (gridSize !== preset.gridSize) return false;

    return true;
}

/**
 * Determine which preset matches the settings, or 'custom'.
 */
export function detectPreset(settings: SettingsManager): AppearancePresetId {
    const explicit = settings.getValue('graphAppearance');
    if (explicit === 'custom') return 'custom';
    if (typeof explicit === 'string') {
        const found = getPresetById(explicit);
        if (found && matchesPreset(found, settings)) return found.id;
    }
    for (const p of GRAPH_APPEARANCE_PRESETS) {
        if (matchesPreset(p, settings)) return p.id;
    }
    return 'custom';
}

/**
 * Apply a preset to settings. If 'custom', leaves the underlying values
 * intact without resetting anything.
 */
export function applyPreset(settings: SettingsManager, id: AppearancePresetId): boolean {
    if (id === 'custom') {
        settings.setValue('graphAppearance', 'custom');
        return false;
    }
    const preset = getPresetById(id);
    if (!preset) return false;

    settings.setValue('size_x_cm', preset.size_x_cm);
    settings.setValue('size_y_cm', preset.size_y_cm);
    settings.setValue('axis_style', preset.axis_style);
    settings.setValue('showLargeGrid', preset.showLargeGrid);
    settings.setValue('showSmallGrid', preset.showSmallGrid);
    settings.setValue('majorTickNum', preset.majorTickNum);
    settings.setValue('gridSize', preset.gridSize);
    settings.setValue('graphAppearance', preset.id);
    return true;
}

/**
 * Context-aware origin centering logic:
 * - 'middle': (0,0) at plot center: [-W/2, W/2], [-H/2, H/2]
 * - 'box': (0,0) at bottom-left corner: [0, W], [0, H]
 * - 'axes': (0,0) at bottom-left corner: [0, W], [0, H] (preserving 'axes' style)
 * - 'polar' or 3D: (0,0) at center
 */
export function computeOriginBounds(
    axisStyle: AxisStyle,
    view: { xmin: number; xmax: number; ymin: number; ymax: number; zmin?: number; zmax?: number },
    options: { isPolar?: boolean; is3D?: boolean } = {}
): {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
    zmin?: number;
    zmax?: number;
} {
    const isPolar = options.isPolar === true;
    const is3D = options.is3D === true;
    const atCenter = isPolar || is3D || axisStyle === 'middle';

    const w = view.xmax - view.xmin;
    const h = view.ymax - view.ymin;

    const xmin = atCenter ? -w / 2 : 0;
    const xmax = atCenter ? w / 2 : w;
    const ymin = atCenter ? -h / 2 : 0;
    const ymax = atCenter ? h / 2 : h;

    const res: { xmin: number; xmax: number; ymin: number; ymax: number; zmin?: number; zmax?: number } = {
        xmin,
        xmax,
        ymin,
        ymax,
    };

    if (is3D && view.zmin !== undefined && view.zmax !== undefined) {
        const d = view.zmax - view.zmin;
        res.zmin = -d / 2;
        res.zmax = d / 2;
    }

    return res;
}

/**
 * Reposition the active ranges as a single edit. Fallback ranges are useful
 * for drawing, but must never replace a user's unresolved expression.
 */
export function centerOrigin(
    settings: SettingsManager,
    math: MathContext = settings.createMathContext()
): { changed: boolean; error?: string } {
    math.setParams(settings.mathContextInput().parameters ?? []);
    const is3D = settings.getValue('dimension') === true;
    const isPolar = !is3D && settings.getValue('coordinateSystem') === 'polar';
    const { view, errors } = settings.resolveView(math);
    const error = errors.find((message) => is3D || !message.startsWith('z'));
    if (error) return { changed: false, error };

    const style = settings.getValue<AxisStyle>('axis_style');
    const bounds = computeOriginBounds(style, view, { isPolar, is3D });
    const entries = Object.entries(bounds) as Array<[keyof typeof bounds, number]>;
    if (entries.some(([, value]) => !Number.isFinite(value)) ||
        bounds.xmin >= bounds.xmax || bounds.ymin >= bounds.ymax ||
        (bounds.zmin !== undefined && bounds.zmax !== undefined && bounds.zmin >= bounds.zmax)) {
        return { changed: false, error: 'Range is too large or too small to center' };
    }

    let changed = false;
    for (const [key, value] of entries) {
        if (value === view[key]) continue;
        // Shortest round-trippable number. Display rounding can shrink the span
        // of an expression (or even turn a tiny positive span into zero).
        settings.setValue(key, String(value));
        changed = true;
    }
    return { changed };
}

export interface PresetSampleDefinition {
    id: AppearancePresetId;
    title: string;
    ratio: string;
    subtitle: string;
    example?: string;
}

export const PRESET_SAMPLES: readonly PresetSampleDefinition[] = [
    { id: 'academic', title: 'Academic', ratio: '4:3', subtitle: 'Balanced box grid', example: 'lp' },
    { id: 'wide', title: 'Wide', ratio: '16:9', subtitle: 'Wide box grid', example: 'areas' },
    { id: 'signals-systems', title: 'Signals & Systems', ratio: '5:2', subtitle: 'Centered waveform' },
    { id: 'clean-cartesian', title: 'Clean Cartesian', ratio: '3:2', subtitle: 'Minimal middle axes', example: 'tangent' },
    { id: 'portrait', title: 'Portrait', ratio: '3:4', subtitle: 'Tall box grid', example: 'surplus' },
    { id: 'classic-square', title: 'Classic Square', ratio: '1:1', subtitle: 'Original box style', example: 'levels' },
    { id: 'custom', title: 'Custom', ratio: 'Variable', subtitle: 'Current appearance', example: 'areas' },
];

/** Use the stock examples as sample data, restyled by the chosen preset. */
export function createPresetPreviewSettings(
    presetId: AppearancePresetId,
    currentSettings?: SettingsManager
): SettingsManager {
    const sample = PRESET_SAMPLES.find((p) => p.id === presetId);
    const example = EXAMPLES.find((item) => item.id === sample?.example);
    const settings = example ? SettingsManager.fromJSON(cloneData(example.data)) : new SettingsManager();

    if (presetId === 'signals-systems') {
        settings.setValue('xmin', '-6');
        settings.setValue('xmax', '6');
        settings.setValue('ymin', '-1.2');
        settings.setValue('ymax', '1.2');
        settings.setValue('functions', [
            { name: 'f1', expression: 'exp(-0.32*abs(x))*cos(3*x)', color: 'blue', fill: true, fillOpacity: 0.25, thickness: 'very thick' },
            { name: 'f2', expression: 'exp(-0.32*abs(x))', color: 'teal', dashed: true, thickness: 'thin' },
            { name: 'f3', expression: '-exp(-0.32*abs(x))', color: 'teal', dashed: true, thickness: 'thin' },
        ]);
    } else {
        const functions = settings.getValue<FunctionParameters[]>('functions');
        settings.setValue('functions', functions.map((fn) => ({ ...fn, showLegend: false })));
        const tools = settings.getValue<Tool[]>('tools');
        settings.setValue('tools', tools.map((tool) => ({ ...tool, label: '', conditionLabels: [] })));
        settings.setValue('annotations', []);
    }
    settings.setValue('equalScale', false);

    if (presetId === 'custom' && currentSettings) {
        // Preview the style on a small, independent scene even if the user's
        // chart is 3D, expensive, or temporarily has invalid expressions.
        for (const key of ['size_x_cm', 'size_y_cm', 'axis_style', 'showLargeGrid', 'showSmallGrid', 'majorTickNum', 'gridSize']) {
            settings.setValue(key, currentSettings.getValue(key));
        }
    } else {
        applyPreset(settings, presetId);
    }
    return settings;
}
