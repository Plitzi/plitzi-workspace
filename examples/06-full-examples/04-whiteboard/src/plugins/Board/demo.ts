import { STROKES } from '../../board/model.ts';
import { isCollaborator } from '../../board/people.ts';
import { isReaction } from '../../board/reactions.ts';
import { isOneOf, isPoint } from './values.ts';

import type { BoardController } from './controller.ts';
import type { BoardElement, Point, Stroke } from '../../board/model.ts';
import type { Collaborator } from '../../board/people.ts';

/**
 * Collaborators played from a script, for a board nobody else is on yet: a front page showing what drawing together
 * looks like before anyone has a link to send.
 *
 * They are fed to the canvas exactly as the room would feed real people — presence, pointer messages, reactions, and
 * the server's confirmations of what they changed — so what a visitor sees is the real rendering of the real thing:
 * cursors with names, a shape dragged with its arrows following, words at a cursor, a pen stroke drawn live.
 */

export type DemoStep =
  /** The cursor glides to `to`, arriving `at` milliseconds into the loop. */
  | { at: number; to: Point }
  /** The element with this id is picked up where it is, and follows the cursor until `drop`. */
  | { at: number; grab: string }
  | { at: number; drop: true }
  /** Words at the cursor — `''` puts them away, and they linger a moment as a real person's do. */
  | { at: number; say: string }
  | { at: number; react: string }
  /** A pen stroke in this colour starts at the cursor and follows it; `''` lifts the pen. */
  | { at: number; pen: Stroke | '' }
  /** The cursor is a laser pointer — a trail everyone sees fade — until `false`. */
  | { at: number; laser: boolean };

export type DemoPeer = Collaborator & { steps: DemoStep[] };

export type Demo = { every: number; peers: DemoPeer[] };

const isStep = (value: unknown): value is DemoStep => {
  if (typeof value !== 'object' || value === null || !('at' in value) || typeof value.at !== 'number') {
    return false;
  }

  return (
    ('to' in value && isPoint(value.to)) ||
    ('grab' in value && typeof value.grab === 'string') ||
    ('drop' in value && value.drop === true) ||
    ('say' in value && typeof value.say === 'string') ||
    ('react' in value && isReaction(value.react)) ||
    ('pen' in value && (value.pen === '' || isOneOf(STROKES, value.pen))) ||
    ('laser' in value && typeof value.laser === 'boolean')
  );
};

const isPeer = (value: unknown): value is DemoPeer =>
  isCollaborator(value) &&
  'steps' in value &&
  Array.isArray(value.steps) &&
  value.steps.length > 0 &&
  value.steps.every(isStep);

/** A script as the element is given it — an object from a binding, JSON typed in the builder — or none if malformed. */
export const parseDemo = (value: unknown): Demo | undefined => {
  let parsed = value;
  if (typeof value === 'string') {
    if (!value) {
      return undefined;
    }

    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('every' in parsed) ||
    typeof parsed.every !== 'number' ||
    parsed.every < 1000 ||
    !('peers' in parsed) ||
    !Array.isArray(parsed.peers) ||
    !parsed.peers.every(isPeer)
  ) {
    return undefined;
  }

  return { every: parsed.every, peers: parsed.peers };
};

/** How often a played peer "sends" its pointer: the pace real pages keep. */
const SEND_MS = 50;

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

type Playing = {
  from: string;
  peer: DemoPeer;
  waypoints: { at: number; to: Point }[];
  cursor: Point;
  grabbed?: { element: BoardElement; offset: Point };
  stroke?: BoardElement;
  /** The last stroke drawn, taken away when the next begins: a loop does not pile scribbles up. */
  drawn?: BoardElement;
  saying?: string;
  laser: boolean;
  sentAt: number;
};

/** Where the cursor is at `t`: between the waypoints either side of it, eased — or at the nearest end. */
const cursorAt = (waypoints: readonly { at: number; to: Point }[], t: number): Point => {
  const next = waypoints.findIndex(waypoint => waypoint.at >= t);
  if (next <= 0) {
    return next === 0 ? waypoints[0].to : waypoints[waypoints.length - 1].to;
  }

  const [a, b] = [waypoints[next - 1], waypoints[next]];
  const k = ease((t - a.at) / Math.max(b.at - a.at, 1));

  return [a.to[0] + (b.to[0] - a.to[0]) * k, a.to[1] + (b.to[1] - a.to[1]) * k];
};

/**
 * Plays `demo` on `controller` until the returned function stops it. It stays still for a visitor who asked for less
 * motion, and a hidden tab plays nothing — the frames that drive it are the browser's.
 */
