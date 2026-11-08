/*
 * Tests for graph appearance presets, custom transitions, export proportions,
 * and origin center mathematics.
 */
import { test, assert, near } from './_lib';
import { SettingsManager } from '../src/settings';
import {
    GRAPH_APPEARANCE_PRESETS,
    PRESET_SAMPLES,
    AppearancePresetId,
    applyPreset,
    centerOrigin,
    createPresetPreviewSettings,
    detectPreset,
    getPresetById,
    matchesPreset,
} from '../src/appearance';
import { migrateSettings } from '../src/migrate';
import { parseChartText } from '../src/text/parse';
import { printChartText } from '../src/text/print';

test('appearance presets: all 6 presets are defined with required proportions', () => {
    assert.equal(GRAPH_APPEARANCE_PRESETS.length, 6);

    const academic = getPresetById('academic');
    assert.ok(academic);
    assert.equal(academic!.ratio, '4:3');
    assert.equal(academic!.size_x_cm, 12);
    assert.equal(academic!.size_y_cm, 9);
    assert.equal(academic!.axis_style, 'box');
    assert.equal(academic!.showLargeGrid, true);
    assert.equal(academic!.majorTickNum, 6);

    const wide = getPresetById('wide');
    assert.ok(wide);
    assert.equal(wide!.ratio, '16:9');
    assert.equal(wide!.size_x_cm, 16);
    assert.equal(wide!.size_y_cm, 9);
    assert.equal(wide!.axis_style, 'box');
    assert.equal(wide!.showLargeGrid, true);
    assert.equal(wide!.majorTickNum, 8);

    const signals = getPresetById('signals-systems');
    assert.ok(signals);
    assert.equal(signals!.ratio, '5:2');
    assert.equal(signals!.size_x_cm, 15);
    assert.equal(signals!.size_y_cm, 6);
    assert.equal(signals!.axis_style, 'middle');
    assert.equal(signals!.showLargeGrid, true);
    assert.equal(signals!.majorTickNum, 8);

    const clean = getPresetById('clean-cartesian');
    assert.ok(clean);
    assert.equal(clean!.ratio, '3:2');
    assert.equal(clean!.size_x_cm, 12);
    assert.equal(clean!.size_y_cm, 8);
    assert.equal(clean!.axis_style, 'middle');
    assert.equal(clean!.showLargeGrid, false);
    assert.equal(clean!.majorTickNum, 6);

    const portrait = getPresetById('portrait');
    assert.ok(portrait);
    assert.equal(portrait!.ratio, '3:4');
    assert.equal(portrait!.size_x_cm, 9);
    assert.equal(portrait!.size_y_cm, 12);
    assert.equal(portrait!.axis_style, 'box');
    assert.equal(portrait!.showLargeGrid, true);
    assert.equal(portrait!.majorTickNum, 6);

    const classic = getPresetById('classic-square');
    assert.ok(classic);
    assert.equal(classic!.ratio, '1:1');
    assert.equal(classic!.size_x_cm, 10);
    assert.equal(classic!.size_y_cm, 10);
    assert.equal(classic!.axis_style, 'box');
    assert.equal(classic!.showLargeGrid, false);
    assert.equal(classic!.majorTickNum, 8);
});

test('appearance presets: SettingsManager.newChart() defaults to Academic (4:3)', () => {
    const s = SettingsManager.newChart();
    assert.equal(detectPreset(s), 'academic');
    assert.equal(s.getValue('size_x_cm'), 12);
    assert.equal(s.getValue('size_y_cm'), 9);
    assert.equal(s.getValue('axis_style'), 'box');
    assert.equal(s.getValue('showLargeGrid'), true);
    assert.equal(s.getValue('showSmallGrid'), false);
    assert.equal(s.getValue('majorTickNum'), 6);
    assert.equal(s.getValue('gridSize'), 5);

    const canvas = s.previewCanvas();
    assert.deepEqual([canvas.width, canvas.height], [760, 570]);
    assert.equal(canvas.width / canvas.height, 4 / 3);
});

test('appearance presets: detectPreset matches each preset correctly', () => {
    const s = new SettingsManager();
    for (const preset of GRAPH_APPEARANCE_PRESETS) {
        applyPreset(s, preset.id);
        assert.equal(detectPreset(s), preset.id);
        assert.ok(matchesPreset(preset, s));
    }
});

test('appearance presets: selecting Custom does not reset any settings', () => {
    const s = SettingsManager.newChart();
    s.setValue('size_x_cm', 14);
    s.setValue('size_y_cm', 7);
    s.setValue('axis_style', 'axes');

    applyPreset(s, 'custom');
    assert.equal(s.getValue('size_x_cm'), 14);
    assert.equal(s.getValue('size_y_cm'), 7);
    assert.equal(s.getValue('axis_style'), 'axes');
    assert.equal(detectPreset(s), 'custom');
});

