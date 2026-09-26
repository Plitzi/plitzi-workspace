import { FILLS, isLinear, parseElement, STROKES, STROKE_WIDTHS, takesStyle } from '../../board/model.ts';
import { isReaction } from '../../board/reactions.ts';
import { createCarry } from './carry.ts';
import { releasedFrom } from './connectors.ts';
import { createCore } from './core.ts';
import { createEffects } from './effects.ts';
import { exportPng } from './exporter.ts';
import { toScreen, zoomAt } from './geometry.ts';
import { createInput } from './input.ts';
import { readPalette } from './palette.ts';
import { createPicking } from './picking.ts';
import { createPictures } from './pictures.ts';
import { createPointer } from './pointer.ts';
import { createPainter } from './render.ts';
import { isView } from './remotes.ts';
import { byZ, isDefined, isOneOf, isPoint, newId } from './values.ts';

import type { ControllerEvent, ControllerProps } from './types.ts';
import type { Binding, BoardElement, Point } from '../../board/model.ts';
import type { Collaborator } from '../../board/people.ts';

export { TOOLS } from './types.ts';
export type {
  BoardMode,
  ControllerEvent,
  ControllerProps,
  PointerMessage,
  ScreenBox,
  Stylable,
  TextEditor,
  Tool,
  View
} from './types.ts';

/**
 * The canvas, without React: a scene, a camera, a pointer, and a renderer.
 *
 * Everything that happens sixty times a second lives here, in plain objects and one animation frame. The component
 * around it hands it props, forwards what the channels hear, and turns what it `emit`s into the element's events.
 * This file puts the parts together and answers the page; each part is its own module over the shared `core`.
 */
