import { ANCHORS, isConnectable } from '../../board/model.ts';
import { endsOf } from './connectors.ts';
import {
  createRenderer,
  drawCursor,
  drawDots,
  drawDropTarget,
  drawHandles,
  drawMarquee,
  drawOutline,
  drawPoints
} from './draw.ts';
import { anchorPoint, beyondAnchor, boundsOf, boxFrom, toScreen, unionOf } from './geometry.ts';
import { CONNECT_OFFSET } from './picking.ts';

import type { Core } from './core.ts';
import type { Effects } from './effects.ts';
import type { Box } from './geometry.ts';
import type { BoardElement } from '../../board/model.ts';
import type { Pictures } from './pictures.ts';

const overlaps = (a: Box, b: Box, margin: number): boolean =>
  a.x - margin < b.x + b.width &&
  a.x + a.width + margin > b.x &&
  a.y - margin < b.y + b.height &&
  a.y + a.height + margin > b.y;

/**
 * One frame: the paper, every element in view, and over them what only this screen shows — selections (this person's
 * and the others'), handles, connection points, laser trails, reactions, the marquee and the others' cursors.
 */
export const createPainter = (core: Core, effects: Effects, pictures: Pictures) => {
  const { context, state, remotes } = core;
  const renderer = createRenderer(core.canvas);
  let reportedBox = '';
  let reportedThread = '';

  /** The one comment selected, with where its thread opens on screen — told to the page only when it changes. */
  const reportThread = (comment: BoardElement | undefined): void => {
    const [left, top] = comment ? toScreen(state.camera, comment.x + comment.width, comment.y) : [0, 0];
    const thread = comment
      ? {
          id: comment.id,
          author: comment.author ?? 'Someone',
          text: comment.text ?? '',
          done: comment.done === true,
          replies: comment.replies ?? [],
          left: Math.round(left + 10),
          top: Math.round(top)
        }
      : undefined;
    const key = JSON.stringify(thread ?? null);
    if (key !== reportedThread) {
      reportedThread = key;
      core.emit({ type: 'thread', thread });
    }
  };

  const colourOf = (from: string): string =>
    state.palette.collab[state.members.get(from)?.color ?? ''] ?? state.palette.accent;

  /** Where the selection is on screen, told to the page only when it changes. */
  const reportBox = (box: Box | undefined): void => {
    const [left, top] = box ? toScreen(state.camera, box.x, box.y) : [0, 0];
    const screen = box
      ? {
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(box.width * state.camera.zoom),
          height: Math.round(box.height * state.camera.zoom)
        }
      : undefined;
    const key = JSON.stringify(screen ?? null);
    if (key !== reportedBox) {
      reportedBox = key;
      core.emit({ type: 'selectionBox', box: screen });
    }
  };

  const paint = (): void => {
    const { width, height, dpr } = state.size;
    if (!width || !height) {
      return;
    }

    const { camera, palette, props, gesture, editing } = state;
    const now = Date.now();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = palette.paper;
    context.fillRect(0, 0, width, height);
    if (core.present()) {
      drawDots(context, camera, width, height, palette.dots);
    }

    const elements = core.displayed(now);
    const view = core.viewport();
    const erased = gesture?.kind === 'erase' ? gesture.erased : undefined;
    context.setTransform(
      dpr * camera.zoom,
      0,
      0,
      dpr * camera.zoom,
      -camera.x * camera.zoom * dpr,
      -camera.y * camera.zoom * dpr
    );
    const members = new Map<string, number>();
    for (const element of elements) {
      if (element.parent) {
        members.set(element.parent, (members.get(element.parent) ?? 0) + 1);
      }
    }

    for (const element of elements) {
      if (overlaps(boundsOf(element), view, 40)) {
        renderer.drawElement(context, element, palette, {
          hideText: element.id === editing,
          faded: erased?.has(element.id) ?? false,
          voter: props.voter,
          members: members.get(element.id) ?? 0,
          authors: props.authors,
          // A comment selected opens its thread beside it (`thread`), not its bubble.
          // A comment being written or selected has its composer or thread beside it instead of its bubble.
          open:
            element.type === 'comment'
              ? element.id === state.pointed && element.id !== editing && !core.selection.has(element.id)
              : element.id === editing || element.id === state.pointed || core.selection.has(element.id),
          ...(element.type === 'image' ? { picture: pictures.of(element, props.assetBase) } : {})
        });
      }
    }

    renderer.prune(new Set(elements.map(element => element.id)));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!core.present()) {
      return;
    }

    const byId = new Map(elements.map(element => [element.id, element]));
    // Where what is dragged would land: the frame lit, and in a column the gap it would take.
    const drop = state.dropTarget ? byId.get(state.dropTarget.frame) : undefined;
    if (drop && state.dropTarget) {
      drawDropTarget(context, camera, boundsOf(drop), palette.accent, state.dropTarget.line);
    }

    for (const [from, remote] of remotes.entries()) {
      for (const id of remote.selection) {
        const element = byId.get(id);
        if (element) {
          drawOutline(context, camera, boundsOf(element), colourOf(from), false);
        }
      }
    }

    // A frame's title bar pointed at: the frame outlined, so it reads as something to take hold of.
    const pointedFrame = state.pointed ? byId.get(state.pointed) : undefined;
    // Only where it can be taken: a board that is looked around is not offered anything to pick up.
    if (pointedFrame?.type === 'frame' && core.editable() && !core.selection.has(pointedFrame.id)) {
      drawOutline(context, camera, boundsOf(pointedFrame), palette.accent, false);
    }

    const chosen = core.selected();
    for (const element of chosen) {
      drawOutline(context, camera, boundsOf(element), palette.accent, true);
    }

    const selecting = props.tool === 'select' && !editing;
    const box = unionOf(chosen.map(boundsOf));
    const connector = core.soleConnector();
    if (connector && selecting) {
      const { start, end } = endsOf(connector);
      drawPoints(context, camera, [start, end], palette.accent);
    } else if (box && selecting && (!gesture || gesture.kind === 'resize')) {
      drawHandles(context, camera, box, palette.accent);
    }

    // Where a connector can start from, on the shape under the pointer — and where one being drawn will land.
    const { snapping, hovered } = state;
    const target = snapping
      ? byId.get(snapping.id)
      : !gesture && !state.carrying && selecting && hovered
        ? byId.get(hovered)
        : undefined;
    if (target && isConnectable(target.type)) {
      const drawing = gesture?.kind === 'linear' || gesture?.kind === 'endpoint';
      const points = ANCHORS.map(anchor =>
        drawing ? anchorPoint(target, anchor) : beyondAnchor(target, anchor, CONNECT_OFFSET / camera.zoom)
      );
      drawPoints(context, camera, points, palette.accent, snapping ? anchorPoint(target, snapping.anchor) : undefined);
    }

    // A laser trail and a reaction fade on their own clock: keep drawing while any is left.
    if (effects.draw(context, camera, key => (key === 'me' ? palette.laser : colourOf(key)), now)) {
      core.invalidate();
    }

    if (gesture?.kind === 'marquee') {
      drawMarquee(context, camera, boxFrom(gesture.origin, gesture.current), palette.accent);
    }

    for (const [from, remote] of remotes.entries()) {
      const member = state.members.get(from);
      const cursor = member ? remotes.cursorOf(remote, now) : undefined;
      if (member && cursor) {
        const label = member.agent === true ? `✦ ${member.name}` : member.name;
        drawCursor(context, camera, cursor.at, label, colourOf(from), palette.ui, cursor.saying);
      }
    }

    // The selection's tools stand aside while it is being moved, resized or typed into — they would cover the work.
    reportBox(box && selecting && !gesture && !state.pinch ? box : undefined);
    const [sole] = chosen;
    reportThread(
      chosen.length === 1 && sole.type === 'comment' && !editing && !gesture && core.editable() ? sole : undefined
    );
  };

  return { paint };
};
