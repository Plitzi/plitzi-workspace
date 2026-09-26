import { DEFAULT_BOX } from './core.ts';
import { toBoard } from './geometry.ts';
import { pictureIn, readPicture } from './pictures.ts';
import { isDefined } from './values.ts';
import { LIMITS, parseElement } from '../../board/model.ts';

import type { Core } from './core.ts';
import type { Pictures } from './pictures.ts';
import type { PointerHandlers } from './pointer.ts';
import type { BoardElement, Point } from '../../board/model.ts';

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * What the clipboard carries of a board: its elements, as JSON behind a mark — so a paste can tell a copy from this or
 * any other board from text somebody copied elsewhere, which becomes a note.
 */
const CLIPBOARD_MARK = 'pizarra/elements ';

/** What copying takes and pasting puts, which the controller decides: a frame is copied with what is in it. */
export type Clipboard = {
  copy: () => BoardElement[];
  paste: (elements: BoardElement[], at: Point | undefined) => void;
  remove: () => void;
};

/**
 * What reaches the canvas besides the pointer: space held to pan; pictures pasted or dropped; elements copied, cut
 * and pasted — between boards too — and text pasted as a note.
 */
export const createInput = (core: Core, pictures: Pictures, pointer: PointerHandlers, clipboard: Clipboard) => {
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

  const onCopy = (event: ClipboardEvent): void => {
    const chosen = typing(event.target) || !core.present() || state.editing ? [] : clipboard.copy();
    if (chosen.length && event.clipboardData) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', `${CLIPBOARD_MARK}${JSON.stringify(chosen)}`);
    }
  };

  const onCut = (event: ClipboardEvent): void => {
    onCopy(event);
    if (event.defaultPrevented && core.editable()) {
      clipboard.remove();
    }
  };

  /** What a paste of text is: elements a board copied, or — anything else — a note that says it. */
  const pastedElements = (text: string): BoardElement[] => {
    if (text.startsWith(CLIPBOARD_MARK)) {
      try {
        const value: unknown = JSON.parse(text.slice(CLIPBOARD_MARK.length));

        // As many as a board can hold: the commit is split for the server wherever it is bigger than one it takes.
        return Array.isArray(value) ? value.slice(0, LIMITS.elements).map(parseElement).filter(isDefined) : [];
      } catch {
        return [];
      }
    }

    const words = text.trim().slice(0, LIMITS.text);

    return words ? [{ ...core.newElement('sticky', [0, 0]), ...DEFAULT_BOX.sticky, text: words }] : [];
  };

  const onPaste = (event: ClipboardEvent): void => {
    if (!core.editable() || typing(event.target) || state.editing) {
      return;
    }

    const file = pictureIn(event.clipboardData?.items ?? []);
    if (file) {
      event.preventDefault();
      void addPicture(file);

      return;
    }

    const elements = pastedElements(event.clipboardData?.getData('text/plain') ?? '');
    if (elements.length) {
      event.preventDefault();
      clipboard.paste(elements, state.lastPointer);
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

  return { onKeyDown, onKeyUp, onCopy, onCut, onPaste, onDragOver, onDrop };
};
