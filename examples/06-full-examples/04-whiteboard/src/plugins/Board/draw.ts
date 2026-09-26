import { getStroke } from 'perfect-freehand';
import rough from 'roughjs';

import { handlePoint, HANDLES, toScreen } from './geometry.ts';

import type { Box, Camera } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { BoardElement, Point, StrokeWidth } from '../../board/model.ts';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Drawable, Options } from 'roughjs/bin/core';

/** Text's size follows the stroke width a person picked: fine, medium, bold — the same three choices as a line. */
const FONT_SIZES: Record<StrokeWidth, number> = { 1: 20, 2: 28, 4: 44 };

const LINE_HEIGHT = 1.25;

export const STICKY_PADDING = 16;

const STICKY_FONT = 22;

export const STICKY_SIZE = 200;

export const HANDLE_SIZE = 8;

export const fontSizeOf = (element: BoardElement): number =>
  element.type === 'sticky' ? STICKY_FONT : FONT_SIZES[element.strokeWidth];

export const fontOf = (element: BoardElement, palette: Palette): string => `${fontSizeOf(element)}px ${palette.font}`;

/** A sticky's words wrapped to its width; a text's lines as typed. */
export const layoutText = (
  context: CanvasRenderingContext2D,
  element: BoardElement,
  palette: Palette
): { lines: string[]; lineHeight: number } => {
  context.font = fontOf(element, palette);
  const lineHeight = fontSizeOf(element) * LINE_HEIGHT;
  const paragraphs = (element.text ?? '').split('\n');
  if (element.type !== 'sticky') {
    return { lines: paragraphs, lineHeight };
  }

  const width = element.width - STICKY_PADDING * 2;
  const lines = paragraphs.flatMap(paragraph => {
    const wrapped: string[] = [];
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > width) {
        wrapped.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    return [...wrapped, line];
  });

  return { lines, lineHeight };
};

/** The box a text element's lines take, measured in the font they are drawn in. */
export const measureText = (
  context: CanvasRenderingContext2D,
  element: BoardElement,
  palette: Palette
): { width: number; height: number } => {
  const { lines, lineHeight } = layoutText(context, element, palette);

  return {
    width: Math.max(8, ...lines.map(line => context.measureText(line).width)),
    height: Math.max(lineHeight, lines.length * lineHeight)
  };
};

/** The outline perfect-freehand answers, as a smooth closed path. */
const outlinePath = (outline: number[][]): Path2D => {
  const path = new Path2D();
  if (outline.length < 3) {
    return path;
  }

  path.moveTo(outline[0][0], outline[0][1]);
  for (let index = 1; index < outline.length; index += 1) {
    const [x0, y0] = outline[index];
    const [x1, y1] = outline[(index + 1) % outline.length];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }

  path.closePath();

  return path;
};

type Shape = { drawables: Drawable[] } | { path: Path2D };

/**
 * What an element looks like, in its own coordinates, by what can change it. A move changes only `x`/`y`, which is
 * drawn with a translation — so dragging a shape across the board reuses its drawing instead of generating a new
 * wobble every frame.
 */
const shapeKey = (element: BoardElement, palette: Palette): string =>
  [
    element.type,
    element.width,
    element.height,
    element.stroke,
    element.fill,
    element.strokeWidth,
    element.seed,
    element.points?.length ?? 0,
    element.points?.at(-1)?.join(',') ?? '',
    palette.key
  ].join('|');

export type Renderer = ReturnType<typeof createRenderer>;

