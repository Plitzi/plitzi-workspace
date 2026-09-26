import { absolutePoints, boundsOf, unionOf } from './geometry.ts';
import { isLinear } from '../../board/model.ts';

import type { Core } from './core.ts';
import type { Box } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { Point } from '../../board/model.ts';

/**
 * The whole board in a corner: everything on it as small shapes, where this page is looking, and where everyone else
 * is — their views outlined and their pointers as dots, in their colours. A click or a drag on it takes the view
 * there, which is how somebody lost on a big board finds the others.
 */
export const createMinimap = (core: Core) => {
  const { state, scene, remotes } = core;
  let canvas: HTMLCanvasElement | undefined;
  /** Board to minimap: the board box shown, and how many minimap pixels a board unit is. */
  let mapping: { world: Box; scale: number; left: number; top: number } | undefined;
  let dragging = false;
  /** The minimap's size on the page, told by the browser when it changes — never asked for in a frame. */
  let size = { width: 0, height: 0 };
  const observer = new ResizeObserver(entries => {
    const entry = entries.at(0);
    if (entry) {
      size = { width: entry.contentRect.width, height: entry.contentRect.height };
      core.invalidate();
    }
  });
  /**
   * Every element, drawn small, on a canvas of its own: drawn again only when the board or the part of it shown
   * changed. A frame copies it and draws where everyone is looking over it — the minimap redrew four thousand elements
   * at every frame of a cursor moving.
   */
  const shapes = document.createElement('canvas');
  let drawn: { revision: number; palette: Palette; key: string } | undefined;
  let extent: { revision: number; box: Box | undefined } | undefined;

  const toBoard = (event: PointerEvent): Point | undefined => {
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !mapping) {
      return undefined;
    }

    const { world, scale, left, top } = mapping;

    return [world.x + (event.clientX - rect.left - left) / scale, world.y + (event.clientY - rect.top - top) / scale];
  };

  /** The view centred where the minimap was pointed at. */
  const lookAt = (event: PointerEvent): void => {
    const point = toBoard(event);
    if (!point) {
      return;
    }

    const { zoom } = state.camera;
    core.stopFollowing();
    core.setCamera({ x: point[0] - state.size.width / 2 / zoom, y: point[1] - state.size.height / 2 / zoom, zoom });
  };

  const onDown = (event: PointerEvent): void => {
    event.preventDefault();
    dragging = true;
    canvas?.setPointerCapture(event.pointerId);
    lookAt(event);
  };

  const onMove = (event: PointerEvent): void => {
    if (dragging) {
      lookAt(event);
    }
  };

  const onUp = (): void => {
    dragging = false;
  };

  const attach = (next: HTMLCanvasElement | undefined): void => {
    canvas?.removeEventListener('pointerdown', onDown);
    canvas?.removeEventListener('pointermove', onMove);
    canvas?.removeEventListener('pointerup', onUp);
    observer.disconnect();
    canvas = next;
    drawn = undefined;
    if (next) {
      observer.observe(next);
    }

    canvas?.addEventListener('pointerdown', onDown);
    canvas?.addEventListener('pointermove', onMove);
    canvas?.addEventListener('pointerup', onUp);
    core.invalidate();
  };

  const colourOf = (from: string): string =>
    state.palette.collab[state.members.get(from)?.color ?? ''] ?? state.palette.accent;

  /** Every element as a small shape, onto the minimap's own canvas, where `at` and `box` place the board. */
  const drawShapes = (
    pixelWidth: number,
    pixelHeight: number,
    dpr: number,
    at: (x: number, y: number) => Point,
    box: (area: Box) => [number, number, number, number]
  ): void => {
    const context = shapes.getContext('2d');
    if (!context) {
      return;
    }

    const { palette } = state;
    if (shapes.width !== pixelWidth || shapes.height !== pixelHeight) {
      shapes.width = pixelWidth;
      shapes.height = pixelHeight;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const element of scene.visible()) {
      if (isLinear(element.type)) {
        const points = absolutePoints(element);
        context.strokeStyle = palette.stroke[element.stroke];
        context.globalAlpha = 0.6;
        context.lineWidth = 1;
        context.beginPath();
        points.forEach(([px, py], index) => (index ? context.lineTo(...at(px, py)) : context.moveTo(...at(px, py))));
        context.stroke();
        continue;
      }

      const [x, y, width, height] = box(element);
      if (element.type === 'frame') {
        context.globalAlpha = 1;
        context.fillStyle = palette.dots;
        context.fillRect(x, y, width, height);
        continue;
      }

      context.globalAlpha = 0.85;
      context.fillStyle =
        element.type === 'sticky' || element.type === 'stack'
          ? palette.sticky[element.fill]
          : element.type === 'card'
            ? palette.muted
            : element.fill === 'none'
              ? palette.stroke[element.stroke]
              : palette.fill[element.fill];
      context.fillRect(x, y, width, height);
    }

    context.globalAlpha = 1;
  };

  const paint = (): void => {
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    const rect = size;
    const dpr = window.devicePixelRatio || 1;
    if (!rect.width || !rect.height) {
      return;
    }

    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    const { palette } = state;
    const viewport = core.viewport();
    if (extent?.revision !== scene.revision) {
      extent = { revision: scene.revision, box: unionOf(scene.visible().map(boundsOf)) };
    }

    const views = [...remotes.entries()]
      .filter(([from]) => state.members.has(from))
      .map(([from, remote]) => ({ from, remote }));
    const bounds = unionOf([
      viewport,
      ...(extent.box ? [extent.box] : []),
      ...views.flatMap(({ remote }) =>
        remote.view ? [{ x: remote.view[0], y: remote.view[1], width: remote.view[2], height: remote.view[3] }] : []
      )
    ]);
    if (!bounds) {
      return;
    }

    const margin = Math.max(bounds.width, bounds.height) * 0.06;
    const world = {
      x: bounds.x - margin,
      y: bounds.y - margin,
      width: bounds.width + margin * 2,
      height: bounds.height + margin * 2
    };
    const scale = Math.min(rect.width / world.width, rect.height / world.height);
    const left = (rect.width - world.width * scale) / 2;
    const top = (rect.height - world.height * scale) / 2;
    mapping = { world, scale, left, top };
    const at = (x: number, y: number): Point => [left + (x - world.x) * scale, top + (y - world.y) * scale];
    const box = ({ x, y, width, height }: Box): [number, number, number, number] => {
      const [bx, by] = at(x, y);

      return [bx, by, Math.max(1, width * scale), Math.max(1, height * scale)];
    };

    const key = [world.x, world.y, world.width, world.height, canvas.width, canvas.height].join('|');
    if (drawn?.revision !== scene.revision || drawn.palette !== palette || drawn.key !== key) {
      drawn = { revision: scene.revision, palette, key };
      drawShapes(canvas.width, canvas.height, dpr, at, box);
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(shapes, 0, 0);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.globalAlpha = 1;
    context.lineWidth = 1.5;
    for (const { from, remote } of views) {
      const colour = colourOf(from);
      if (remote.view) {
        const [vx, vy, vw, vh] = remote.view;
        context.strokeStyle = colour;
        context.strokeRect(...box({ x: vx, y: vy, width: vw, height: vh }));
      }

      if (remote.cursor) {
        context.fillStyle = colour;
        context.beginPath();
        context.arc(...at(...remote.cursor), 3.5, 0, Math.PI * 2);
        context.fill();
      }
    }

    const [x, y, width, height] = box(viewport);
    context.fillStyle = palette.accent;
    context.globalAlpha = 0.12;
    context.fillRect(x, y, width, height);
    context.globalAlpha = 1;
    context.strokeStyle = palette.accent;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
  };

  return { attach, paint };
};
