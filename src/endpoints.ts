import type { EndpointStyle, SegmentTool } from './types';

export const ENDPOINT_STYLES: readonly EndpointStyle[] = ['none', 'arrow', 'dot', 'hollow'];

export function endpointOf(tool: SegmentTool, side: 'start' | 'end'): EndpointStyle {
    if (ENDPOINT_STYLES.includes(tool[side]!)) return tool[side]!;
    return tool.style === 'both' || tool.style === (side === 'start' ? 'backward' : 'forward') ? 'arrow' : 'none';
}

export function explicitEndpoints(tool: SegmentTool): boolean {
    return tool.start !== undefined || tool.end !== undefined;
}

export function arrowEnds(start: EndpointStyle, end: EndpointStyle): 'forward' | 'backward' | 'both' | undefined {
    return start === 'arrow' ? end === 'arrow' ? 'both' : 'backward' : end === 'arrow' ? 'forward' : undefined;
}