test('appearance presets: transitions to Custom when appearance settings are modified', () => {
    const s = SettingsManager.newChart();
    assert.equal(detectPreset(s), 'academic');

    // Modifying width -> Custom
    s.setValue('size_x_cm', 13);
    assert.equal(detectPreset(s), 'custom');

    // Restoring width -> Academic
    s.setValue('size_x_cm', 12);
    assert.equal(detectPreset(s), 'academic');

    // Modifying grid -> Custom
    s.setValue('showLargeGrid', false);
    assert.equal(detectPreset(s), 'custom');

    // Restoring grid -> Academic
    s.setValue('showLargeGrid', true);
    assert.equal(detectPreset(s), 'academic');

    // Modifying axis style -> Custom
    s.setValue('axis_style', 'middle');
    assert.equal(detectPreset(s), 'custom');

    // Modifying tick density -> Custom
    s.setValue('axis_style', 'box');
    s.setValue('majorTickNum', 10);
    assert.equal(detectPreset(s), 'custom');
});

test('appearance presets: navigation and content changes do NOT switch to Custom', () => {
    const s = SettingsManager.newChart();
    assert.equal(detectPreset(s), 'academic');

    // Panning / changing range bounds
    s.setValue('xmin', '-5');
    s.setValue('xmax', '15');
    s.setValue('ymin', '-2');
    s.setValue('ymax', '8');
    assert.equal(detectPreset(s), 'academic');

    // Adding functions
    s.setValue('functions', [{ name: 'f1', expression: 'sin(x)', color: 'blue' }]);
    assert.equal(detectPreset(s), 'academic');

    // Adding parameters
    s.setValue('parameters', [{ name: 'a', value: 2, min: 0, max: 5, step: 0.1 }]);
    assert.equal(detectPreset(s), 'academic');

    // Changing title
    s.setValue('title', 'My Academic Plot');
    assert.equal(detectPreset(s), 'academic');
});

test('appearance presets: existing / legacy charts retain original appearance', () => {
    // Unversioned legacy chart without size or appearance
    const migrated = migrateSettings({});
    assert.equal(migrated.size_x_cm, 10);
    assert.equal(migrated.size_y_cm, 10);
    assert.equal(migrated.showLargeGrid, false);
    assert.equal(migrated.graphAppearance, 'classic-square');

    // Round-trip into SettingsManager
    const mgr = SettingsManager.fromJSON({});
    assert.equal(mgr.getValue('size_x_cm'), 10);
    assert.equal(mgr.getValue('size_y_cm'), 10);
    assert.equal(mgr.getValue('showLargeGrid'), false);
    assert.equal(detectPreset(mgr), 'classic-square');
});

test('export proportions: canvas and TikZ export reflect preset aspect ratios', () => {
    for (const preset of GRAPH_APPEARANCE_PRESETS) {
        const s = new SettingsManager();
        applyPreset(s, preset.id);

        // Preview canvas
        const canvas = s.previewCanvas();
        const expectedRatio = preset.size_x_cm / preset.size_y_cm;
        const actualRatio = canvas.width / canvas.height;
        near(actualRatio, expectedRatio, 0.01, `Canvas ratio for ${preset.id}`);

        // TikZ code export
        const code = s.generateTikzCode();
        assert.ok(code.includes(`width=${preset.size_x_cm}cm`), `TikZ width for ${preset.id}`);
        assert.ok(code.includes(`height=${preset.size_y_cm}cm`), `TikZ height for ${preset.id}`);
    }
});

test('Center Origin applies each axis style and preserves all other chart settings', () => {
    for (const [style, expected] of [
        ['middle', ['-5.25', '5.25', '-2.75', '2.75']],
        ['box', ['0', '10.5', '0', '5.5']],
        ['axes', ['0', '10.5', '0', '5.5']],
    ] as const) {
        const chart = SettingsManager.newChart();
        chart.setValue('axis_style', style);
        chart.setValue('functions', [{ name: 'f1', expression: 'sin(x)' }]);
        chart.setValue('annotations', [{ text: 'Sample' }]);
        const before = chart.serialize();
        const active = detectPreset(chart);
        const [xmin, xmax, ymin, ymax] = expected;

        assert.deepEqual(centerOrigin(chart), { changed: true });
        assert.deepEqual(chart.serialize(), { ...before, xmin, xmax, ymin, ymax });
        assert.equal(detectPreset(chart), active);
        assert.deepEqual(centerOrigin(chart), { changed: false });
    }
});

