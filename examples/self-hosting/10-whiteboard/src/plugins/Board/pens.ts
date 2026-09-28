import type { BoardElement, Brush, StrokeWidth } from '../../board/model.ts';
import type { StrokeOptions } from 'perfect-freehand';

/**
 * How each brush lays ink, as perfect-freehand's options for a stroke width: how wide, how much it thins as the pen
 * speeds up, how it tapers at its ends. What it is filled with — grain, glow, see-through — is `inkFor`'s.
 */
const PENS: Record<Brush | 'pizarra', (width: StrokeWidth) => StrokeOptions> = {
  pizarra: width => ({ size: 3 + width * 3, thinning: 0.6, smoothing: 0.5, streamline: 0.45 }),
  // Sumi-e: swells under pressure and tapers to a point at both ends.
  brush: width => ({
    size: 10 + width * 7,
    thinning: 0.95,
    smoothing: 0.75,
    streamline: 0.55,
    start: { taper: 40, easing: (t: number) => t * t },
    end: { taper: 110, easing: (t: number) => 1 - (1 - t) ** 3 }
  }),
  fountain: width => ({ size: 2.5 + width * 1.5, thinning: 0.7, smoothing: 0.6, streamline: 0.7, end: { taper: 30 } }),
  marker: width => ({ size: 5 + width * 3, thinning: 0, smoothing: 0.6, streamline: 0.5, simulatePressure: false }),
  highlighter: width => ({
    size: 14 + width * 6,
    thinning: 0,
    smoothing: 0.7,
    streamline: 0.6,
    simulatePressure: false
  }),
  pencil: width => ({ size: 1.8 + width, thinning: 0.35, smoothing: 0.5, streamline: 0.45 }),
  chalk: width => ({ size: 5 + width * 3, thinning: 0.15, smoothing: 0.5, streamline: 0.4 }),
  neon: width => ({ size: 3 + width * 2, thinning: 0.1, smoothing: 0.6, streamline: 0.5 })
};

/** How a pen stroke is laid: its brush's options at its width — pressure simulated unless the brush says not. */
export const penOf = (element: BoardElement): StrokeOptions => ({
  simulatePressure: true,
  ...PENS[element.brush ?? 'pizarra'](element.strokeWidth)
});

/**
 * How far a pen stroke's ink reaches beyond the line through its points: half the brush's width. What its box and a
 * click on it are measured with — a wide highlighter is picked up, and outlined, where its ink is.
 */
export const inkRadius = (element: BoardElement): number =>
  element.type === 'freehand' ? (penOf(element).size ?? 0) / 2 : element.strokeWidth / 2;
