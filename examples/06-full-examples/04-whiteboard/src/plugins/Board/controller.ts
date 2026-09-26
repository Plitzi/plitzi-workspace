import { createCarry } from './carry.ts';
import { cloneElements } from './clone.ts';
import { releasedFrom } from './connectors.ts';
import { membersOf, readingOrder } from './containers.ts';
import { createCore, DEFAULT_BOX } from './core.ts';
import { createEffects } from './effects.ts';
import { exportPng } from './exporter.ts';
import { boundsOf, fitCamera, toScreen, unionOf, zoomAt } from './geometry.ts';
import { createInput } from './input.ts';
import { createMinimap } from './minimap.ts';
import { readPalette } from './palette.ts';
import { createPicking } from './picking.ts';
import { createPictures } from './pictures.ts';
import { createPointer } from './pointer.ts';
import { createQuick } from './quick.ts';
import { isView } from './remotes.ts';
import { createPainter } from './render.ts';
import { isSound, REACTION_SOUNDS } from './sounds.ts';
import { restyled } from './styling.ts';
import { isDefined, isPoint, newId } from './values.ts';
import { byStacking, fitsInFrame, isLinear, isTask, parseElement } from '../../board/model.ts';
import { isReaction, isStamp, STAMP_SIZE } from '../../board/reactions.ts';

import type { StyleChoice } from './styling.ts';
import type { ControllerEvent, ControllerProps, FrameEntry } from './types.ts';
import type { BoardElement, Point } from '../../board/model.ts';
import type { Collaborator } from '../../board/people.ts';