export const playDemo = (controller: BoardController, demo: Demo): (() => void) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => undefined;
  }

  const playing: Playing[] = demo.peers.map((peer, index) => {
    const waypoints = peer.steps.flatMap(step => ('to' in step ? [{ at: step.at, to: step.to }] : []));

    return { from: `demo-${index}`, peer, waypoints, cursor: waypoints[0]?.to ?? [0, 0], laser: false, sentAt: 0 };
  });
  controller.setMembers(new Map(playing.map(({ from, peer }) => [from, { name: peer.name, color: peer.color }])));

  /** What the server would answer: the element as it now is, a version on. */
  const settle = (element: BoardElement): void => {
    controller.confirm([{ ...element, version: Math.max(controller.versionOf(element.id), element.version) + 1 }]);
  };

  const act = (one: Playing, step: DemoStep): void => {
    if ('grab' in step) {
      const element = controller.elementOf(step.grab);
      one.grabbed = element && { element, offset: [element.x - one.cursor[0], element.y - one.cursor[1]] };
    } else if ('drop' in step) {
      const moved = one.grabbed && { ...one.grabbed.element, ...placed(one) };
      one.grabbed = undefined;
      if (moved) {
        settle(moved);
      }
    } else if ('say' in step) {
      one.saying = step.say;
    } else if ('laser' in step) {
      one.laser = step.laser;
    } else if ('react' in step) {
      controller.remoteReaction({ emoji: step.react, x: one.cursor[0], y: one.cursor[1] });
    } else if ('pen' in step) {
      if (one.stroke) {
        settle(one.stroke);
        one.drawn = one.stroke;
        one.stroke = undefined;
      }

      if (step.pen) {
        if (one.drawn) {
          settle({ ...one.drawn, deleted: true });
          one.drawn = undefined;
        }

        const [x, y] = one.cursor;
        one.stroke = {
          id: `${one.from}-pen`,
          type: 'freehand',
          x,
          y,
          width: 0,
          height: 0,
          stroke: step.pen,
          fill: 'none',
          strokeWidth: 2,
          seed: 7,
          z: 10_000,
          version: controller.versionOf(`${one.from}-pen`) + 1,
          nonce: 0,
          deleted: false,
          // A stroke is two points at least: the second is where the pen went down, a hair off the first.
          points: [
            [0, 0],
            [0, 0.5]
          ]
        };
      }
    }
  };

  function placed(one: Playing): Pick<BoardElement, 'x' | 'y'> {
    const offset = one.grabbed?.offset ?? [0, 0];

    return { x: one.cursor[0] + offset[0], y: one.cursor[1] + offset[1] };
  }

  const penTo = (one: Playing): void => {
    const { stroke } = one;
    const points = stroke?.points;
    if (!stroke || !points) {
      return;
    }

    const next: Point = [one.cursor[0] - stroke.x, one.cursor[1] - stroke.y];
    const last = points[points.length - 1];
    if (Math.hypot(next[0] - last[0], next[1] - last[1]) > 2) {
      const all = [...points, next];
      const xs = all.map(([px]) => px);
      const ys = all.map(([, py]) => py);
      one.stroke = {
        ...stroke,
        points: all,
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      };
    }
  };

  let frame = 0;
  let clock = 0;
  let last = performance.now();
  let lastT = 0;
  const tick = (now: number): void => {
    // A tab that was hidden resumes where it left off, not a minute of script later.
    clock += Math.min(now - last, 100);
    last = now;
    const t = clock % demo.every;
    const wrapped = t < lastT;
    for (const one of playing) {
      for (const step of one.peer.steps) {
        const due = wrapped ? step.at > lastT || step.at <= t : step.at > lastT && step.at <= t;
        if (due && !('to' in step)) {
          act(one, step);
        }
      }

      one.cursor = cursorAt(one.waypoints, t);
      penTo(one);
      if (now - one.sentAt >= SEND_MS) {
        one.sentAt = now;
        const dragged = one.grabbed && {
          ...one.grabbed.element,
          ...placed(one),
          version: one.grabbed.element.version + 1
        };
        const drafts = [...(dragged ? [dragged] : []), ...(one.stroke ? [one.stroke] : [])];
        controller.remotePointer(one.from, {
          x: one.cursor[0],
          y: one.cursor[1],
          draft: drafts.length ? drafts : null,
          selection: one.grabbed ? [one.grabbed.element.id] : [],
          ...(one.laser ? { laser: true } : {}),
          ...(one.saying === undefined ? {} : { chat: one.saying })
        });
      }
    }

    lastT = t;
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    controller.setMembers(new Map());
  };
};