export const createBoardController = (
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  emit: (event: ControllerEvent) => void
) => {
  const core = createCore(canvas, host, emit);
  const { state, scene, selection, draft, remotes } = core;
  const effects = createEffects();
  const pictures = createPictures(() => core.invalidate());
  const picking = createPicking(core);
  const carry = createCarry(core);
  const pointer = createPointer(core, picking, carry, effects);
  const input = createInput(core, pictures, pointer);
  core.paintWith(createPainter(core, effects, pictures).paint);

  canvas.addEventListener('pointerdown', pointer.onPointerDown);
  canvas.addEventListener('pointermove', pointer.onPointerMove);
  canvas.addEventListener('pointerup', pointer.onPointerUp);
  canvas.addEventListener('pointercancel', pointer.onPointerUp);
  canvas.addEventListener('pointerleave', pointer.onPointerLeave);
  canvas.addEventListener('dblclick', pointer.onDoubleClick);
  canvas.addEventListener('wheel', pointer.onWheel, { passive: false });
  canvas.addEventListener('dragover', input.onDragOver);
  canvas.addEventListener('drop', input.onDrop);
  window.addEventListener('paste', input.onPaste);
  window.addEventListener('keydown', input.onKeyDown);
  window.addEventListener('keyup', input.onKeyUp);

  const resizeObserver = new ResizeObserver(() => {
    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    state.size = { width: rect.width, height: rect.height, dpr };
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    if (state.fitPending && rect.width && rect.height) {
      state.fitPending = false;
      core.fit();
    }

    core.invalidate();
  });
  resizeObserver.observe(host);

  // ── What the page asks of it ─────────────────────────────────────────────────────────────────────────────────────

  /** Only on a board that can change, and while nobody types: ⌘Z in a text field is the field's own undo. */
  const whenEditable = (action: () => void) => (): void => {
    if (core.editable() && !state.editing) {
      action();
    }
  };

  const zoomBy = (factor: number): void => {
    core.stopFollowing();
    core.setCamera(zoomAt(state.camera, state.size.width / 2, state.size.height / 2, state.camera.zoom * factor));
  };

  /** The selection restyled — each element with only what it takes: a note keeps no outline, a picture nothing. */
  const restyle = ({ stroke, fill, strokeWidth }: { stroke?: unknown; fill?: unknown; strokeWidth?: unknown }) => {
    if (!core.editable()) {
      return;
    }

    const width = Number(strokeWidth);
    const chosen = core.selected();
    const changes = chosen.map(element => {
      let next = element;
      if (isOneOf(STROKES, stroke) && takesStyle(element.type, 'stroke')) {
        next = { ...next, stroke };
      }

      // Paper is never nothing: a note or a pile keeps its colour when "no fill" is picked for a mixed selection.
      const paper = element.type === 'sticky' || element.type === 'stack';
      if (isOneOf(FILLS, fill) && takesStyle(element.type, 'fill') && !(paper && fill === 'none')) {
        next = { ...next, fill };
      }

      if (isOneOf(STROKE_WIDTHS, width) && takesStyle(element.type, 'strokeWidth')) {
        next = core.measured({ ...next, strokeWidth: width });
      }

      return next;
    });
    core.commit(changes.filter((next, index) => next !== chosen[index]));
    core.reportSelection();
  };

  const restack = (toFront: boolean): void => {
    const chosen = core.selected().sort(byZ);
    const start = toFront ? scene.topZ + 1 : scene.bottomZ - chosen.length;
    core.commit(chosen.map((element, index) => ({ ...element, z: start + index })));
  };

  const duplicate = (): void => {
    const top = scene.topZ;
    // A copy of a group is a group of its own: the copies must not be picked up with the originals.
    const groups = new Map<string, string>();
    const chosen = core.selected().sort(byZ);
    // A connector copied with what it connects connects the copies; copied alone, it lets go.
    const ids = new Map(chosen.map(element => [element.id, newId()]));
    const rebind = (binding: Binding | undefined): Binding | undefined => {
      const id = binding ? ids.get(binding.id) : undefined;

      return binding && id ? { ...binding, id } : undefined;
    };
    const copies = chosen.map((element, index) => {
      const group = element.group === undefined ? undefined : (groups.get(element.group) ?? newId());
      if (element.group !== undefined && group !== undefined) {
        groups.set(element.group, group);
      }

      const { start: _start, end: _end, ...rest } = element;
      const [start, end] = [rebind(element.start), rebind(element.end)];

      return {
        ...rest,
        id: ids.get(element.id) ?? newId(),
        x: element.x + 16,
        y: element.y + 16,
        z: top + 1 + index,
        version: 0,
        ...(group === undefined ? {} : { group }),
        ...(start ? { start } : {}),
        ...(end ? { end } : {})
      };
    });
    core.commit(copies);
    core.setSelection(copies.map(element => element.id));
  };

  return {
    setProps: (next: ControllerProps): void => {
      const toolChanged = next.tool !== state.props.tool;
      const modeChanged = next.mode !== state.props.mode;
      state.props = next;
      canvas.style.cursor = core.restCursor();
      if ((toolChanged && next.tool !== 'select') || (modeChanged && !core.editable())) {
        core.setSelection([]);
      }

      core.invalidate();
    },

    /** The scheme changed: every colour is read again, and every drawing made in the old ones is stale. */
    repaint: (): void => {
      state.palette = readPalette(host);
      core.reportEditor();
      core.invalidate();
    },

    /** The board as the server holds it. Another board starts over; the same board is merged into. */
    load: (id: string, elements: readonly unknown[]): void => {
      const parsed = elements.map(parseElement).filter(isDefined);
      if (id !== state.boardId) {
        state.boardId = id;
        scene.reset(parsed);
        selection.clear();
        draft.clear();
        remotes.clear();
        state.editing = undefined;
        state.fitPending = !state.size.width;
        if (state.size.width) {
          core.fit();
        }
      } else {
        scene.confirm(parsed);
        if (!core.present()) {
          core.fit();
        }
      }

      core.invalidate();
    },

    /** The server's announcement of a commit — anyone's, this page's included. */
    confirm: (elements: unknown): void => {
      if (!Array.isArray(elements)) {
        return;
      }

      scene.confirm(elements.map(parseElement).filter(isDefined));
      core.invalidate();
    },

    /** An element as it is drawn right now — for whoever moves it next from where it is. */
    elementOf: (id: string): BoardElement | undefined => core.current().get(id),

    /** The version this page holds of an element, a removed one included: what a change to it must be newer than. */
    versionOf: (id: string): number => scene.element(id)?.version ?? 0,

    remotePointer: (from: string, data: unknown): void => {
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const heard = remotes.hear(from, data);
      if (heard.laserAt) {
        effects.trail(from, heard.laserAt);
      }

      if (heard.view && state.following === from) {
        core.showView(heard.view);
      }

      core.invalidate();
    },

    setMembers: (next: Map<string, Collaborator>): void => {
      state.members = next;
      remotes.keepOnly(from => next.has(from));
      // Somebody followed who left: there is nothing to follow.
      if (state.following && !next.has(state.following)) {
        core.stopFollowing();
      }

      core.invalidate();
    },

    /** What is being typed, as it is typed — drawn nowhere but the field, and sent to the room as a draft. */
    typeText: (text: string): void => {
      const element = state.editing ? draft.get(state.editing) : undefined;
      if (element) {
        draft.set(element.id, core.measured({ ...element, text }));
        core.reportPointer(false);
        core.reportEditor();
      }
    },

    finishEditing: core.finishEditing,
    undo: whenEditable(() => core.send(scene.undo())),
    redo: whenEditable(() => core.send(scene.redo())),
    deleteSelection: whenEditable(() => {
      // The arrows fixed to what goes stay, let go where they are drawn.
      const removed = core.selected();
      core.commit([
        ...removed.map(element => ({ ...element, deleted: true })),
        ...releasedFrom(core.displayed(), new Set(removed.map(element => element.id)))
      ]);
      core.setSelection([]);
    }),
    selectAll: whenEditable(() => core.setSelection(scene.visible().map(element => element.id))),
    duplicate: whenEditable(duplicate),
    /** One group of everything selected — groups inside it included: there is one level. */
    group: whenEditable(() => {
      const chosen = core.selected();
      if (chosen.length < 2) {
        return;
      }

      const group = newId();
      state.insideGroup = undefined;
      core.commit(chosen.map(element => ({ ...element, group })));
      core.reportSelection();
    }),
    ungroup: whenEditable(() => {
      state.insideGroup = undefined;
      // `group` is left out of each element — present with `undefined` in it, it would still be sent as a key.
      core.commit(
        core
          .selected()
          .filter(element => element.group !== undefined)
          .map(({ group, ...element }) => element)
      );
      core.reportSelection();
    }),
    deselect: (): void => {
      carry.end();
      core.finishEditing();
      core.setSelection([]);
    },

    /** A sticky taken off the pad, in `fill`'s paper: dragged onto the board, or clicked and then placed. */
    carry: carry.start,

    /** Show what a member shows, and keep showing it as they move — until this person touches the board. */
    follow: ({ from }: { from?: unknown }): void => {
      if (typeof from !== 'string' || !state.members.has(from)) {
        return;
      }

      state.following = from;
      emit({ type: 'follow', name: state.members.get(from)?.name ?? '' });
      const view = remotes.viewOf(from);
      if (view) {
        core.showView(view);
      }
    },
    unfollow: core.stopFollowing,

    /** A reaction, floating up where this person points — or mid-view — for everyone on the board. */
    react: ({ emoji }: { emoji?: unknown }): void => {
      if (!isReaction(emoji) || !core.present()) {
        return;
      }

      const point = core.aim();
      effects.react(emoji, point);
      emit({ type: 'reaction', reaction: { emoji, x: Math.round(point[0]), y: Math.round(point[1]) } });
      core.invalidate();
    },

    /** The server kept the picture: the element that shows it is committed, naming the asset. */
    placeImage: ({ id, asset }: { id?: unknown; asset?: unknown }): void => {
      const element = typeof id === 'string' ? draft.get(id) : undefined;
      if (!element || typeof asset !== 'string' || !asset) {
        return;
      }

      pictures.place(element.id, asset);
      draft.delete(element.id);
      core.commit([{ ...element, asset }]);
      core.setSelection([element.id]);
    },

    /** The server refused the picture: it goes, from this screen as from every other. */
    cancelImage: ({ id }: { id?: unknown }): void => {
      if (typeof id === 'string') {
        pictures.drop(id);
        draft.delete(id);
        core.invalidate();
      }
    },

    /** A vote for the one element selected, or back from it. */
    vote: whenEditable(() => {
      const chosen = core.selected();
      if (chosen.length === 1 && !isLinear(chosen[0].type)) {
        emit({ type: 'vote', id: chosen[0].id });
      }
    }),

    /** Opens the chat field where this person points: what they type shows at their cursor, on every screen. */
    chat: (): void => {
      if (!core.present() || state.editing) {
        return;
      }

      const [x, y] = toScreen(state.camera, ...core.aim());
      state.chatting = '';
      emit({ type: 'chat', at: { left: x, top: y } });
    },

    typeChat: (text: string): void => {
      if (state.chatting !== undefined) {
        state.chatting = text.slice(0, 160);
        core.reportPointer(false);
      }
    },

    closeChat: (): void => {
      if (state.chatting === undefined) {
        return;
      }

      // Said once more as empty: the others let the words fade rather than cutting them off.
      state.chatting = '';
      core.reportPointer(true);
      state.chatting = undefined;
      emit({ type: 'chat', at: undefined });
    },

    /** Everyone on the board, brought to what this person is looking at. */
    summon: (): void => {
      emit({ type: 'summon', view: core.viewOf(core.viewport()) });
    },

    remoteSummon: (from: string, data: unknown): void => {
      const view = typeof data === 'object' && data !== null && 'view' in data ? data.view : undefined;
      if (!isView(view)) {
        return;
      }

      core.stopFollowing();
      core.showView(view);
      emit({ type: 'summoned', name: state.members.get(from)?.name ?? 'Someone' });
    },

    remoteReaction: (data: unknown): void => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'emoji' in data &&
        isReaction(data.emoji) &&
        'x' in data &&
        'y' in data &&
        isPoint([data.x, data.y])
      ) {
        const at: Point = [Number(data.x), Number(data.y)];
        effects.react(data.emoji, at);
        core.invalidate();
      }
    },
    bringToFront: whenEditable(() => restack(true)),
    sendToBack: whenEditable(() => restack(false)),
    applyStyle: restyle,
    zoomIn: (): void => zoomBy(1.25),
    zoomOut: (): void => zoomBy(1 / 1.25),
    zoomReset: (): void => core.setCamera(zoomAt(state.camera, state.size.width / 2, state.size.height / 2, 1)),
    zoomToFit: core.fit,
    exportPng: (): void => exportPng(scene.visible(), state.palette, state.props.title),
    rollback: (): void => {
      scene.rollback();
      draft.clear();
      state.editing = undefined;
      emit({ type: 'editor', editor: undefined });
      core.setSelection([...selection].filter(id => !(scene.element(id)?.deleted ?? true)));
    },
    destroy: (): void => {
      carry.end();
      core.cancelFrame();
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', pointer.onPointerDown);
      canvas.removeEventListener('pointermove', pointer.onPointerMove);
      canvas.removeEventListener('pointerup', pointer.onPointerUp);
      canvas.removeEventListener('pointercancel', pointer.onPointerUp);
      canvas.removeEventListener('pointerleave', pointer.onPointerLeave);
      canvas.removeEventListener('dblclick', pointer.onDoubleClick);
      canvas.removeEventListener('wheel', pointer.onWheel);
      canvas.removeEventListener('dragover', input.onDragOver);
      canvas.removeEventListener('drop', input.onDrop);
      window.removeEventListener('paste', input.onPaste);
      window.removeEventListener('keydown', input.onKeyDown);
      window.removeEventListener('keyup', input.onKeyUp);
    }
  };
};

export type BoardController = ReturnType<typeof createBoardController>;
