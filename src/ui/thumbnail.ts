import { SVGRenderer } from '../renderer';
import { SettingsManager } from '../settings';

/** Crop around the plot for the stock example tiles and appearance cards. */
export function render2DThumbnail(settings: SettingsManager, paperAspect?: number): SVGSVGElement {
    const math = settings.createMathContext({ memo: paperAspect === undefined });
    const config = settings.toRendererConfig(math);
    const longSide = 400;
    const plotWidth = paperAspect ? longSide * Math.min(1, paperAspect) : 400;
    const plotHeight = paperAspect ? longSide * Math.min(1, 1 / paperAspect) : 160;
    config.width = plotWidth + 85;
    config.height = plotHeight + 90;
    config.title = '';
    config.showAxisLabels = false;

    const renderer = new SVGRenderer(config, { math, quality: 'draft' });
    const svg = renderer.render() as SVGSVGElement;
    const plot = renderer.layout?.plot;
    if (plot) {
        const margin = paperAspect ? 6 : 2;
        let width = plot.w + 2 * margin;
        let height = plot.h + 2 * margin;
        if (paperAspect) {
            width = Math.max(width, height * paperAspect);
            height = width / paperAspect;
        }
        const x = plot.x + (plot.w - width) / 2;
        const y = plot.y + (plot.h - height) / 2;
        svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    }
    return svg;
}
