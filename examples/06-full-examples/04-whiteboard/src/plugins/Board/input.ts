import { toBoard } from './geometry.ts';
import { pictureIn, readPicture } from './pictures.ts';

import type { Core } from './core.ts';
import type { Pictures } from './pictures.ts';
import type { PointerHandlers } from './pointer.ts';
import type { BoardElement, Point } from '../../board/model.ts';

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** What reaches the canvas besides the pointer: space held to pan, and pictures pasted or dropped. */
export const createInput = (core: Core, pictures: Pictures, pointer: PointerHandlers) => {
  const { canvas, state } = core;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' && !typing(event.target) && core.present()) {
      event.preventDefault();
      if (!state.spaceHeld) {
        state.spaceHeld = true;
        canvas.style.cursor = 'grab';
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      state.spaceHeld = false;
      canvas.style.cursor = core.restCursor();
    }
  };

  /**
   * A picture onto the board: shown at once from this page's copy, sized to sit comfortably in view, and handed to the
   * page to upload. It is committed only once the server has kept it (`placeImage`), so nobody else ever sees an
   * image that is not there.
   */
  const addPicture = async (file: File, at?: Point): Promise<void> => {
    const picture = await readPicture(file);
    const fit = Math.min(1, 480 / picture.width, 360 / picture.height);
    const [width, height] = [picture.width * fit, picture.height * fit];
    const [cx, cy] = at ?? core.aim();
    const element: BoardElement = {
      ...core.newElement('image', [cx - width / 2, cy - height / 2]),
      width,
      height
    };
    pictures.hold(element.id, picture.image);
    core.draft.set(element.id, element);
    core.invalidate();
    core.emit({ type: 'image', id: element.id, data: picture.data });
  };

  const onPaste = (event: ClipboardEvent): void => {
    const file = core.editable() && !typing(event.target) ? pictureIn(event.clipboardData?.items ?? []) : undefined;
    if (file) {
      event.preventDefault();
      void addPicture(file);
    }
  };

  const onDragOver = (event: DragEvent): void => {
    if (core.editable() && event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
    }
  };

  const onDrop = (event: DragEvent): void => {
    const file = core.editable() ? pictureIn(event.dataTransfer?.files ?? []) : undefined;
    if (file) {
      event.preventDefault();
      void addPicture(file, toBoard(state.camera, ...pointer.screenOf(event)));
    }
  };

  return { onKeyDown, onKeyUp, onPaste, onDragOver, onDrop };
};