export const createRenderer = (canvas: HTMLCanvasElement) => {
  const roughCanvas: RoughCanvas = rough.canvas(canvas);
  const generator = roughCanvas.generator;
  const cache = new Map<string, { key: string; shape: Shape }>();

  const arrowHead = (points: Point[], options: Options, width: number): Drawable[] => {
    const tip = points[points.length - 1];
    const from = [...points].reverse().find(([px, py]) => Math.hypot(px - tip[0], py - tip[1]) > 1) ?? points[0];
    const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    const length = Math.min(26, Math.hypot(tip[0] - from[0], tip[1] - from[1]) * 0.6) + width * 2;

    return [-1, 1].map(side =>
      generator.line(
        tip[0],
        tip[1],
        tip[0] - length * Math.cos(angle + side * 0.5),
        tip[1] - length * Math.sin(angle + side * 0.5),
        options
      )
    );
  };

  const build = (element: BoardElement, palette: Palette): Shape => {
    const stroke = palette.stroke[element.stroke];
    if (element.type === 'freehand') {
      const outline = getStroke(element.points ?? [], {
        size: 3 + element.strokeWidth * 3,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.45,
        simulatePressure: true,
        last: true
      });

      return { path: outlinePath(outline) };
    }

    const options: Options = {
      seed: element.seed,
      stroke,
      strokeWidth: element.strokeWidth,
      roughness: element.type === 'sticky' ? 0.6 : 1.1,
      bowing: 1,
      ...(element.fill === 'none' && element.type !== 'sticky'
        ? {}
        : {
            fill: element.type === 'sticky' ? palette.sticky[element.fill] : palette.fill[element.fill],
            fillStyle: element.type === 'sticky' ? 'solid' : 'hachure',
            hachureGap: 6 + element.strokeWidth * 2,
            fillWeight: Math.max(1, element.strokeWidth / 1.5)
          })
    };
    const { width, height } = element;

    switch (element.type) {
      case 'ellipse':
        return { drawables: [generator.ellipse(width / 2, height / 2, width, height, options)] };
      case 'diamond':
        return {
          drawables: [
            generator.polygon(
              [
                [width / 2, 0],
                [width, height / 2],
                [width / 2, height],
                [0, height / 2]
              ],
              options
            )
          ]
        };
      case 'line':
        return { drawables: [generator.linearPath(element.points ?? [], options)] };
      case 'arrow': {
        const points = element.points ?? [];

        return {
          drawables: [generator.linearPath(points, options), ...arrowHead(points, options, element.strokeWidth)]
        };
      }
      case 'sticky':
        return {
          drawables: [generator.rectangle(0, 0, width, height, { ...options, stroke: palette.sticky[element.fill] })]
        };
      default:
        return { drawables: [generator.rectangle(0, 0, width, height, options)] };
    }
  };

  const shapeOf = (element: BoardElement, palette: Palette): Shape => {
    const key = shapeKey(element, palette);
    const cached = cache.get(element.id);
    if (cached?.key === key) {
      return cached.shape;
    }

    const shape = build(element, palette);
    cache.set(element.id, { key, shape });

    return shape;
  };

  const drawText = (context: CanvasRenderingContext2D, element: BoardElement, palette: Palette): void => {
    const { lines, lineHeight } = layoutText(context, element, palette);
    const inset = element.type === 'sticky' ? STICKY_PADDING : 0;
    context.fillStyle = palette.stroke[element.stroke];
    context.textBaseline = 'top';
    lines.forEach((line, index) => {
      context.fillText(line, inset, inset + index * lineHeight + (lineHeight - fontSizeOf(element)) / 2);
    });
  };

  /** One element, on a context already transformed to board units. */
  const drawElement = (
    context: CanvasRenderingContext2D,
    element: BoardElement,
    palette: Palette,
    { hideText = false, faded = false }: { hideText?: boolean; faded?: boolean } = {}
  ): void => {
    context.save();
    context.translate(element.x, element.y);
    if (faded) {
      context.globalAlpha = 0.25;
    }

    if (element.type === 'sticky') {
      context.shadowColor = 'rgba(0, 0, 0, 0.18)';
      context.shadowBlur = 12;
      context.shadowOffsetY = 4;
      context.fillStyle = palette.sticky[element.fill];
      context.fillRect(0, 0, element.width, element.height);
      context.shadowColor = 'transparent';
    }

    if (element.type !== 'text') {
      const shape = shapeOf(element, palette);
      if ('path' in shape) {
        context.fillStyle = palette.stroke[element.stroke];
        context.fill(shape.path);
      } else {
        shape.drawables.forEach(drawable => roughCanvas.draw(drawable));
      }
    }

    if ((element.type === 'text' || element.type === 'sticky') && !hideText) {
      drawText(context, element, palette);
    }

    context.restore();
  };

  return {
    drawElement,
    /** Drawings of elements that are gone: kept, they would pin every deleted stroke in memory. */
    prune: (alive: ReadonlySet<string>): void => {
      for (const id of cache.keys()) {
        if (!alive.has(id)) {
          cache.delete(id);
        }
      }
    }
  };
};

