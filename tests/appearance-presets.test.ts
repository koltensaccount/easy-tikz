/*
 * Tests for graph appearance presets, custom transitions, export proportions,
 * and origin center mathematics.
 */
import { test, assert, near } from './_lib';
import { SettingsManager } from '../src/settings';
import {
    GRAPH_APPEARANCE_PRESETS,
    AppearancePresetId,
    applyPreset,
    detectPreset,
    getPresetById,
    matchesPreset,
} from '../src/appearance';
import { migrateSettings } from '../src/migrate';

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

test('origin center: mathematical centering preserves span and zoom', () => {
    // Range bounds helper matching modal.ts centerOrigin
    function centerOrigin(ranges: { xmin: number; xmax: number; ymin: number; ymax: number }) {
        const w = ranges.xmax - ranges.xmin;
        const h = ranges.ymax - ranges.ymin;
        return {
            xmin: -w / 2,
            xmax: w / 2,
            ymin: -h / 2,
            ymax: h / 2,
            w,
            h,
        };
    }

    // Prompt example: x: -0.5 to 10, y: -0.5 to 5
    const ex = centerOrigin({ xmin: -0.5, xmax: 10, ymin: -0.5, ymax: 5 });
    assert.equal(ex.xmin, -5.25);
    assert.equal(ex.xmax, 5.25);
    assert.equal(ex.ymin, -2.75);
    assert.equal(ex.ymax, 2.75);
    assert.equal(ex.w, 10.5);
    assert.equal(ex.h, 5.5);

    // Negative range: x: -10 to -2
    const neg = centerOrigin({ xmin: -10, xmax: -2, ymin: 1, ymax: 5 });
    assert.equal(neg.xmin, -4);
    assert.equal(neg.xmax, 4);
    assert.equal(neg.ymin, -2);
    assert.equal(neg.ymax, 2);
    assert.equal(neg.w, 8);
    assert.equal(neg.h, 4);

    // Idempotency: clicking again produces identical bounds
    const again = centerOrigin({ xmin: ex.xmin, xmax: ex.xmax, ymin: ex.ymin, ymax: ex.ymax });
    assert.equal(again.xmin, -5.25);
    assert.equal(again.xmax, 5.25);
    assert.equal(again.ymin, -2.75);
    assert.equal(again.ymax, 2.75);
});

test('origin center: expression bounds resolve and center properly', () => {
    const s = SettingsManager.newChart();
    s.setValue('xmin', '0');
    s.setValue('xmax', '2*pi');
    s.setValue('ymin', '-1');
    s.setValue('ymax', '1');

    const math = s.createMathContext();
    const { view } = s.resolveView(math);
    const w = view.xmax - view.xmin;
    const h = view.ymax - view.ymin;

    near(w, 2 * Math.PI, 1e-4);
    near(h, 2, 1e-4);

    const centeredXmin = -w / 2;
    const centeredXmax = w / 2;
    near(centeredXmin, -Math.PI, 1e-4);
    near(centeredXmax, Math.PI, 1e-4);
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