export { TOOLS } from './types.ts';
export type {
  BoardMode,
  ControllerEvent,
  ControllerProps,
  FrameEntry,
  PresentMessage,
  PointerMessage,
  ScreenBox,
  Stylable,
  TextEditor,
  Thread,
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
/**
 * `canvas` takes the pointer and draws what moves — cursors, selections, the laser; `boardCanvas`, under it, holds the
 * board itself and is painted only when the board changed. Two canvases the browser composites, rather than one the
 * board is copied onto every frame.
 */
export const createBoardController = (
  canvas: HTMLCanvasElement,
  boardCanvas: HTMLCanvasElement,
  host: HTMLElement,
  emit: (event: ControllerEvent) => void
) => {
  const core = createCore(canvas, host, emit);
  const { state, scene, selection, draft, remotes } = core;
  const effects = createEffects();
  const pictures = createPictures(() => core.invalidate());
  const picking = createPicking(core);
  const carry = createCarry(core);
  const quick = createQuick(core);
  const pointer = createPointer(core, picking, carry, effects, quick);
  /** Elements with what rides along with them: the members of any frame among them. */
  const withRiders = (chosen: readonly BoardElement[]): BoardElement[] => {
    const ids = new Set(chosen.map(element => element.id));

    return [
      ...chosen,
      ...core.displayed().filter(element => element.parent && ids.has(element.parent) && !ids.has(element.id))
    ];
  };

  /** The selection removed — and the arrows fixed to it let go where they are drawn, not removed with it. */
  const removeSelection = (): void => {
    const removed = core.changeable();
    if (removed.length) {
      sounds.play('remove');
    }

    core.commit([
      ...removed.map(element => ({ ...element, deleted: true })),
      ...releasedFrom(core.displayed(), new Set(removed.map(element => element.id)))
    ]);
    core.setSelection([]);
  };

  const minimap = createMinimap(core);
  const { sounds } = core;

  /**
   * What the others did that is worth hearing, among what the server just confirmed: a comment left, an answer, a
   * vote, a task ticked off. This page's own — already heard as it happened — is told apart by its pending edit, its
   * vote, its name on the answer.
   */
  const reviewSounds = (incoming: readonly BoardElement[]): void => {
    for (const element of incoming) {
      const known = scene.element(element.id);
      const mine = known !== undefined && known.version === element.version && known.nonce === element.nonce;
      if (mine) {
        continue;
      }

      const replies = element.replies ?? [];
      const votes = element.votes ?? [];
      if (!known && element.type === 'comment' && !element.deleted) {
        sounds.play('comment');
      } else if (
        known &&
        replies.length > (known.replies?.length ?? 0) &&
        replies.at(-1)?.author !== state.props.author
      ) {
        sounds.play('reply');
      } else if (known && votes.length > (known.votes?.length ?? 0) && !votes.includes(state.props.voter)) {
        sounds.play('vote');
      } else if (known && element.done && !known.done) {
        sounds.play(element.type === 'comment' ? 'resolve' : 'done');
      }
    }
  };
  /** Until when a board just opened stays quiet about the people it finds there. */
  let quietUntil = 0;
  /** When each name was last greeted with a chime. */
  const chimedFor = new Map<string, number>();
  const painter = createPainter(core, boardCanvas, effects, pictures);
  let reportedFrames = '';
  /** The board's frames, in the order they are gone through — what the page lists and a presentation shows. */
  const framesInOrder = (): BoardElement[] => readingOrder(scene.visible().filter(element => element.type === 'frame'));
  const reportFrames = (): void => {
    const visible = scene.visible();
    const frames: FrameEntry[] = framesInOrder().map(frame => ({
      id: frame.id,
      title: frame.text?.trim() || 'Frame',
      count: membersOf(visible, frame.id).length
    }));
    const key = JSON.stringify(frames);
    if (key !== reportedFrames) {
      reportedFrames = key;
      emit({ type: 'frames', frames });
    }
  };
  core.paintWith(() => {
    painter.paint();
    minimap.paint();
    reportFrames();
  });
  const input = createInput(core, pictures, pointer, {
    copy: () => {
      const copied = withRiders(core.selected());
      if (copied.length) {
        sounds.play('copy');
      }

      return copied;
    },
    paste: (elements, at) => paste(elements, at),
    remove: () => removeSelection()
  });

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
  window.addEventListener('copy', input.onCopy);
  window.addEventListener('cut', input.onCut);

  const resizeObserver = new ResizeObserver(() => {
    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    state.size = { width: rect.width, height: rect.height, dpr };
    const [width, height] = [Math.round(rect.width * dpr), Math.round(rect.height * dpr)];
    for (const each of [canvas, boardCanvas]) {
      // Only when it changed: setting a canvas's size clears it even to the size it had, and the board's canvas is
      // repainted only when what it shows changes — a size that did not would leave it blank.
      if (each.width !== width || each.height !== height) {
        each.width = width;
        each.height = height;
      }

      each.style.width = `${rect.width}px`;
      each.style.height = `${rect.height}px`;
    }

    if (state.fitPending && rect.width && rect.height) {
      state.fitPending = false;
      core.fit();
    }

    core.invalidate();
  });
  resizeObserver.observe(host);

  // ── What the page asks of it ─────────────────────────────────────────────────────────────────────────────────────

  /** Where the last stamp was aimed and where it ended: the next one, aimed at the same place, goes beside it. */
  let stamping: { aim: Point; right: number } | undefined;

  /** Only on a board that can change, and while nobody types: ⌘Z in a text field is the field's own undo. */

  const whenEditable =
    <Args extends unknown[]>(action: (...args: Args) => void) =>
    (...args: Args): void => {
      if (core.editable() && !state.editing) {
        action(...args);
      }
    };

  const zoomBy = (factor: number): void => {
    core.stopFollowing();
    core.setCamera(zoomAt(state.camera, state.size.width / 2, state.size.height / 2, state.camera.zoom * factor));
  };

  /** The selection restyled — each element with only what it takes: a note keeps no outline, a picture nothing. */
  const restyle = (choice: StyleChoice): void => {
    if (!core.editable()) {
      return;
    }

    const chosen = core.changeable();
    const changes = chosen.map(element => {
      const next = restyled(element, choice);

      return next.strokeWidth === element.strokeWidth ? next : core.measured(next);
    });
    const changed = changes.filter((next, index) => JSON.stringify(next) !== JSON.stringify(chosen[index]));
    if (changed.length) {
      sounds.play('style');
    }

    core.commit(changed);
    core.reportSelection();
  };

  const restack = (toFront: boolean): void => {
    const chosen = core.changeable().sort(byStacking);
    const start = toFront ? scene.topZ + 1 : scene.bottomZ - chosen.length;
    sounds.play('layer');
    core.commit(chosen.map((element, index) => ({ ...element, z: start + index })));
  };

  /**
   * One step up or down the stack: the selection swaps places with the next thing it overlaps that way — the layer
   * it is actually over or under — rather than with something across the board.
   */
  const shift = (up: boolean): void => {
    const chosen = core.changeable();
    const ids = new Set(chosen.map(element => element.id));
    const box = unionOf(chosen.map(boundsOf));
    if (!box) {
      return;
    }

    const overlapping = (other: BoardElement): boolean => {
      const b = boundsOf(other);

      return b.x < box.x + box.width && b.x + b.width > box.x && b.y < box.y + box.height && b.y + b.height > box.y;
    };
    const [top, bottom] = [
      Math.max(...chosen.map(element => element.z)),
      Math.min(...chosen.map(element => element.z))
    ];
    const others = core
      .displayed()
      .filter(element => !ids.has(element.id) && element.type !== 'frame' && overlapping(element));
    const neighbour = up
      ? others.filter(element => element.z > top).sort(byStacking)[0]
      : others
          .filter(element => element.z < bottom)
          .sort(byStacking)
          .at(-1);
    if (!neighbour) {
      return;
    }

    const offset = up ? neighbour.z - bottom + 1 : neighbour.z - top - 1;
    sounds.play('layer');
    core.commit(chosen.map(element => ({ ...element, z: element.z + offset })));
  };

  /** The selection copied beside itself — a frame with what is in it. */
  const duplicate = (): void => {
    const chosen = core.selected();
    const copies = cloneElements(withRiders(chosen), { dx: 16, dy: 16, topZ: scene.topZ, keepFrame: true });
    sounds.play('place');
    core.commit(copies);
    core.setSelection(copies.slice(0, chosen.length).map(copy => copy.id));
  };

  /** Elements from the clipboard — this board's or another's — centred where this person points, all of them new. */
  const paste = (elements: readonly BoardElement[], at: Point | undefined): void => {
    const box = unionOf(elements.map(boundsOf));
    if (!box || !core.editable()) {
      return;
    }

    const [cx, cy] = at ?? core.aim();
    const copies = cloneElements(elements, {
      dx: cx - (box.x + box.width / 2),
      dy: cy - (box.y + box.height / 2),
      topZ: scene.topZ,
      keepFrame: false
    });
    sounds.play('place');
    core.commit(copies);
    core.setSelection(copies.map(copy => copy.id));
  };

  /** What is selected, in a tidy grid — reading order kept, each in the middle of its cell. */
  const tidy = (): void => {
    const chosen = core.changeable().filter(element => fitsInFrame(element.type));
    if (chosen.length < 2) {
      return;
    }

    const cellWidth = Math.max(...chosen.map(element => element.width));
    const cellHeight = Math.max(...chosen.map(element => element.height));
    const columns = Math.ceil(Math.sqrt(chosen.length));
    const [left, top] = [Math.min(...chosen.map(element => element.x)), Math.min(...chosen.map(element => element.y))];
    sounds.play('tidy');
    const ordered = [...chosen].sort(
      (a, b) => Math.round((a.y - top) / cellHeight) - Math.round((b.y - top) / cellHeight) || a.x - b.x
    );
    core.commit(
      ordered.map((element, index) => ({
        ...element,
        x: left + (index % columns) * (cellWidth + 24) + (cellWidth - element.width) / 2,
        y: top + Math.floor(index / columns) * (cellHeight + 24) + (cellHeight - element.height) / 2
      }))
    );
  };

  /** A frame, whole in view — eased there, so where it is on the board is seen on the way. */
  const showFrame = (frame: BoardElement): void => {
    core.stopFollowing();
    core.glideTo(fitCamera(boundsOf(frame), state.size.width, state.size.height, 56));
  };

  /** Where this person is in the presentation they give — `undefined` while they give none. */
  let presenting: number | undefined;

  const presentAt = (index: number): void => {
    const frames = framesInOrder();
    const frame = frames[index] as BoardElement | undefined;
    if (!frame) {
      return;
    }

    sounds.play(presenting === undefined ? 'presentStart' : 'present');
    presenting = index;
    showFrame(frame);
    const title = frame.text?.trim() || 'Frame';
    emit({
      type: 'present',
      message: { view: core.viewOf(boundsOf(frame)), index, total: frames.length, title }
    });
    emit({ type: 'presentation', presenter: 'You', index, total: frames.length, title, mine: true });
  };

  const stopPresenting = (): void => {
    if (presenting === undefined) {
      return;
    }

    sounds.play('presentEnd');
    presenting = undefined;
    emit({ type: 'present', message: { view: core.viewOf(core.viewport()), index: -1, total: 0, title: '' } });
    emit({ type: 'presentation', presenter: '', index: -1, total: 0, title: '', mine: true });
  };

  /** An arrow key: the next or previous frame while presenting; otherwise the selection nudged — ten with Shift. */
  const step = ({ direction, far }: { direction?: unknown; far?: unknown }): void => {
    if (presenting !== undefined) {
      if (direction === 'right' || direction === 'down') {
        presentAt(Math.min(presenting + 1, framesInOrder().length - 1));
      } else if (direction === 'left' || direction === 'up') {
        presentAt(Math.max(presenting - 1, 0));
      }

      return;
    }

    const distance = far === true || far === 'true' ? 10 : 1;
    const offsets: Record<string, [number, number]> = {
      left: [-distance, 0],
      right: [distance, 0],
      up: [0, -distance],
      down: [0, distance]
    };
    const offset = typeof direction === 'string' ? offsets[direction] : undefined;
    const chosen = core.changeable();
    if (!offset || !chosen.length || !core.editable() || state.editing) {
      return;
    }

    core.commit(
      withRiders(chosen).map(element => ({ ...element, x: element.x + offset[0], y: element.y + offset[1] }))
    );
  };

  return {
    setProps: (next: ControllerProps): void => {
      sounds.setEnabled(next.sounds);
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

        // Nothing is selected on a board just shown — said, so the page's panels do not keep the last board's.
        core.reportSelection();
        quietUntil = Date.now() + 3000;
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

      const parsed = elements.map(parseElement).filter(isDefined);
      reviewSounds(parsed);
      scene.confirm(parsed);
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
      // Somebody new: a chime — but not for whoever was already here, whom the room names as a board opens, nor twice
      // for one person, whose page may reconnect under a new name as it opens its channels.
      const now = Date.now();
      const arrived = [...next.entries()].filter(([from, member]) => {
        const fresh = !state.members.has(from) && now - (chimedFor.get(member.name) ?? 0) > 10_000;
        if (fresh) {
          chimedFor.set(member.name, now);
        }

        return fresh;
      });
      if (now > quietUntil && arrived.length) {
        sounds.play('join');
      } else if (
        [...state.members.values()].some(member => ![...next.values()].some(kept => kept.name === member.name))
      ) {
        sounds.play('leave');
      }

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

    finishEditing: (): void => core.finishEditing(),
    /** A comment posted — its button, or Enter. */
    postEditing: (): void => core.finishEditing(true),
    cancelEditing: core.cancelEditing,
    undo: whenEditable(() => {
      sounds.play('undo');
      core.send(scene.undo());
    }),
    redo: whenEditable(() => {
      sounds.play('undo');
      core.send(scene.redo());
    }),
    deleteSelection: whenEditable(removeSelection),
    // What is locked stays out: selecting everything is how a board is moved or cleared, and a locked element is not.
    selectAll: whenEditable(() =>
      core.setSelection(scene.visible().flatMap(element => (element.locked ? [] : [element.id])))
    ),
    duplicate: whenEditable(duplicate),
    /** One group of everything selected — groups inside it included: there is one level. */
    group: whenEditable(() => {
      const chosen = core.changeable();
      if (chosen.length < 2) {
        return;
      }

      const group = newId();
      sounds.play('group');
      state.insideGroup = undefined;
      core.commit(chosen.map(element => ({ ...element, group })));
      core.reportSelection();
    }),
    ungroup: whenEditable(() => {
      sounds.play('undo');
      state.insideGroup = undefined;
      // `group` is left out of each element — present with `undefined` in it, it would still be sent as a key.
      core.commit(
        core
          .changeable()
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
      sounds.play('follow');
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
      sounds.play(REACTION_SOUNDS[emoji]);
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
      sounds.play('place');
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
        sounds.play('vote');
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
      sounds.play('summon');
      emit({ type: 'summon', view: core.viewOf(core.viewport()) });
    },

    remoteSummon: (from: string, data: unknown): void => {
      const view = typeof data === 'object' && data !== null && 'view' in data ? data.view : undefined;
      if (!isView(view)) {
        return;
      }

      core.stopFollowing();
      core.showView(view);
      sounds.play('summon');
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
        sounds.play(REACTION_SOUNDS[data.emoji]);
        core.invalidate();
      }
    },
    tidy: whenEditable(tidy),
    /** A kanban board where this person points: three columns, ready for cards. */
    /**
     * A stamp put down where this person points: a text holding the emoji, centred there. Stamped again without the
     * pointer moving, the next goes beside the last — a row of verdicts, not a pile of them.
     */
    stamp: whenEditable(({ emoji }: { emoji?: unknown }) => {
      if (!isStamp(emoji)) {
        return;
      }

      const [x, y] = core.aim();
      const again = stamping && stamping.aim[0] === x && stamping.aim[1] === y;
      const left = again && stamping ? stamping.right + STAMP_SIZE * 0.15 : x - STAMP_SIZE / 2;
      stamping = { aim: [x, y], right: left + STAMP_SIZE };
      sounds.play('place');
      core.commit([
        {
          ...core.newElement('stamp', [left, y - STAMP_SIZE / 2]),
          width: STAMP_SIZE,
          height: STAMP_SIZE,
          text: emoji
        }
      ]);
    }),
    insertKanban: whenEditable(() => {
      const [x, y] = core.aim();
      const { width, height } = DEFAULT_BOX.column;
      const columns = ['To do', 'Doing', 'Done'].map((title, index) => ({
        ...core.newElement('frame', [x - (width * 3 + 40) / 2 + index * (width + 20), y - height / 2]),
        width,
        height,
        text: title,
        layout: 'column' as const,
        z: scene.topZ + 1 + index
      }));
      sounds.play('place');
      core.commit(columns);
      core.setSelection(columns.map(column => column.id));
    }),
    /** Another column beside the one selected — the same size, its title ready to be typed. */
    addColumn: whenEditable(() => {
      const [lane] = core.selected();
      if (core.selected().length !== 1 || lane.type !== 'frame') {
        return;
      }

      const next = {
        ...core.newElement('frame', [lane.x + lane.width + 20, lane.y]),
        width: lane.width,
        height: lane.height,
        fill: lane.fill,
        text: '',
        layout: 'column' as const
      };
      // The frames to its right, in the same row, move along to make room — with everything in them.
      const shift = lane.width + 20;
      const beside = core
        .displayed()
        .filter(
          frame =>
            frame.type === 'frame' &&
            frame.id !== lane.id &&
            frame.x >= lane.x + lane.width &&
            frame.y < lane.y + lane.height &&
            frame.y + frame.height > lane.y
        );
      const moved = withRiders(beside).map(element => ({ ...element, x: element.x + shift }));
      sounds.play('place');
      core.commit([...moved, next]);
      core.setSelection([next.id]);
      core.startEditing(scene.element(next.id) ?? next);
    }),
    /** The one card selected ticked done — or the one comment resolved — or back. */
    toggleDone: whenEditable(() => {
      const chosen = core.changeable();
      const [task] = chosen;
      if (chosen.length !== 1 || !isTask(task.type)) {
        return;
      }

      const { done: _done, ...rest } = task;
      core.commit([task.done ? rest : { ...rest, done: true }]);
      sounds.play(task.done ? 'undone' : task.type === 'comment' ? 'resolve' : 'done');
      core.reportSelection();
    }),
    /**
     * The selection locked in place — or, all of it locked already, let go. The one edit a locked element takes, so it
     * acts on the whole selection rather than on what may change.
     */
    toggleLock: whenEditable(() => {
      const chosen = core.selected();
      if (!chosen.length) {
        return;
      }

      const unlock = chosen.every(element => element.locked === true);
      core.commit(
        chosen.map(element => {
          const { locked: _locked, ...rest } = element;

          return unlock ? rest : { ...rest, locked: true };
        })
      );
      sounds.play('lock');
      core.reportSelection();
    }),
    /** The one frame selected, made a column — which lays out what is in it — or a free area again. */
    toggleColumn: whenEditable(() => {
      const frame = core.changeable().at(0);
      if (frame?.type !== 'frame' || core.changeable().length !== 1) {
        return;
      }

      const { layout: _layout, ...free } = frame;
      sounds.play('snap');
      core.commit([frame.layout === 'column' ? free : { ...free, layout: 'column' }]);
      core.reportSelection();
    }),
    goToFrame: ({ id }: { id?: unknown }): void => {
      const frame = typeof id === 'string' ? core.current().get(id) : undefined;
      if (frame?.type === 'frame') {
        showFrame(frame);
      }
    },
    /** A presentation of the board's frames, from the first — or from the one selected — for everyone on the board. */
    present: (): void => {
      const frames = framesInOrder();
      const chosen = core.selected().at(0);
      const from = frames.findIndex(frame => frame.id === chosen?.id || frame.id === chosen?.parent);
      core.setSelection([]);
      presentAt(Math.max(from, 0));
    },
    stopPresenting,
    step,
    /** Somebody presents: this page shows where they are, and says who it is and how far along. */
    remotePresent: (from: string, data: unknown): void => {
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const index = 'index' in data && typeof data.index === 'number' ? data.index : -1;
      const total = 'total' in data && typeof data.total === 'number' ? data.total : 0;
      const title = 'title' in data && typeof data.title === 'string' ? data.title.slice(0, 80) : '';
      const view = 'view' in data && isView(data.view) ? data.view : undefined;
      const presenter = index < 0 ? '' : (state.members.get(from)?.name ?? 'Someone');
      if (index < 0) {
        sounds.play('presentEnd');
      }

      if (view && index >= 0) {
        sounds.play(index === 0 ? 'presentStart' : 'present');
        core.stopFollowing();
        const [x, y, width, height] = view;
        core.glideTo(fitCamera({ x, y, width, height }, state.size.width, state.size.height, 56));
      }

      emit({ type: 'presentation', presenter, index, total, title, mine: false });
    },
    /** A cue the page asks for — a line in the chat, the timer running out. */
    chime: ({ sound }: { sound?: unknown }): void => {
      if (isSound(sound)) {
        sounds.play(sound);
      }
    },
    /** The minimap's canvas, or none: drawn with the board, and a click or drag on it moves the view there. */
    attachMinimap: minimap.attach,
    bringForward: whenEditable(() => shift(true)),
    sendBackward: whenEditable(() => shift(false)),
    bringToFront: whenEditable(() => restack(true)),
    sendToBack: whenEditable(() => restack(false)),
    applyStyle: restyle,
    zoomIn: (): void => zoomBy(1.25),
    zoomOut: (): void => zoomBy(1 / 1.25),
    zoomReset: (): void => core.setCamera(zoomAt(state.camera, state.size.width / 2, state.size.height / 2, 1)),
    zoomToFit: core.fit,
    exportPng: (): void => {
      sounds.play('camera');
      exportPng(scene.visible(), state.palette, state.props.title);
    },
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
      window.removeEventListener('copy', input.onCopy);
      window.removeEventListener('cut', input.onCut);
      minimap.attach(undefined);
      sounds.close();
    }
  };
};

export type BoardController = ReturnType<typeof createBoardController>;