/** The paper's dots, in screen space: thinned out as the board zooms away, so they never become a grey wash. */
export const drawDots = (
  context: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
  colour: string
): void => {
  let spacing = 24 * camera.zoom;
  while (spacing < 12) {
    spacing *= 2;
  }

  const offsetX = -((camera.x * camera.zoom) % spacing);
  const offsetY = -((camera.y * camera.zoom) % spacing);
  const size = Math.max(1, Math.min(2, camera.zoom * 1.5));
  context.fillStyle = colour;
  for (let x = offsetX; x < width; x += spacing) {
    for (let y = offsetY; y < height; y += spacing) {
      context.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }
};

/** An outline around an element, in screen space: a steady line however far the board is zoomed. */
export const drawOutline = (
  context: CanvasRenderingContext2D,
  camera: Camera,
  box: Box,
  colour: string,
  dashed: boolean
): void => {
  const [x, y] = toScreen(camera, box.x, box.y);
  context.save();
  context.strokeStyle = colour;
  context.lineWidth = 1.5;
  context.setLineDash(dashed ? [5, 4] : []);
  context.strokeRect(x - 6, y - 6, box.width * camera.zoom + 12, box.height * camera.zoom + 12);
  context.restore();
};

/** The corner handles around what is selected, in the accent colour. */
export const drawHandles = (context: CanvasRenderingContext2D, camera: Camera, box: Box, colour: string): void => {
  context.save();
  context.fillStyle = '#ffffff';
  context.strokeStyle = colour;
  context.lineWidth = 1.5;
  for (const handle of HANDLES) {
    const [bx, by] = handlePoint({ x: box.x, y: box.y, width: box.width, height: box.height }, handle);
    const [x, y] = toScreen(camera, bx, by);
    const offsetX = handle === 'nw' || handle === 'sw' ? -6 : 6;
    const offsetY = handle === 'nw' || handle === 'ne' ? -6 : 6;
    context.beginPath();
    context.rect(x + offsetX - HANDLE_SIZE / 2, y + offsetY - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    context.fill();
    context.stroke();
  }

  context.restore();
};

export const drawMarquee = (context: CanvasRenderingContext2D, camera: Camera, box: Box, colour: string): void => {
  const [x, y] = toScreen(camera, box.x, box.y);
  context.save();
  context.fillStyle = colour;
  context.globalAlpha = 0.08;
  context.fillRect(x, y, box.width * camera.zoom, box.height * camera.zoom);
  context.globalAlpha = 1;
  context.strokeStyle = colour;
  context.lineWidth = 1;
  context.strokeRect(x, y, box.width * camera.zoom, box.height * camera.zoom);
  context.restore();
};

/** Somebody else's pointer: an arrow in their colour, and their name beside it. */
export const drawCursor = (
  context: CanvasRenderingContext2D,
  camera: Camera,
  [boardX, boardY]: Point,
  name: string,
  colour: string,
  font: string
): void => {
  const [x, y] = toScreen(camera, boardX, boardY);
  context.save();
  context.translate(x, y);
  context.fillStyle = colour;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(0, 17);
  context.lineTo(4.5, 12.5);
  context.lineTo(8, 20);
  context.lineTo(10.5, 19);
  context.lineTo(7, 11.5);
  context.lineTo(13, 11.5);
  context.closePath();
  context.fill();
  context.stroke();

  context.font = `600 12px ${font}`;
  const label = name.slice(0, 24);
  const width = context.measureText(label).width + 12;
  context.beginPath();
  context.roundRect(12, 20, width, 20, 6);
  context.fill();
  context.fillStyle = '#ffffff';
  context.textBaseline = 'middle';
  context.fillText(label, 18, 30);
  context.restore();
};
