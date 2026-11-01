import { isExpectation, journeyAccount } from '@plitzi/sdk-authoring';

import { checkTitleOf, sentenceText } from './sentences';
import { elementNameOf } from '../helpers';

import type { FlowState, PlayLogLine, StepPlay } from './TestStudioContext';
import type { E2eResult, E2eRunOptions } from '@plitzi/sdk-authoring';
import type { E2eStep, E2eTest, Schema, SignedInTestAccount, UnitTest } from '@plitzi/sdk-shared';

/** What a play in the Tests area is made of, without the area: devices, how a step and a flow stand, the lit tone. */

/** The builder's device for a width: the canvas a flow of that width is played in. */
export const deviceOf = (width = 1440): 'mobile' | 'tablet' | 'desktop' =>
  width <= 480 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop';

/** A time as a person reads it: `1.3 s`. */
export const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

/** A played step as the area shows it. */
export const playOf = (step: { ok: boolean; ms: number; read?: string }): StepPlay =>
  step.ok ? { state: 'passed', ms: step.ms } : { state: 'failed', read: step.read ?? '' };

/** What only a browser of its own plays — the space's actions answered by the flow, a held clock — said, or none. */
export const needsServer = (flow: E2eTest): string | undefined =>
  flow.clock ? "it holds the page's clock" : flow.answers ? "it answers the space's actions itself" : undefined;

/** Where a flow stands once played. */
export const stateOf = (result: E2eResult): FlowState => {
  if (result.stopped) {
    return { state: 'stopped' };
  }

  if (result.ok) {
    return { state: 'passed', ms: result.ms, steps: result.steps.length };
  }

  const at = result.steps.findIndex(step => !step.ok && step.notRun !== true);
  const failed = result.steps.at(at);

  return result.problem
    ? { state: 'failed', read: result.problem }
    : { state: 'failed', read: failed ? `${failed.said} — ${failed.read ?? ''}` : 'it did not hold', at };
};

/** The canvas' document, once it has one. */
export const documentOf = (frame: { current: HTMLIFrameElement | null }) => frame.current?.contentDocument;

/** How a step is lit on the page: something done, or something checked. */
export const toneOf = (step: E2eStep) => (isExpectation(step) ? 'check' : 'act');

/** How long a check is held before it fails, on the canvas — the page is the editor's, already loaded. */
const CHECK_MS = 3000;

/** What a play is handed by whoever runs it: its stop, and what it says before and after each step. */
export type PlayHooks = Pick<E2eRunOptions, 'beforeStep' | 'onStep'> & { signal: AbortSignal };

/** A step played, as a line of the log: in the words a person reads it, and what it read when it did not hold. */
export const logLineOf = (
  played: E2eTest,
  index: number,
  step: { ok: boolean; read?: string },
  started: number,
  flat: Parameters<typeof elementNameOf>[0],
  checks: readonly UnitTest[]
): PlayLogLine => {
  const said = sentenceText(played.steps[index], target => elementNameOf(flat, target), checkTitleOf(checks));

  return {
    at: Date.now() - started,
    flow: played.title || played.id,
    text: step.ok ? said : `${said} — ${step.read ?? ''}`,
    ok: step.ok
  };
};

/** The test account a flow plays as, signed in to the space; none for a guest — or for an account it does not declare, which its run says. */
export const accountOf = (played: E2eTest, space: Schema): SignedInTestAccount | undefined => {
  const playsAs = journeyAccount(played, space);

  return 'account' in playsAs ? playsAs.account : undefined;
};

/** What a flow played on the canvas runs with: the editor's page, its element checks as `space` holds them. */
export const canvasRun = (
  played: E2eTest,
  { signal, beforeStep, onStep }: PlayHooks,
  space: Schema
): E2eRunOptions => ({
  origin: window.location.origin,
  expectMs: CHECK_MS,
  signal,
  space,
  open: async opened => {
    await opened.goto(new URL(played.page, window.location.origin).href, { waitUntil: 'domcontentloaded' });
  },
  ...(beforeStep ? { beforeStep } : {}),
  ...(onStep ? { onStep } : {})
});
