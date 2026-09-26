import { FILLS } from '../../board/model.ts';
import { DEFAULT_BOX, STACK_BOX } from './core.ts';
import { toBoard } from './geometry.ts';
import { isOneOf } from './values.ts';

import type { Core } from './core.ts';
import type { BoardElement, Fill, Point } from '../../board/model.ts';

/** How far a sticky must be dragged off its pad before letting go places it — less is a click, which carries it. */
const CARRY_DRAG = 8;

/**
 * A sticky — or a whole pile — taken off the tray: the pad is outside the canvas, so it is followed on the whole
 * window. Dragged onto the board it lands where it is let go; clicked, it stays in hand until a click on the board.
 */
export const createCarry = (core: Core) => {
  const { state, canvas, draft } = core;

  /** Where a carried sticky would land: centred under the pointer, so it is put down where it is seen. */
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

  /** Down on the board: kept, selected, and — a note — open for typing, the next thing anyone does with one. */
  const putDown = (point: Point): void => {
    const carried = state.carrying?.element;
    end();
    if (!carried) {
      return;
    }

    const placed = carriedAt(carried, point);
    core.sounds.play('place');
    core.commit([placed]);
    core.setSelection([placed.id]);
    // A note is written on the moment it lands; a pile is there to be taken from.
    if (placed.type === 'sticky') {
      core.startEditing(core.scene.element(placed.id) ?? placed);
    }
  };

  function onMove(event: PointerEvent): void {
    const { carrying } = state;
    if (!carrying) {
      return;
    }

    const from = carrying.from ?? [event.clientX, event.clientY];
    carrying.from = from;
    carrying.moved ||= Math.hypot(event.clientX - from[0], event.clientY - from[1]) > CARRY_DRAG;
    const rect = canvas.getBoundingClientRect();
    carrying.over =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (carrying.over) {
      const point = onBoard(event);
      state.lastPointer = point;
      draft.set(carrying.element.id, carriedAt(carrying.element, point));
      core.aimDrop(point, new Set([carrying.element.id]));
    } else {
      draft.delete(carrying.element.id);
      core.aimDrop(undefined, new Set());
    }

    core.reportPointer(false);
    core.invalidate();
  }

  /** Let go after a drag: onto the board it lands there, anywhere else it goes back. */
  function onUp(event: PointerEvent): void {
    if (!state.carrying?.moved) {
      return;
    }

    if (state.carrying.over) {
      putDown(onBoard(event));
    } else {
      end();
    }
  }

  /** A note in `fill`'s paper, or a pile of them for everyone to take from. */
  const start = ({ fill, kind }: { fill?: unknown; kind?: unknown }): void => {
    end();
    if (!core.editable()) {
      return;
    }

    const paper: Fill = isOneOf(FILLS, fill) && fill !== 'none' ? fill : 'yellow';
    const element =
      kind === 'stack'
        ? { ...core.newElement('stack', [0, 0]), ...STACK_BOX, fill: paper }
        : { ...core.newElement('sticky', [0, 0]), ...DEFAULT_BOX.sticky, fill: paper };
    state.carrying = { element, moved: false, over: false };
    core.setSelection([]);
    canvas.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { start, end, putDown };
};

export type Carry = ReturnType<typeof createCarry>;
