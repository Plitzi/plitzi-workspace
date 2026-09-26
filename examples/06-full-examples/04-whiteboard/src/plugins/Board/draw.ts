import { getStroke } from 'perfect-freehand';
import rough from 'roughjs';

import { takesLabel } from '../../board/model.ts';
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

/** A label in a shape: one size whatever the outline's width — it is read, not drawn. */
const LABEL_FONT = 20;

export const LABEL_PADDING = 12;

export const STICKY_SIZE = 200;

export const HANDLE_SIZE = 8;

/** A pile's papers lie a little askew over each other; its strip at the foot is where it is picked up and moved. */
const STACK_OFFSET = 5;

export const STACK_STRIP = 30;

/** The pile under the top paper, the paper, and the strip that says what it is — in element coordinates. */
const drawStack = (context: CanvasRenderingContext2D, element: BoardElement, palette: Palette): void => {
  const paper = palette.sticky[element.fill];
  const width = element.width - STACK_OFFSET * 2;
  const height = element.height - STACK_STRIP - STACK_OFFSET * 2;
  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.16)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 3;
  context.fillStyle = paper;
  for (const offset of [STACK_OFFSET * 2, STACK_OFFSET]) {
    context.fillRect(offset, offset, width, height);
  }

  context.restore();
  context.save();
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  context.fillStyle = palette.stroke.ink;
  context.globalAlpha = 0.45;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `22px ${palette.font}`;
  context.fillText('Drag a note off ↘', width / 2, height / 2);
  context.globalAlpha = 1;
  // The strip: a handle to move the whole pile by.
  const top = element.height - STACK_STRIP + 4;
  context.fillStyle = palette.dots;
  context.beginPath();
  context.roundRect(0, top, element.width, STACK_STRIP - 6, 8);
  context.fill();
  context.fillStyle = palette.stroke.ink;
  context.globalAlpha = 0.6;
  context.font = `600 12px ${palette.ui}`;
  context.fillText('⠿  sticky pile', element.width / 2, top + (STACK_STRIP - 6) / 2);
  context.restore();
};

/** A picture, or where it will be while it loads. */
const drawPicture = (
  context: CanvasRenderingContext2D,
  element: BoardElement,
  palette: Palette,
  picture: CanvasImageSource | undefined
): void => {
  context.save();
  if (picture) {
    context.shadowColor = 'rgba(0, 0, 0, 0.18)';
    context.shadowBlur = 10;
    context.shadowOffsetY = 3;
    context.drawImage(picture, 0, 0, element.width, element.height);
  } else {
    context.fillStyle = palette.dots;
    context.fillRect(0, 0, element.width, element.height);
    context.fillStyle = palette.stroke.ink;
    context.globalAlpha = 0.5;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `600 13px ${palette.ui}`;
    context.fillText('Loading picture…', element.width / 2, element.height / 2);
  }

  context.restore();
};

/** The votes on an element, at its foot: a thumb and a count — lit when one of them is this visitor's. */
const drawVotes = (context: CanvasRenderingContext2D, element: BoardElement, palette: Palette, mine: boolean): void => {
  const label = `👍 ${element.votes?.length ?? 0}`;
  context.save();
  context.font = `600 13px ${palette.ui}`;
  const width = context.measureText(label).width + 16;
  const x = element.width - width - 8;
  const y = element.height - 30;
  context.fillStyle = mine ? palette.accent : '#ffffff';
  context.strokeStyle = palette.accent;
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(x, y, width, 22, 11);
  context.fill();
  context.stroke();
  context.fillStyle = mine ? '#ffffff' : palette.accent;
  context.textBaseline = 'middle';
  context.fillText(label, x + 8, y + 11);
  context.restore();
};

/** Where a vote badge is on an element, in its own coordinates: what a click on it toggles. */
export const voteBadgeBox = (element: BoardElement): { x: number; y: number; width: number; height: number } => ({
  x: element.x + element.width - 70,
  y: element.y + element.height - 32,
  width: 66,
  height: 26
});

