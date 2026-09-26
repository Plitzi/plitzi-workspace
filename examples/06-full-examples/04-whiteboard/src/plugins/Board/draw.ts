import { getStroke } from 'perfect-freehand';
import rough from 'roughjs';

import { FONT_SIZES, LINE_HEIGHT, takesLabel } from '../../board/model.ts';
import { FRAME_HEADER, handlePoint, HANDLES, toScreen } from './geometry.ts';
import { penOf } from './pens.ts';
import { outlineOf } from './shapes.ts';

import type { Box, Camera } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { BoardElement, Point } from '../../board/model.ts';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Drawable, Options } from 'roughjs/bin/core';

/** Text's size follows the stroke width a person picked: fine, medium, bold — the same three choices as a line. */

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

/** A card: its width, its inset, where its words start — past the box that ticks it done — and their size. */
export const CARD_WIDTH = 260;

export const CARD_PADDING = 14;

export const CARD_TEXT_LEFT = 42;

const CARD_FONT = 16;

/** The row at a card's foot that says who wrote it. */
const CARD_AUTHOR_ROW = 26;

/** Where a card's done box is, in its own coordinates: what a click on it ticks. */
export const CARD_CHECK = { x: 14, y: 14, size: 18 };

const FRAME_FONT = 18;

/** A comment: the pin it is on the board, and the bubble that opens beside it — where its words start, how wide. */
export const COMMENT_PIN = 32;

export const COMMENT_BUBBLE = { left: COMMENT_PIN + 10, top: -4, width: 260, padding: 12, author: 20 };

const COMMENT_FONT = 14;

