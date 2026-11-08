/*
 * Graph appearance presets: professional aspect ratios, axis styles, tick
 * densities and grid configurations (Academic 4:3, Wide 16:9, Signals & Systems 5:2,
 * Clean Cartesian 3:2, Portrait 3:4, Classic Square 1:1, and Custom).
 */
import { AxisStyle } from './types';
import { SettingsManager } from './settings';

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
    if (typeof explicit === 'string' && explicit !== 'custom') {
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

export interface PresetSampleDefinition {
    id: AppearancePresetId;
    title: string;
    ratio: string;
    subtitle: string;
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
    expression: string;
    color: string;
    thickness: 'thin' | 'normal' | 'thick' | 'very_thick';
}

export const PRESET_SAMPLES: readonly PresetSampleDefinition[] = [
    {
        id: 'academic',
        title: 'Academic',
        ratio: '4:3',
        subtitle: 'Balanced · Box · Grid',
        xmin: -3,
        xmax: 3,
        ymin: -1,
        ymax: 5,
        expression: '0.5*x^2',
        color: 'blue',
        thickness: 'thick',
    },
    {
        id: 'wide',
        title: 'Wide',
        ratio: '16:9',
        subtitle: 'Presentation · Box · Grid',
        xmin: -5,
        xmax: 5,
        ymin: -2,
        ymax: 2,
        expression: '1.2*cos(x)',
        color: 'teal',
        thickness: 'thick',
    },
    {
        id: 'signals-systems',
        title: 'Signals & Systems',
        ratio: '5:2',
        subtitle: 'Waveform · Middle axes',
        xmin: -5,
        xmax: 5,
        ymin: -1.5,
        ymax: 1.5,
        expression: 'exp(-0.35*abs(x)) * cos(2.5*x)',
        color: 'blue',
        thickness: 'thick',
    },
    {
        id: 'clean-cartesian',
        title: 'Clean Cartesian',
        ratio: '3:2',
        subtitle: 'Origin crossing · Minimal',
        xmin: -3,
        xmax: 3,
        ymin: -3,
        ymax: 3,
        expression: '0.4*(x^3 - 3*x)',
        color: 'purple',
        thickness: 'thick',
    },
    {
        id: 'portrait',
        title: 'Portrait',
        ratio: '3:4',
        subtitle: 'Vertical · Box · Grid',
        xmin: -2,
        xmax: 2,
        ymin: -4,
        ymax: 4,
        expression: '0.6*x^3',
        color: 'orange',
        thickness: 'thick',
    },
    {
        id: 'classic-square',
        title: 'Classic Square',
        ratio: '1:1',
        subtitle: 'Original 1:1 · Box',
        xmin: -3,
        xmax: 3,
        ymin: -3,
        ymax: 3,
        expression: '2.5 - 0.5*x^2',
        color: 'blue',
        thickness: 'thick',
    },
    {
        id: 'custom',
        title: 'Custom',
        ratio: 'Variable',
        subtitle: 'Current manual settings',
        xmin: -3,
        xmax: 3,
        ymin: -3,
        ymax: 3,
        expression: 'x^2',
        color: 'blue',
        thickness: 'thick',
    },
];

/**
 * Create a SettingsManager configured with the preset or sample function for preview.
 */
export function createPresetPreviewSettings(
    presetId: AppearancePresetId,
    currentSettings?: SettingsManager
): SettingsManager {
    const s = new SettingsManager();
    const preset = getPresetById(presetId);
    const sample = PRESET_SAMPLES.find((p) => p.id === presetId);

    if (presetId === 'custom') {
        if (currentSettings) {
            for (const [k, v] of Object.entries(currentSettings.serialize())) {
                s.setValue(k, v);
            }
        }
        const funcs = (s.getValue('functions') as unknown[]) || [];
        if (!funcs.length) {
            s.setValue('functions', [
                {
                    id: 'custom_f1',
                    name: 'f1',
                    expression: 'x^2',
                    color: 'blue',
                    thickness: 'thick',
                },
            ]);
        }
    } else if (preset && sample) {
        applyPreset(s, preset.id);
        s.setValue('xmin', String(sample.xmin));
        s.setValue('xmax', String(sample.xmax));
        s.setValue('ymin', String(sample.ymin));
        s.setValue('ymax', String(sample.ymax));
        s.setValue('title', '');
        s.setValue('show_axis_label', true);
        s.setValue('functions', [
            {
                id: `sample_${preset.id}`,
                name: 'f1',
                expression: sample.expression,
                color: sample.color,
                thickness: sample.thickness,
            },
        ]);
    }

    return s;
}