export const fontSizeOf = (element: BoardElement): number => {
  if (element.type === 'sticky') {
    return STICKY_FONT;
  }

  return takesLabel(element.type) ? LABEL_FONT : FONT_SIZES[element.strokeWidth];
};

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
  if (element.type !== 'sticky' && !takesLabel(element.type)) {
    return { lines: paragraphs, lineHeight };
  }

  const width = element.width - (element.type === 'sticky' ? STICKY_PADDING : LABEL_PADDING) * 2;
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

/**
 * A drawn element. A hatched fill is its own drawing, clipped to the shape's exact outline: rough.js wobbles every
 * hatch line as it wobbles the outline, and unclipped they overshoot the border — most at a diamond's corners.
 */
type Shape = { drawables: Drawable[]; fill?: { drawable: Drawable; clip: Path2D } } | { path: Path2D };

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

  /** Two points as a line; more as a curve through all of them, with less wobble than a straight stroke gets. */
  const pathThrough = (points: Point[], options: Options): Drawable =>
    points.length > 2
      ? generator.curve(points, { ...options, roughness: Math.min(options.roughness ?? 1, 0.55), bowing: 0.4 })
      : generator.linearPath(points, options);

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
      ...(element.type === 'sticky' ? { fill: palette.sticky[element.fill], fillStyle: 'solid' } : {})
    };
    const { width, height } = element;
    const hatch: Options = {
      ...options,
      stroke: 'none',
      fill: palette.fill[element.fill],
      fillStyle: 'hachure',
      hachureGap: 6 + element.strokeWidth * 2,
      fillWeight: Math.max(1, element.strokeWidth / 1.5)
    };
    const hatched = element.fill !== 'none';
    const diamond: [number, number][] = [
      [width / 2, 0],
      [width, height / 2],
      [width / 2, height],
      [0, height / 2]
    ];

    switch (element.type) {
      case 'ellipse': {
        const clip = new Path2D();
        clip.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);

        return {
          drawables: [generator.ellipse(width / 2, height / 2, width, height, options)],
          ...(hatched
            ? { fill: { drawable: generator.ellipse(width / 2, height / 2, width, height, hatch), clip } }
            : {})
        };
      }
      case 'diamond': {
        const clip = new Path2D();
        diamond.forEach(([px, py], index) => (index ? clip.lineTo(px, py) : clip.moveTo(px, py)));
        clip.closePath();

        return {
          drawables: [generator.polygon(diamond, options)],
          ...(hatched ? { fill: { drawable: generator.polygon(diamond, hatch), clip } } : {})
        };
      }
      // A connector bent between anchors is many points: drawn as ONE smooth curve through them, not as a wobble per
      // segment — which is what made a bent arrow look jagged.
      case 'line':
        return { drawables: [pathThrough(element.points ?? [], options)] };
      case 'arrow': {
        const points = element.points ?? [];

        return {
          drawables: [pathThrough(points, options), ...arrowHead(points, options, element.strokeWidth)]
        };
      }
      // A pile and a picture are drawn whole by their own functions (`drawStack`, `drawPicture`): no outline here.
      case 'stack':
      case 'image':
        return { drawables: [] };
      case 'sticky':
        return {
          drawables: [generator.rectangle(0, 0, width, height, { ...options, stroke: palette.sticky[element.fill] })]
        };
      default: {
        const clip = new Path2D();
        clip.rect(0, 0, width, height);

        return {
          drawables: [generator.rectangle(0, 0, width, height, options)],
          ...(hatched ? { fill: { drawable: generator.rectangle(0, 0, width, height, hatch), clip } } : {})
        };
      }
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
    const lift = (lineHeight - fontSizeOf(element)) / 2;
    context.fillStyle = palette.stroke[element.stroke];
    context.textBaseline = 'top';
    if (takesLabel(element.type)) {
      // A label sits in the middle of its shape, both ways.
      const top = (element.height - lines.length * lineHeight) / 2;
      context.textAlign = 'center';
      lines.forEach((line, index) => context.fillText(line, element.width / 2, top + index * lineHeight + lift));

      return;
    }

    const inset = element.type === 'sticky' ? STICKY_PADDING : 0;
    lines.forEach((line, index) => {
      context.fillText(line, inset, inset + index * lineHeight + lift);
    });
  };

  /** One element, on a context already transformed to board units. */
  const drawElement = (
    context: CanvasRenderingContext2D,
    element: BoardElement,
    palette: Palette,
    {
      hideText = false,
      faded = false,
      picture,
      voter
    }: { hideText?: boolean; faded?: boolean; picture?: CanvasImageSource; voter?: string } = {}
  ): void => {
    context.save();
    context.translate(element.x, element.y);
    if (faded) {
      context.globalAlpha = 0.25;
    }

    if (element.type === 'stack') {
      drawStack(context, element, palette);
    }

    if (element.type === 'image') {
      drawPicture(context, element, palette, picture);
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
        if (shape.fill) {
          context.save();
          context.clip(shape.fill.clip);
          roughCanvas.draw(shape.fill.drawable);
          context.restore();
        }

        shape.drawables.forEach(drawable => roughCanvas.draw(drawable));
      }
    }

    const written = element.type === 'text' || element.type === 'sticky' || (takesLabel(element.type) && element.text);
    if (written && !hideText) {
      drawText(context, element, palette);
    }

    if (element.votes?.length) {
      drawVotes(context, element, palette, voter !== undefined && element.votes.includes(voter));
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
  font: string,
  message?: string
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
  if (message) {
    // Cursor chat: the words where the person is pointing, their name above them — a bubble, not a label.
    context.font = `500 14px ${font}`;
    const lines = wrapLine(context, message, 240).slice(0, 4);
    const width =
      Math.max(context.measureText(label).width, ...lines.map(line => context.measureText(line).width)) + 20;
    const height = 26 + lines.length * 18;
    context.beginPath();
    context.roundRect(14, 20, width, height, 12);
    context.fill();
    context.fillStyle = '#ffffff';
    context.textBaseline = 'top';
    context.font = `700 11px ${font}`;
    context.globalAlpha = 0.85;
    context.fillText(label, 24, 27);
    context.globalAlpha = 1;
    context.font = `500 14px ${font}`;
    lines.forEach((line, index) => context.fillText(line, 24, 42 + index * 18));
    context.restore();

    return;
  }

  const width = context.measureText(label).width + 12;
  context.beginPath();
  context.roundRect(12, 20, width, 20, 6);
  context.fill();
  context.fillStyle = '#ffffff';
  context.textBaseline = 'middle';
  context.fillText(label, 18, 30);
  context.restore();
};

/** Words wrapped to a width, in the context's current font. */
const wrapLine = (context: CanvasRenderingContext2D, text: string, width: number): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  return line ? [...lines, line] : lines;
};

/**
 * Points a person can grab, in screen space: a shape's connection points, a connector's ends. `active` is the one the
 * pointer is over or a connector is about to fix to — filled, so where it will land is never a guess.
 */
export const drawPoints = (
  context: CanvasRenderingContext2D,
  camera: Camera,
  points: readonly Point[],
  colour: string,
  active?: Point
): void => {
  context.save();
  context.lineWidth = 1.5;
  context.strokeStyle = colour;
  for (const point of points) {
    const [x, y] = toScreen(camera, point[0], point[1]);
    const lit = active !== undefined && active[0] === point[0] && active[1] === point[1];
    context.fillStyle = lit ? colour : '#ffffff';
    context.beginPath();
    context.arc(x, y, lit ? 6 : 4.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.restore();
};