/** A comment on the board: a pin in the accent — grey once it was dealt with — with the first letter of who left it. */
const drawCommentPin = (context: CanvasRenderingContext2D, element: BoardElement, palette: Palette): void => {
  const colour = element.done ? palette.muted : palette.accent;
  const radius = COMMENT_PIN / 2;
  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.22)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 2;
  context.fillStyle = colour;
  context.beginPath();
  // A round bubble with its tail at the bottom left: the point is where the comment is about.
  context.moveTo(0, COMMENT_PIN);
  context.lineTo(0, radius);
  context.arc(radius, radius, radius, Math.PI, Math.PI / 2, false);
  context.closePath();
  context.fill();
  context.shadowColor = 'transparent';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 14px ${palette.ui}`;
  context.fillText(element.done ? '✓' : (element.author?.[0] ?? '?').toUpperCase(), radius, radius + 1);
  // A thread: how many answers, on the pin's shoulder.
  const answers = element.replies?.length ?? 0;
  if (answers) {
    context.fillStyle = palette.surface;
    context.beginPath();
    context.arc(COMMENT_PIN - 2, 2, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = colour;
    context.font = `700 10px ${palette.ui}`;
    context.fillText(answers > 9 ? '9+' : String(answers), COMMENT_PIN - 2, 2.5);
  }
  context.restore();
};

/** A comment opened: the bubble beside its pin, with who left it and what they said. */
const drawCommentBubble = (
  context: CanvasRenderingContext2D,
  element: BoardElement,
  palette: Palette,
  lines: string[],
  lineHeight: number,
  hideText: boolean
): void => {
  const colour = element.done ? palette.muted : palette.accent;
  context.save();
  const { left, top, width, padding, author } = COMMENT_BUBBLE;
  const height = padding * 2 + author + Math.max(1, lines.length) * lineHeight;
  context.shadowColor = 'rgba(0, 0, 0, 0.18)';
  context.shadowBlur = 16;
  context.shadowOffsetY = 4;
  context.fillStyle = palette.surface;
  context.beginPath();
  context.roundRect(left, top, width, height, 12);
  context.fill();
  context.shadowColor = 'transparent';
  context.strokeStyle = palette.edge;
  context.lineWidth = 1;
  context.stroke();
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.font = `700 12px ${palette.ui}`;
  context.fillStyle = colour;
  const replies = element.replies?.length ?? 0;
  context.fillText(
    `${element.author ?? 'Someone'}${element.done ? ' · resolved' : ''}${replies ? ` · ${replies} ${replies === 1 ? 'reply' : 'replies'}` : ''}`,
    left + padding,
    top + padding
  );
  if (!hideText) {
    context.font = `${COMMENT_FONT}px ${palette.ui}`;
    context.fillStyle = element.done ? palette.muted : palette.stroke.ink;
    lines.forEach((line, index) => context.fillText(line, left + padding, top + padding + author + index * lineHeight));
  }
  context.restore();
};

/** A padlock on the corner of a locked element that is selected: why it does not move. */
export const drawLock = (context: CanvasRenderingContext2D, camera: Camera, box: Box, colour: string): void => {
  const [right, top] = toScreen(camera, box.x + box.width, box.y);
  const x = right + 4;
  const y = top - 20;
  context.save();
  context.fillStyle = colour;
  context.beginPath();
  context.roundRect(x, y + 7, 14, 11, 2);
  context.fill();
  context.strokeStyle = colour;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x + 7, y + 7, 4.5, Math.PI, 0);
  context.stroke();
  context.restore();
};

/** The faces an emoji is drawn in — the platform's own colour emoji before anything else. */
export const EMOJI_FONT = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** The size an emoji is measured at, once: its ink scales from there to whatever box it fills. */
const EMOJI_PROBE = 100;

const inkOf = new Map<string, { left: number; ascent: number; width: number; height: number }>();

/**
 * A stamp: its emoji filling its box, by the emoji's INK — what the font actually draws, measured once per emoji —
 * rather than by a line of text in a face the emoji is not drawn in, whose box was wider and taller than the mark.
 */
const drawStamp = (context: CanvasRenderingContext2D, element: BoardElement): void => {
  const emoji = element.text ?? '';
  context.font = `${EMOJI_PROBE}px ${EMOJI_FONT}`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  let ink = inkOf.get(emoji);
  if (!ink) {
    const metrics = context.measureText(emoji);
    ink = {
      left: metrics.actualBoundingBoxLeft,
      ascent: metrics.actualBoundingBoxAscent,
      width: Math.max(1, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight),
      height: Math.max(1, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent)
    };
    inkOf.set(emoji, ink);
  }

  const scale = Math.min(element.width / ink.width, element.height / ink.height);
  context.font = `${EMOJI_PROBE * scale}px ${EMOJI_FONT}`;
  context.fillStyle = '#000000';
  context.fillText(
    emoji,
    (element.width - ink.width * scale) / 2 + ink.left * scale,
    (element.height - ink.height * scale) / 2 + ink.ascent * scale
  );
};

/** A name at the foot of whatever someone wrote: who, in their own words' company, small and quiet. */
const drawAuthor = (
  context: CanvasRenderingContext2D,
  author: string,
  x: number,
  y: number,
  palette: Palette,
  colour: string
): void => {
  context.save();
  context.font = `600 12px ${palette.ui}`;
  context.textBaseline = 'middle';
  context.fillStyle = colour;
  context.globalAlpha = 0.7;
  context.fillText(author, x, y);
  context.restore();
};

/**
 * A frame: its area, tinted when it has a fill; its title and how many things are in it, in its title bar; a mark for
 * a column, which places what is put in it. Drawn flat rather than rough — it is where the drawing is, not part of it.
 */
const drawFrame = (
  context: CanvasRenderingContext2D,
  element: BoardElement,
  palette: Palette,
  members: number,
  hideText: boolean
): void => {
  context.save();
  context.beginPath();
  context.roundRect(0, 0, element.width, element.height, 14);
  context.fillStyle = element.fill === 'none' ? palette.surface : palette.sticky[element.fill];
  context.globalAlpha = element.fill === 'none' ? 0.55 : 0.45;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = palette.edge;
  context.lineWidth = 1.5;
  context.stroke();
  context.beginPath();
  context.moveTo(0, FRAME_HEADER);
  context.lineTo(element.width, FRAME_HEADER);
  context.globalAlpha = 0.6;
  context.stroke();
  context.globalAlpha = 1;
  context.textBaseline = 'middle';
  const middle = FRAME_HEADER / 2;
  let left = 18;
  if (element.layout === 'column') {
    context.font = `600 14px ${palette.ui}`;
    context.fillStyle = palette.muted;
    context.fillText('☰', left, middle);
    left += 24;
  }

  const title = element.text?.trim() || 'Frame';
  context.font = `600 ${FRAME_FONT}px ${palette.ui}`;
  context.fillStyle = palette.stroke.ink;
  if (!hideText) {
    context.fillText(title, left, middle);
  }

  const countLeft = left + (hideText ? 0 : context.measureText(title).width + 10);
  const count = String(members);
  context.font = `600 12px ${palette.ui}`;
  const width = context.measureText(count).width + 14;
  context.fillStyle = palette.dots;
  context.beginPath();
  context.roundRect(countLeft, middle - 10, width, 20, 10);
  context.fill();
  context.fillStyle = palette.muted;
  context.fillText(count, countLeft + 7, middle + 0.5);
  context.restore();
};

/** A card: printed, with a strip in its colour, a box that ticks it done, its words, and who wrote it. */
const drawCard = (
  context: CanvasRenderingContext2D,
  element: BoardElement,
  palette: Palette,
  lines: string[],
  lineHeight: number,
  hideText: boolean,
  authors: boolean
): void => {
  const { width, height } = element;
  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.14)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 3;
  context.beginPath();
  context.roundRect(0, 0, width, height, 10);
  context.fillStyle = palette.surface;
  context.fill();
  context.shadowColor = 'transparent';
  context.strokeStyle = palette.edge;
  context.lineWidth = 1;
  context.stroke();
  if (element.fill !== 'none') {
    context.save();
    context.clip();
    context.fillStyle = palette.fill[element.fill];
    context.fillRect(0, 0, 6, height);
    context.restore();
  }

  const { x, y, size } = CARD_CHECK;
  context.beginPath();
  context.roundRect(x, y, size, size, 5);
  context.lineWidth = 1.5;
  context.strokeStyle = element.done ? palette.accent : palette.muted;
  context.fillStyle = element.done ? palette.accent : 'transparent';
  context.fill();
  context.stroke();
  if (element.done) {
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2.2;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x + 4.5, y + 9.5);
    context.lineTo(x + 7.8, y + 12.8);
    context.lineTo(x + 13.5, y + 5.5);
    context.stroke();
  }

  if (!hideText) {
    context.font = `${CARD_FONT}px ${palette.ui}`;
    context.textBaseline = 'top';
    context.fillStyle = element.done ? palette.muted : palette.stroke.ink;
    lines.forEach((line, index) => {
      const top = CARD_PADDING + index * lineHeight + (lineHeight - CARD_FONT) / 2;
      context.fillText(line, CARD_TEXT_LEFT, top);
      if (element.done && line) {
        const lineWidth = context.measureText(line).width;
        context.fillRect(CARD_TEXT_LEFT, top + CARD_FONT * 0.55, lineWidth, 1.5);
      }
    });
  }

  if (element.author && authors) {
    drawAuthor(
      context,
      `Author: ${element.author}`,
      CARD_TEXT_LEFT,
      height - CARD_AUTHOR_ROW / 2 - 4,
      palette,
      palette.muted
    );
  }

  context.restore();
};

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
  if (element.fontSize !== undefined) {
    return element.fontSize;
  }

  if (element.type === 'sticky') {
    return STICKY_FONT;
  }

  if (element.type === 'card') {
    return CARD_FONT;
  }

  if (element.type === 'frame') {
    return FRAME_FONT;
  }

  if (element.type === 'comment') {
    return COMMENT_FONT;
  }

  return takesLabel(element.type) ? LABEL_FONT : FONT_SIZES[element.strokeWidth];
};

/** What is written in the hand-drawn face — everything but a card and a frame's title, which are set in the interface's. */
export const faceOf = (element: BoardElement, palette: Palette): string =>
  element.type === 'card' || element.type === 'frame' || element.type === 'comment' ? palette.ui : palette.font;

export const fontOf = (element: BoardElement, palette: Palette): string =>
  `${element.type === 'frame' ? '600 ' : ''}${fontSizeOf(element)}px ${faceOf(element, palette)}`;

/** How wide a written element's lines may run before they wrap — `undefined` for one whose lines are as typed. */
const wrapWidth = (element: BoardElement): number | undefined => {
  if (element.type === 'sticky') {
    return element.width - STICKY_PADDING * 2;
  }

  if (element.type === 'card') {
    return element.width - CARD_TEXT_LEFT - CARD_PADDING;
  }

  if (element.type === 'comment') {
    return COMMENT_BUBBLE.width - COMMENT_BUBBLE.padding * 2;
  }

  return takesLabel(element.type) ? element.width - LABEL_PADDING * 2 : undefined;
};

/** A sticky's words wrapped to its width; a text's lines as typed. */
export const layoutText = (
  context: CanvasRenderingContext2D,
  element: BoardElement,
  palette: Palette
): { lines: string[]; lineHeight: number } => {
  context.font = fontOf(element, palette);
  const lineHeight = fontSizeOf(element) * LINE_HEIGHT;
  const paragraphs = (element.text ?? '').split('\n');
  const width = wrapWidth(element);
  if (width === undefined) {
    return { lines: paragraphs, lineHeight };
  }

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

/** A card's height: its words, wrapped, and the row for who wrote it — never less than one line's worth. */
export const measureCard = (context: CanvasRenderingContext2D, element: BoardElement, palette: Palette): number => {
  const { lines, lineHeight } = layoutText(context, element, palette);
  const words = Math.max(1, lines.length) * lineHeight;

  return Math.max(
    CARD_CHECK.size + CARD_PADDING * 2,
    CARD_PADDING * 2 + words + (element.author ? CARD_AUTHOR_ROW : 0)
  );
};

/** How much a hand shows, as rough.js's roughness: the artist's is the default, a little more than rough's own. */
const ROUGHNESS: Record<'architect' | 'artist' | 'cartoonist', number> = { architect: 0, artist: 1.1, cartoonist: 2.2 };

/** A closed outline with its corners rounded — an SVG path, so rough.js draws it and a clip follows it exactly. */
const roundedPath = (corners: readonly Point[], radius: number): string => {
  const at = (from: Point, to: Point): Point => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    const reach = Math.min(radius, length / 2) / length;

    return [from[0] + (to[0] - from[0]) * reach, from[1] + (to[1] - from[1]) * reach];
  };

  return `${corners
    .map((corner, index) => {
      const before = at(corner, corners[(index - 1 + corners.length) % corners.length]);
      const after = at(corner, corners[(index + 1) % corners.length]);

      return `${index ? 'L' : 'M'} ${before[0]} ${before[1]} Q ${corner[0]} ${corner[1]} ${after[0]} ${after[1]}`;
    })
    .join(' ')} Z`;
};

/** A small tile of ink with holes in it, seeded so every screen draws the same grain: a pencil's, or chalk's. */
const grainTile = (colour: string, coarse: boolean): HTMLCanvasElement => {
  const tile = document.createElement('canvas');
  tile.width = 48;
  tile.height = 48;
  const context = tile.getContext('2d');
  if (!context) {
    return tile;
  }

  context.fillStyle = colour;
  context.fillRect(0, 0, 48, 48);
  let seed = coarse ? 7 : 3;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;

    return seed / 2147483647;
  };
  // Chalk leaves the paper showing through in soft flecks; a pencil, in a fine tooth.
  context.globalCompositeOperation = 'destination-out';
  for (let index = 0; index < (coarse ? 150 : 220); index += 1) {
    const size = coarse ? 1 + random() * 1.6 : 0.7 + random() * 0.7;
    context.globalAlpha = coarse ? 0.5 + random() * 0.5 : 1;
    context.fillRect(random() * 48, random() * 48, size, size);
  }

  return tile;
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
    element.dash ?? '',
    element.sloppiness ?? '',
    element.brush ?? '',
    element.edges ?? '',
    element.fillStyle ?? '',
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
        ...penOf(element),
        last: true
      });

      return { path: outlinePath(outline) };
    }

    const dash =
      element.dash === 'dashed'
        ? [element.strokeWidth * 4 + 6, element.strokeWidth * 3 + 5]
        : element.dash === 'dotted'
          ? [1, element.strokeWidth * 3 + 4]
          : undefined;
    const roughness = element.type === 'sticky' ? 0.6 : ROUGHNESS[element.sloppiness ?? 'artist'];
    const options: Options = {
      seed: element.seed,
      stroke,
      strokeWidth: element.strokeWidth,
      roughness,
      bowing: roughness ? 1 : 0,
      ...(element.type === 'sticky' ? { fill: palette.sticky[element.fill], fillStyle: 'solid' } : {}),
      // One pass, not rough's two: a dash drawn twice, a little apart, reads as two dashes.
      ...(dash ? { strokeLineDash: dash, disableMultiStroke: true } : {})
    };
    const { width, height } = element;
    const hatch: Options = {
      ...options,
      stroke: 'none',
      fill: palette.fill[element.fill],
      fillStyle: element.fillStyle === 'solid' ? 'solid' : element.fillStyle === 'cross' ? 'cross-hatch' : 'hachure',
      hachureGap: 6 + element.strokeWidth * 2,
      fillWeight: Math.max(1, element.strokeWidth / 1.5)
    };
    const hatched = element.fill !== 'none';
    const outline = outlineOf(element.type, width, height);
    const corners: Point[] | undefined =
      outline ??
      (element.type === 'rectangle'
        ? [
            [0, 0],
            [width, 0],
            [width, height],
            [0, height]
          ]
        : undefined);
    if (corners && element.edges === 'round') {
      const path = roundedPath(corners, Math.min(32, Math.min(width, height) * (outline ? 0.14 : 0.2)));

      return {
        drawables: [generator.path(path, options)],
        ...(hatched ? { fill: { drawable: generator.path(path, hatch), clip: new Path2D(path) } } : {})
      };
    }

    if (outline) {
      const clip = new Path2D();
      outline.forEach(([px, py], index) => (index ? clip.lineTo(px, py) : clip.moveTo(px, py)));
      clip.closePath();

      return {
        drawables: [generator.polygon(outline, options)],
        ...(hatched ? { fill: { drawable: generator.polygon(outline, hatch), clip } } : {})
      };
    }

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
      // A drum: its sides, the rim at its top drawn whole, the curve of its base.
      case 'cylinder': {
        const rim = Math.min(height * 0.16, 28);
        const body = `M 0 ${rim} L 0 ${height - rim} A ${width / 2} ${rim} 0 0 0 ${width} ${height - rim} L ${width} ${rim}`;
        const clip = new Path2D(`${body} A ${width / 2} ${rim} 0 0 0 0 ${rim} Z`);

        return {
          drawables: [generator.path(body, options), generator.ellipse(width / 2, rim, width, rim * 2, options)],
          ...(hatched ? { fill: { drawable: generator.rectangle(0, 0, width, height, hatch), clip } } : {})
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
      // Drawn whole by their own functions (`drawStack`, `drawPicture`, `drawFrame`, `drawCard`): no outline here.
      case 'stack':
      case 'image':
      case 'frame':
      case 'card':
      case 'comment':
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

  const grains = new Map<string, CanvasPattern | null>();

  /** How a pen stroke is filled, by its brush: flat ink, see-through, grainy, or glowing. */
  const inkFor = (context: CanvasRenderingContext2D, element: BoardElement, palette: Palette): void => {
    const colour = palette.stroke[element.stroke];
    context.fillStyle = colour;
    if (element.brush === 'highlighter') {
      context.globalAlpha *= 0.38;
    } else if (element.brush === 'pencil' || element.brush === 'chalk') {
      const key = `${element.brush}:${colour}`;
      if (!grains.has(key)) {
        grains.set(key, context.createPattern(grainTile(colour, element.brush === 'chalk'), 'repeat'));
      }

      context.fillStyle = grains.get(key) ?? colour;
    } else if (element.brush === 'neon') {
      context.shadowColor = colour;
      context.shadowBlur = 16;
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
      voter,
      members = 0,
      authors = true
    }: {
      hideText?: boolean;
      faded?: boolean;
      picture?: CanvasImageSource;
      voter?: string;
      /** A frame's: how many things are in it. */
      members?: number;
      /** Who wrote cards is shown. */
      authors?: boolean;
    } = {}
  ): void => {
    context.save();
    context.translate(element.x, element.y);
    context.globalAlpha = (faded ? 0.25 : 1) * ((element.opacity ?? 100) / 100);

    if (element.type === 'stack') {
      drawStack(context, element, palette);
    }

    if (element.type === 'image') {
      drawPicture(context, element, palette, picture);
    }

    if (element.type === 'frame') {
      drawFrame(context, element, palette, members, hideText);
    }

    if (element.type === 'card') {
      const { lines, lineHeight } = layoutText(context, element, palette);
      drawCard(context, element, palette, lines, lineHeight, hideText, authors);
    }

    if (element.type === 'comment') {
      drawCommentPin(context, element, palette);
    }

    if (element.type === 'sticky') {
      context.shadowColor = 'rgba(0, 0, 0, 0.18)';
      context.shadowBlur = 12;
      context.shadowOffsetY = 4;
      context.fillStyle = palette.sticky[element.fill];
      context.fillRect(0, 0, element.width, element.height);
      context.shadowColor = 'transparent';
    }

    if (element.type === 'stamp') {
      drawStamp(context, element);
    }

    if (!['text', 'frame', 'card', 'comment', 'stamp'].includes(element.type)) {
      const shape = shapeOf(element, palette);
      if ('path' in shape) {
        inkFor(context, element, palette);
        context.fill(shape.path);
        if (element.brush === 'neon') {
          // The tube's bright core, over its glow.
          context.shadowColor = 'transparent';
          context.globalAlpha *= 0.55;
          context.fillStyle = '#ffffff';
          context.fill(shape.path);
        }
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

  /**
   * What an element shows while it is pointed at, selected or being written, over the element itself: a comment's
   * bubble, a note's author. Apart from the element, so it can be drawn over a board that was painted without it —
   * pointing at a note does not paint the board again.
   */
  const drawOpened = (
    context: CanvasRenderingContext2D,
    element: BoardElement,
    palette: Palette,
    { hideText = false, authors = true }: { hideText?: boolean; authors?: boolean } = {}
  ): void => {
    context.save();
    context.translate(element.x, element.y);
    context.globalAlpha = (element.opacity ?? 100) / 100;
    if (element.type === 'comment') {
      const { lines, lineHeight } = layoutText(context, element, palette);
      drawCommentBubble(context, element, palette, lines, lineHeight, hideText);
    }

    // Who wrote a note is a signature, not part of it: shown while the note is pointed at or selected.
    if (element.type === 'sticky' && element.author && authors) {
      drawAuthor(
        context,
        `Author: ${element.author}`,
        STICKY_PADDING,
        element.height - 16,
        palette,
        palette.stroke.ink
      );
    }

    context.restore();
  };

  return {
    drawElement,
    drawOpened,
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
export const drawDots = (context: CanvasRenderingContext2D, camera: Camera, area: Box, colour: string): void => {
  let spacing = 24 * camera.zoom;
  while (spacing < 12) {
    spacing *= 2;
  }

  const size = Math.max(1, Math.min(2, camera.zoom * 1.5));
  // The dot at or just before the area's edge, wherever the board is scrolled to — a dot straddling the edge is half in.
  const first = (edge: number, scroll: number): number => {
    const phase = (((edge + scroll * camera.zoom) % spacing) + spacing) % spacing;

    return edge - phase;
  };
  context.fillStyle = colour;
  for (let x = first(area.x - size, camera.x); x < area.x + area.width + size; x += spacing) {
    for (let y = first(area.y - size, camera.y); y < area.y + area.height + size; y += spacing) {
      context.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }
};

/**
 * Outlines around elements, in screen space — a steady line however far the board is zoomed. Many at once — a
 * selection of a thousand, everybody else's — as one path and one stroke, and only those in `view`: what a marquee over
 * a busy board draws at every step.
 */
export const drawOutlines = (
  context: CanvasRenderingContext2D,
  camera: Camera,
  boxes: Iterable<Box>,
  view: Box,
  colour: string,
  dashed: boolean
): void => {
  context.save();
  context.strokeStyle = colour;
  context.lineWidth = 1.5;
  context.setLineDash(dashed ? [5, 4] : []);
  context.beginPath();
  for (const box of boxes) {
    if (
      box.x < view.x + view.width &&
      box.x + box.width > view.x &&
      box.y < view.y + view.height &&
      box.y + box.height > view.y
    ) {
      const [x, y] = toScreen(camera, box.x, box.y);
      context.rect(x - 6, y - 6, box.width * camera.zoom + 12, box.height * camera.zoom + 12);
    }
  }

  context.stroke();
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

/** A frame something would be let go into: lit in the accent — and in a column, the gap it would take, as a bar. */
export const drawDropTarget = (
  context: CanvasRenderingContext2D,
  camera: Camera,
  box: Box,
  colour: string,
  line?: number
): void => {
  const [x, y] = toScreen(camera, box.x, box.y);
  const [width, height] = [box.width * camera.zoom, box.height * camera.zoom];
  context.save();
  context.fillStyle = colour;
  context.globalAlpha = 0.07;
  context.beginPath();
  context.roundRect(x, y, width, height, 14 * camera.zoom);
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = colour;
  context.lineWidth = 2;
  context.setLineDash([7, 5]);
  context.stroke();
  if (line !== undefined) {
    const [, lineY] = toScreen(camera, box.x, line);
    context.setLineDash([]);
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x + 14, lineY);
    context.lineTo(x + width - 14, lineY);
    context.stroke();
    context.beginPath();
    context.arc(x + 14, lineY, 4, 0, Math.PI * 2);
    context.fill();
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