test('Center Origin keeps expression and tiny decimal spans at full precision', () => {
    const chart = SettingsManager.newChart();
    chart.setValue('axis_style', 'middle');
    chart.setValue('parameters', [{ name: 'a', value: 2, min: 0, max: 5, step: 1 }]);
    chart.setValue('xmin', '0');
    chart.setValue('xmax', 'a*pi');
    chart.setValue('ymin', '0');
    chart.setValue('ymax', '3e-20');

    assert.deepEqual(centerOrigin(chart), { changed: true });
    const { view, errors } = chart.resolveView(chart.createMathContext());
    assert.deepEqual(errors, []);
    assert.equal(view.xmin, -Math.PI);
    assert.equal(view.xmax - view.xmin, 2 * Math.PI);
    assert.equal(view.ymax - view.ymin, 3e-20);
    assert.deepEqual(centerOrigin(chart), { changed: false });
});

test('Center Origin rejects invalid active bounds without modifying the chart', () => {
    for (const [key, expression] of [
        ['xmin', 'unknown_name'],
        ['ymax', '1e999'],
        ['ymin', '6'],
        ['xmin', '-1e308'],
        ['zmax', 'unknown_name'],
    ]) {
        const chart = SettingsManager.newChart();
        chart.setValue('dimension', key === 'zmax');
        if (expression === '-1e308') chart.setValue('xmax', '1e308');
        chart.setValue(key, expression);
        const before = chart.serialize();
        const result = centerOrigin(chart);
        assert.equal(result.changed, false);
        assert.ok(result.error);
        assert.deepEqual(chart.serialize(), before);
    }
});

test('Center Origin centers polar and 3D ranges and leaves zoom and inactive bounds alone', () => {
    for (const is3D of [false, true]) {
        const chart = SettingsManager.newChart();
        chart.setValue('dimension', is3D);
        chart.setValue('coordinateSystem', 'polar');
        chart.setValue('zmin', is3D ? '2' : 'unknown_name');
        chart.setValue('zmax', '8');
        chart.setValue('zoom3D', 2);
        const before = chart.serialize();

        assert.deepEqual(centerOrigin(chart), { changed: true });
        assert.deepEqual(chart.serialize(), {
            ...before,
            xmin: '-5.25', xmax: '5.25', ymin: '-2.75', ymax: '2.75',
            ...(is3D ? { zmin: '-3', zmax: '3' } : {}),
        });
    }
});

test('selecting Custom stays active even when the settings match a named preset', () => {
    const chart = SettingsManager.newChart();
    const before = chart.serialize();
    applyPreset(chart, 'custom');
    assert.deepEqual(chart.serialize(), { ...before, graphAppearance: 'custom' });
    assert.equal(detectPreset(SettingsManager.fromJSON(chart.serialize())), 'custom');
    const text = parseChartText(printChartText(chart.serialize()));
    assert.deepEqual(text.problems, []);
    assert.equal(detectPreset(SettingsManager.fromJSON(text.data)), 'custom');
    applyPreset(chart, 'academic');
    assert.equal(detectPreset(chart), 'academic');
});

test('visual preset picker: all 7 preset samples are defined with representative functions', () => {
    assert.equal(PRESET_SAMPLES.length, 7);

    const ids = PRESET_SAMPLES.map((s) => s.id);
    assert.deepEqual(ids, [
        'academic',
        'wide',
        'signals-systems',
        'clean-cartesian',
        'portrait',
        'classic-square',
        'custom',
    ]);

    for (const sample of PRESET_SAMPLES) {
        const settings = createPresetPreviewSettings(sample.id);
        const math = settings.createMathContext();
        const config = settings.toRendererConfig(math);
        assert.deepEqual(settings.resolveView(math).errors, []);
        assert.ok(config.functions!.length || config.tools!.length, `Preset ${sample.id} has visible content`);
        if (sample.id !== 'custom') assert.equal(detectPreset(settings), sample.id);
    }
    const signals = createPresetPreviewSettings('signals-systems').toRendererConfig();
    assert.ok(signals.functions![0].expression.includes('cos'));
    assert.equal(signals.functions![0].fill, true);
    const clean = createPresetPreviewSettings('clean-cartesian').toRendererConfig();
    assert.ok(clean.functions![0].expression.includes('x^3'));
    assert.equal(clean.functions![0].tangent, true);

    // Custom uses the current style on an independent sample.
    const customMgr = new SettingsManager();
    customMgr.setValue('functions', [{ name: 'f1', expression: 'tan(x)', color: 'red' }]);
    customMgr.setValue('size_x_cm', 18);
    customMgr.setValue('axis_style', 'axes');
    customMgr.setValue('xmin', 'broken(');
    const customPreview = createPresetPreviewSettings('custom', customMgr);
    assert.equal(customPreview.paperSize().w, 18);
    assert.equal(customPreview.getValue('axis_style'), 'axes');
    assert.deepEqual(customPreview.resolveView(customPreview.createMathContext()).errors, []);
    const customFuncs = customPreview.getValue('functions') as Array<{ expression: string }>;
    assert.equal(customFuncs[0].expression, 'sin(x)');
});
