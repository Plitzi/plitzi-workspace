import { takesLabel } from '../../board/model.ts';
import {
  CARD_PADDING,
  CARD_TEXT_LEFT,
  COMMENT_BUBBLE,
  faceOf,
  fontSizeOf,
  LABEL_PADDING,
  layoutText,
  STICKY_PADDING
} from './draw.ts';
import { FRAME_HEADER, toScreen } from './geometry.ts';

import type { Camera } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { TextEditor } from './types.ts';
import type { BoardElement } from '../../board/model.ts';

/** Where the field typing into `element` goes on screen, so what is typed sits where it will be drawn. */
export const editorFor = (
  element: BoardElement,
  camera: Camera,
  palette: Palette,
  context: CanvasRenderingContext2D
): TextEditor => {
  const [left, top] = toScreen(camera, element.x, element.y);
  const sticky = element.type === 'sticky';
  const common = {
    id: element.id,
    text: element.text ?? '',
    left,
    top,
    fontSize: fontSizeOf(element) * camera.zoom,
    font: faceOf(element, palette),
    color: palette.stroke[element.stroke],
    composer: element.type === 'comment'
  };
  // A card's words start past its done box and wrap at its width; a frame's title sits in its title bar.
  if (element.type === 'card') {
    return {
      ...common,
      left: left + (CARD_TEXT_LEFT - 2) * camera.zoom,
      width: (element.width - CARD_TEXT_LEFT - CARD_PADDING + 4) * camera.zoom,
      minHeight: fontSizeOf(element) * 1.25 * camera.zoom,
      padding: 0,
      paddingTop: CARD_PADDING * camera.zoom,
      wraps: true,
      align: 'left'
    };
  }

  // A comment's composer stands beside its pin, at the size it is read at, whatever the zoom.
  if (element.type === 'comment') {
    return {
      ...common,
      left: left + COMMENT_BUBBLE.left * camera.zoom,
      top: top + COMMENT_BUBBLE.top * camera.zoom,
      width: COMMENT_BUBBLE.width,
      minHeight: 44,
      fontSize: 14,
      padding: 0,
      paddingTop: 0,
      wraps: true,
      align: 'left'
    };
  }

  if (element.type === 'frame') {
    const size = fontSizeOf(element) * camera.zoom;

    return {
      ...common,
      left: left + 16 * camera.zoom,
      top: top + ((FRAME_HEADER - fontSizeOf(element) * 1.25) / 2) * camera.zoom,
      width: Math.min(element.width - 32, 360) * camera.zoom,
      minHeight: size * 1.25,
      padding: 0,
      paddingTop: 0,
      wraps: false,
      align: 'left'
    };
  }

  if (takesLabel(element.type)) {
    // Typed where it will be drawn: centred, and lowered to the middle as its lines are.
    const { lines, lineHeight } = layoutText(context, element, palette);

    return {
      ...common,
      width: element.width * camera.zoom,
      minHeight: element.height * camera.zoom,
      padding: LABEL_PADDING * camera.zoom,
      paddingTop: Math.max(0, (element.height - Math.max(1, lines.length) * lineHeight) / 2) * camera.zoom,
      wraps: true,
      align: 'center'
    };
  }

  return {
    ...common,
    width: sticky ? element.width * camera.zoom : Math.max(element.width, 40) * camera.zoom + 24,
    minHeight: (sticky ? element.height : fontSizeOf(element) * 1.25) * camera.zoom,
    padding: sticky ? STICKY_PADDING * camera.zoom : 0,
    paddingTop: sticky ? STICKY_PADDING * camera.zoom : 0,
    wraps: sticky,
    align: 'left'
  };
};
