import { takesLabel } from '../../board/model.ts';
import { fontSizeOf, LABEL_PADDING, layoutText, STICKY_PADDING } from './draw.ts';
import { toScreen } from './geometry.ts';

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
    font: palette.font,
    color: palette.stroke[element.stroke]
  };
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
