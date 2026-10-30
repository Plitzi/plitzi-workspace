import { createContext } from 'react';

import { STEP_DELAY_S } from './stepDelay';

import type { E2eStep, E2eTest, SpaceTests } from '@plitzi/sdk-shared';

/**
 * The builder's Tests area (RFC 0031): the space's flows beside its page — the canvas, live and in preview, on the left;
 * the flows on the right, each with how it went; the flow chosen below, its steps in words. What is pressed on the
 * right is played on the left: a flow chosen opens on its page and device, a step pressed replays the flow up to it,
 * Record turns what is done on the page into steps.
 *
 * Every play starts as a new visitor would: the canvas drawn again and the state empty. What the author had in state is
 * put back when the area closes.
 */

/** How one step went the last time its flow was played. */
export type StepPlay =
  | { state: 'next' }
  | { state: 'running' }
  | { state: 'passed'; ms: number }
  | { state: 'failed'; read: string }
  | { state: 'notRun' };

/** Where a flow stands: not played yet, waiting its turn, playing, how its last play ended, or one only the server plays. */
export type FlowState =
  | { state: 'idle' }
  | { state: 'queued' }
  | { state: 'playing'; played: number }
  | { state: 'passed'; ms: number; steps: number }
  | { state: 'failed'; read: string; at?: number }
  | { state: 'stopped' }
  | { state: 'server'; why: string };

/** A line of a play's log: when, which flow, the step in words, and whether it held. */
export type PlayLogLine = { at: number; flow: string; text: string; ok: boolean };

export type StudioMode = 'idle' | 'recording' | 'playing';

export type TestStudioValue = {
  /** Whether the Tests area is open: the canvas in it is the one played on. */
  active: boolean;
  /** The space's tests, as last saved — the list the area shows. */
  tests: SpaceTests;
  /** The flow chosen, as edited so far. */
  flow?: E2eTest;
  /** Whether the chosen flow changed since it was chosen or saved. */
  dirty: boolean;
  mode: StudioMode;
  /** Every flow being played in turn, as against one. */
  playingAll: boolean;
  /** Held before its next step: Continue goes on, Next step plays that one step. */
  paused: boolean;
  /** Whether the next click on the page adds a check of what it shows, instead of pressing it. */
  checking: boolean;
  /** How each step of the chosen flow went, the last time it was played. */
  plays: (StepPlay | undefined)[];
  /** Where each flow stands, by id. */
  states: Partial<Record<string, FlowState>>;
  /** The last play's log: every step, when, and whether it held. */
  log: PlayLogLine[];
  /** How the last play ended, in words; none while playing or before the first. */
  outcome?: { ok: boolean; said: string };
  /** How long the last play took, in ms, once it ended. */
  playedMs?: number;
  /** Draws the canvas anew: each play starts on a page as fresh as a visitor's. */
  canvasKey: number;
  /** The pause between two steps of a play, in seconds — the person's own; never below 0. */
  stepDelay: number;
  setStepDelay: (seconds: number) => void;
  /** Opens the area on `tests`: the canvas in preview, the author's state kept to put back. */
  enter: (tests: SpaceTests) => void;
  leave: () => void;
  /** The list as saved again — after the area's own save, or another's. */
  load: (tests: SpaceTests) => void;
  /** Chooses a flow: it opens on its page and device, as a new visitor. */
  select: (id: string) => void;
  /** A new flow, chosen — on the page the canvas shows. */
  create: (page: string) => void;
  edit: (flow: E2eTest) => void;
  add: (step: E2eStep) => void;
  record: (on: boolean) => void;
  check: (on: boolean) => void;
  /** Plays the chosen flow from its start: held before its first step when `stepping`, after step `until` when given. */
  play: (options?: { stepping?: boolean; until?: number }) => void;
  playAll: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  stop: () => void;
  /** Lights the element a step names on the page — or none. */
  point: (step: E2eStep | undefined) => void;
  save: () => Promise<string | undefined>;
  discard: () => void;
  remove: (id: string) => Promise<string | undefined>;
  /** The canvas the area plays and records in: the builder's iframe, handed over as it mounts. */
  attach: (iframe: HTMLIFrameElement | null) => void;
};

const TestStudioContext = createContext<TestStudioValue>({
  active: false,
  tests: {},
  dirty: false,
  mode: 'idle',
  playingAll: false,
  paused: false,
  checking: false,
  plays: [],
  states: {},
  log: [],
  canvasKey: 0,
  stepDelay: STEP_DELAY_S,
  setStepDelay: () => undefined,
  enter: () => undefined,
  leave: () => undefined,
  load: () => undefined,
  select: () => undefined,
  create: () => undefined,
  edit: () => undefined,
  add: () => undefined,
  record: () => undefined,
  check: () => undefined,
  play: () => undefined,
  playAll: () => undefined,
  pause: () => undefined,
  resume: () => undefined,
  next: () => undefined,
  stop: () => undefined,
  point: () => undefined,
  save: () => Promise.resolve(undefined),
  discard: () => undefined,
  remove: () => Promise.resolve(undefined),
  attach: () => undefined
});

export default TestStudioContext;
