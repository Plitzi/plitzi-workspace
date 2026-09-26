import { COLUMN_PADDING, columnAt } from './containers.ts';
import { COMMENT_PIN_BOX, DEFAULT_BOX, STACK_BOX } from './core.ts';
import { toBoard } from './geometry.ts';
import { PLACED_TOOLS } from './types.ts';
import { isOneOf } from './values.ts';
import { FILLS, holdsText } from '../../board/model.ts';

import type { Core } from './core.ts';
import type { Carrying, PlacedTool } from './types.ts';
import type { BoardElement, Fill, Point } from '../../board/model.ts';

/** How far a carried thing must be dragged before letting go places it — less is a click. */
const CARRY_DRAG = 8;

/** What a text carried shows on its way: the words a text starts as are none, and none would be nothing to see. */
const TEXT_PREVIEW = 'Text';

/**
 * Something taken to the board from outside the canvas — a note or a whole pile off the tray, any element off the
 * library — followed on the whole window. Dragged onto the board it lands where it is let go; a pad clicked keeps it
 * in hand until a click on the board. It is over the board only where the board is what the pointer is on: let go
 * over a panel or the toolbar, it goes back.
 */
export const createCarry = (core: Core) => {
  const { state, canvas, draft } = core;

  /** Where a carried element would land: centred under the pointer, so it is put down where it is seen. */
  const carriedAt = (element: BoardElement, [x, y]: Point): BoardElement => ({
    ...element,
    x: x - element.width / 2,
    y: y - element.height / 2,
    z: core.scene.topZ + 1
  });

  const onBoard = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();

    return toBoard(state.camera, event.clientX - rect.left, event.clientY - rect.top);
  };

  /** The element a tool puts down, at its usual size — a note in `paper`. */
  const elementFor = (tool: PlacedTool, paper: Fill): BoardElement => {
    switch (tool) {
      case 'sticky':
        return { ...core.newElement('sticky', [0, 0]), ...DEFAULT_BOX.sticky, fill: paper };
      case 'frame':
        return { ...core.newElement('frame', [0, 0]), ...DEFAULT_BOX.frame };
      case 'column':
        return { ...core.newElement('frame', [0, 0]), ...DEFAULT_BOX.column, layout: 'column' };
      case 'text':
        return core.measured({ ...core.newElement('text', [0, 0]), text: TEXT_PREVIEW });
      case 'comment':
        return { ...core.newElement('comment', [0, 0]), ...COMMENT_PIN_BOX };
      case 'card':
        return core.measured({
          ...core.newElement('card', [0, 0]),
          width: DEFAULT_BOX.column.width - COLUMN_PADDING * 2
        });
      default:
        return { ...core.newElement(tool, [0, 0]), ...DEFAULT_BOX.shape };
    }
  };

  const end = (): void => {
    if (!state.carrying) {
      return;
    }

    draft.delete(state.carrying.element.id);
    state.carrying = undefined;
    state.dropTarget = undefined;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    canvas.style.cursor = core.restCursor();
    core.reportPointer(true);
    core.invalidate();
  };

  /**
   * Down on the board, as its tool would have made it there: kept and selected — and a note, a frame, a card, a text
   * or a comment open for writing, the next thing anyone does with one. A card lands only in a column.
   */
  const putDown = (point: Point): void => {
    const carried = state.carrying;
    end();
    if (!carried) {
      return;
    }

    switch (carried.tool) {
      case 'card': {
        const column = columnAt(core.displayed(), point);
        if (column) {
          core.addCard(column, point);
        }

        return;
      }
      case 'text':
        core.startText(point);

        return;
      case 'comment':
        core.startComment(point);

        return;
      default: {
        const placed = carriedAt(carried.element, point);
        core.sounds.play('place');
        core.commit([placed]);
        core.setSelection([placed.id]);
        if (holdsText(placed.type)) {
          core.startEditing(core.scene.element(placed.id) ?? placed);
        }
      }
    }
  };

  function onMove(event: PointerEvent): void {
    const { carrying } = state;
    if (!carrying) {
      return;
    }

    const from = carrying.from ?? [event.clientX, event.clientY];
    carrying.from = from;
    if (!carrying.moved && Math.hypot(event.clientX - from[0], event.clientY - from[1]) > CARRY_DRAG) {
      carrying.moved = true;
      core.emit({ type: 'carry' });
    }

    // On the board is where the board itself is under the pointer — not a panel or a bar over it.
    carrying.over = document.elementFromPoint(event.clientX, event.clientY) === canvas;
    if (carrying.over && carrying.moved) {
      const point = onBoard(event);
      state.lastPointer = point;
      draft.set(carrying.element.id, carriedAt(carrying.element, point));
      if (carrying.tool === 'card') {
        core.aimCard(point);
      } else {
        core.aimDrop(point, new Set([carrying.element.id]));
      }
    } else {
      draft.delete(carrying.element.id);
      core.aimDrop(undefined, new Set());
    }

    core.reportPointer(false);
    core.invalidate();
  }

  /** Let go after a drag: onto the board it lands there, anywhere else it goes back. Without one, it was a click. */
  function onUp(event: PointerEvent): void {
    const { carrying } = state;
    if (!carrying?.moved) {
      if (carrying?.drag) {
        end();
      }

      return;
    }

    if (carrying.over) {
      putDown(onBoard(event));
    } else {
      end();
    }
  }

  /**
   * What `tool` puts down — a note in `fill`'s paper when it is the pad's, or a pile of them (`kind: 'stack'`) — taken
   * to the board. `drag`: taken by a press, which is only carried if it is dragged.
   */
  const start = ({
    fill,
    kind,
    tool,
    drag
  }: {
    fill?: unknown;
    kind?: unknown;
    tool?: unknown;
    drag?: unknown;
  }): void => {
    end();
    if (!core.editable()) {
      return;
    }

    const paper: Fill = isOneOf(FILLS, fill) && fill !== 'none' ? fill : 'yellow';
    const placed: PlacedTool = isOneOf(PLACED_TOOLS, tool) ? tool : 'sticky';
    const carrying: Carrying =
      kind === 'stack'
        ? {
            element: { ...core.newElement('stack', [0, 0]), ...STACK_BOX, fill: paper },
            tool: 'stack',
            moved: false,
            over: false,
            drag: false
          }
        : {
            element: elementFor(placed, paper),
            tool: placed,
            moved: false,
            over: false,
            drag: drag === true || drag === 'true'
          };
    state.carrying = carrying;
    core.setSelection([]);
    canvas.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { start, end, putDown };
};

export type Carry = ReturnType<typeof createCarry>;
