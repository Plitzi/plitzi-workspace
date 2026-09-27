import { EMOJI_FONT } from './draw.ts';
import { toScreen } from './geometry.ts';

import type { Camera } from './geometry.ts';
import type { Point } from '../../board/model.ts';

/**
 * What passes over a board and leaves nothing on it: a laser's trail, a reaction floating up. Kept here, apart from
 * the scene — none of it is an element, none of it is saved, and all of it fades on its own clock.
 */

type TrailPoint = { point: Point; at: number };

type Reaction = { emoji: string; point: Point; at: number; drift: number };

/** How long a laser's trail lingers behind the pointer. */
const TRAIL_MS = 900;

/** How long a reaction floats before it is gone. */
const REACTION_MS = 2400;

/** A trail longer than this is drawing a scribble nobody can follow. */
const TRAIL_POINTS = 90;

export type Effects = ReturnType<typeof createEffects>;

export const createEffects = () => {
  const trails = new Map<string, TrailPoint[]>();
  let reactions: Reaction[] = [];

  const drawTrails = (
    context: CanvasRenderingContext2D,
    camera: Camera,
    colourOf: (key: string) => string,
    now: number
  ) => {
    let active = false;
    for (const [key, trail] of trails) {
      const alive = trail.filter(entry => now - entry.at < TRAIL_MS);
      if (!alive.length) {
        trails.delete(key);
        continue;
      }

      trails.set(key, alive);
      active = true;
      context.save();
      context.strokeStyle = colourOf(key);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.shadowColor = colourOf(key);
      context.shadowBlur = 10;
      // Each segment as old as its newer end: the trail thins and fades towards its tail.
      for (let index = 1; index < alive.length; index += 1) {
        const life = 1 - (now - alive[index].at) / TRAIL_MS;
        const [ax, ay] = toScreen(camera, ...alive[index - 1].point);
        const [bx, by] = toScreen(camera, ...alive[index].point);
        context.globalAlpha = Math.max(0, life);
        context.lineWidth = 1 + 5 * life;
        context.beginPath();
        context.moveTo(ax, ay);
        context.lineTo(bx, by);
        context.stroke();
      }

      const head = alive[alive.length - 1];
      const [hx, hy] = toScreen(camera, ...head.point);
      context.globalAlpha = Math.max(0, 1 - (now - head.at) / TRAIL_MS);
      context.fillStyle = colourOf(key);
      context.beginPath();
      context.arc(hx, hy, 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    return active;
  };

  const drawReactions = (context: CanvasRenderingContext2D, camera: Camera, now: number) => {
    reactions = reactions.filter(entry => now - entry.at < REACTION_MS);
    for (const entry of reactions) {
      const age = (now - entry.at) / REACTION_MS;
      const [x, y] = toScreen(camera, ...entry.point);
      // A pop, a rise, and a quick fade at the very end — full colour for nearly all of it, with a shadow that keeps it
      // readable over any drawing.
      const scale = Math.min(1, age * 8) * (1 + 0.15 * Math.sin(Math.min(1, age * 8) * Math.PI));
      context.save();
      context.globalAlpha = age < 0.82 ? 1 : Math.max(0, (1 - age) / 0.18);
      context.shadowColor = 'rgba(0, 0, 0, 0.28)';
      context.shadowBlur = 8;
      context.shadowOffsetY = 2;
      context.font = `${Math.round(40 * scale)}px ${EMOJI_FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      // Opaque, whatever was drawn last: a colour emoji is painted with the fill's alpha, and the board's faint grid
      // colour left it a ghost of itself.
      context.fillStyle = '#000000';
      context.fillText(entry.emoji, x + entry.drift * age * 40, y - age * 90);
      context.restore();
    }

    return reactions.length > 0;
  };

  return {
    /** One more point of `key`'s laser — this page's own is `me`, everyone else's is their name on the room. */
    trail: (key: string, point: Point, at = Date.now()): void => {
      const trail = trails.get(key) ?? [];
      trail.push({ point, at });
      trails.set(key, trail.slice(-TRAIL_POINTS));
    },

    react: (emoji: string, point: Point, at = Date.now()): void => {
      reactions.push({ emoji, point, at, drift: Math.random() * 2 - 1 });
    },

    /** Draws everything still fading, in screen space. Answers whether anything is left to animate. */
    draw: (
      context: CanvasRenderingContext2D,
      camera: Camera,
      colourOf: (key: string) => string,
      now = Date.now()
    ): boolean => {
      const trailing = drawTrails(context, camera, colourOf, now);
      const floating = drawReactions(context, camera, now);

      return trailing || floating;
    }
  };
};
