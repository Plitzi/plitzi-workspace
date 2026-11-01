import { rolesGrant } from '@plitzi/sdk-shared/auth';

import { awaitHydration, pressFailure, settle } from './page';
import { asAccount, bridge, playE2eStep } from './play';
import { e2eStepText } from './stepText';
import { answerAction } from '../answerAction';
import { openPage } from '../settle';

import type { E2ePage } from './page';
import type { E2eStep, E2eTest, Schema, SignedInTestAccount } from '@plitzi/sdk-shared';

/**
 * An e2e test run in a browser: its page opened as a visitor's, each step played as the CLI learnt to play
 * one — after the space hydrates, pressed once, the page settled before the next — and each expectation held for its
 * time before it fails, saying what it read.
 */

export interface E2eStepResult {
  /** The step, as a person reads it: `click add-flat-white`, `cart-count shows "1"`. */
  said: string;
  ok: boolean;
  /** What a failed step read, or why it could not be played. */
  read?: string;
  /** Not played: a step before it failed. */
  notRun?: true;
  ms: number;
  /** What `onStep` kept of the page once it was played: a picture, as a data URL. */
  frame?: string;
}

export interface E2eResult {
  id: string;
  title: string;
  ok: boolean;
  ms: number;
  steps: E2eStepResult[];
  /** Why it could not start: the page did not open, or never hydrated. */
  problem?: string;
  /** Stopped by whoever ran it (`signal`) before its last step: the steps after are not run, and it did not pass. */
  stopped?: true;
}

export interface E2eRunOptions {
  /** Where the space is served: `http://127.0.0.1:8080` — what the test's page and a `goto` step are opened on. */
  origin: string;
  /**
   * Opens the test's page the caller's way, in place of opening its path on `origin`: a harness rendering the document
   * in a page already open, the builder's own canvas. The space is still waited for to hydrate.
   */
  open?: (page: E2ePage) => Promise<void>;
  /** How long an expectation is held before it fails, in ms. 5 s, as an assertion's own retry. */
  expectMs?: number;
  /**
   * Told after each step played, with what became of it — and asked for what to keep of the page then: a picture, for a
   * run replayed step by step (the builder's device frame). What it answers is kept on the step as `frame`.
   */
  onStep?: (page: E2ePage, step: E2eStepResult, index: number) => Promise<string | undefined>;
  /** The window's height, in px. 900. */
  height?: number;
  /**
   * Waited for before each step is played: a player shows the step about to be played, and holds it there while it is
   * paused or played a step at a time.
   */
  beforeStep?: (step: E2eStep, index: number) => Promise<void>;
  /** Stops the run before its next step: the rest said as not run, the run as stopped. */
  signal?: AbortSignal;
  /**
   * The document the journey's element checks are read from (`expectCheck`): the builder's as edited, the server's
   * draft, the project's space as authored. Without it, a step that holds one says so. Its test accounts are the ones
   * a journey plays as (`tests.accounts`).
   */
  space?: Schema;
}

/** The state a journey starts with, set on the page before its first step — or why it could not be. */
const startFrom = async (page: E2ePage, test: E2eTest): Promise<string | undefined> => {
  const entries = Object.entries(test.given?.state ?? {});
  for (const [key, value] of entries) {
    if ((await bridge(page, { method: 'setState', args: [key, value] })) === 'none') {
      return "it starts with a state, set through window.__plitzi — which the SDK's dev tools put on a page in debug mode, and this page has none";
    }
  }

  if (entries.length > 0) {
    await settle(page);
  }

  return undefined;
};

/**
 * The test account a journey plays as, signed in — what its roles give in the space, as for a visitor (a role the space
 * no longer declares gives nothing) — none for a guest's, or why it has none: what every player signs the page in as.
 */
export const journeyAccount = (
  test: Pick<E2eTest, 'as'>,
  space: Schema | undefined
): { account?: SignedInTestAccount } | { problem: string } => {
  if (test.as === undefined) {
    return {};
  }

  const account = space?.tests?.accounts?.find(each => each.id === test.as);

  return account
    ? {
        account: { ...account, permissions: rolesGrant(space?.settings.visitorRoles, account.roles ?? []).permissions }
      }
    : {
        problem: `it plays as "${test.as}", which is none of the space's test accounts — declare it in tests.accounts`
      };
};

/** One e2e test run on a page: opened, its steps played and held in turn, the first that fails the last played. */
export const runE2eTest = async (page: E2ePage, test: E2eTest, options: E2eRunOptions): Promise<E2eResult> => {
  const started = Date.now();
  const { origin, expectMs = 5000, height = 900 } = options;
  const failed = (problem: string): E2eResult => ({
    id: test.id,
    title: test.title,
    ok: false,
    ms: Date.now() - started,
    steps: [],
    problem
  });
  await page.setViewportSize({ width: test.width ?? 1440, height });
  await page.emulateMedia({ colorScheme: test.scheme ?? 'light' });
  for (const [action, answer] of Object.entries(test.answers ?? {})) {
    await answerAction(page, action, answer);
  }

  if (test.clock !== undefined) {
    await page.clock.install({ time: Date.parse(test.clock) });
  }

  const playsAs = journeyAccount(test, options.space);
  if ('problem' in playsAs) {
    return failed(playsAs.problem);
  }

  const signedInAs = playsAs.account;
  // Where it starts, signed in as it plays: what stops it is said as the journey's own failure — a page that went
  // elsewhere as it was set up is this journey's, never the end of every journey played after it.
  const setUp = async (): Promise<string | undefined> => {
    if (options.open) {
      await options.open(page);
    } else if ((await openPage(page, new URL(test.page, origin).href)) === null) {
      return `nothing answers at ${new URL(test.page, origin).href}`;
    }

    const late = await awaitHydration(page);
    if (late !== undefined) {
      return late;
    }

    // Signed in as its test account before anything is played, moved to the page it starts on as a link moves it.
    const signedIn = signedInAs ? await asAccount(page, signedInAs, test.page) : undefined;

    return signedIn ?? (await startFrom(page, test));
  };
  const notStarted = await setUp().catch((error: unknown) => `it could not start: ${pressFailure(error)}`);
  if (notStarted !== undefined) {
    return failed(notStarted);
  }

  const steps: E2eStepResult[] = [];
  let stopped = false;
  let halted = false;
  for (const step of test.steps) {
    if (!stopped && options.beforeStep) {
      await options.beforeStep(step, steps.length);
    }

    if (!stopped && options.signal?.aborted) {
      stopped = true;
      halted = true;
    }

    if (stopped) {
      steps.push({ said: e2eStepText(step), ok: false, notRun: true, ms: 0 });
      continue;
    }

    const at = Date.now();
    let read: string | undefined;
    try {
      const done = await playE2eStep(page, step, {
        origin,
        clockHeld: test.clock !== undefined,
        expectMs,
        ...(signedInAs ? { account: signedInAs } : {}),
        ...(options.space ? { space: options.space } : {})
      });
      read = done !== undefined && 'problem' in done ? done.problem : undefined;
    } catch (error) {
      read = `it could not be played: ${pressFailure(error)}`;
    }

    const played: E2eStepResult = {
      said: e2eStepText(step),
      ok: read === undefined,
      ...(read === undefined ? {} : { read }),
      ms: Date.now() - at
    };
    const frame = options.onStep ? await options.onStep(page, played, steps.length).catch(() => undefined) : undefined;
    steps.push(frame === undefined ? played : { ...played, frame });
    stopped = read !== undefined;
  }

  return {
    id: test.id,
    title: test.title,
    ok: !stopped,
    ms: Date.now() - started,
    steps,
    ...(halted ? { stopped: true as const } : {})
  };
};

/** A run as a person reads it: the test, then each step — the failed one with what it read, those after it not run. */
export const e2eResultText = (result: E2eResult): string[] => [
  `${result.ok ? '✓' : '✗'} ${result.id} — ${result.title} (${(result.ms / 1000).toFixed(1)} s)`,
  ...(result.problem ? [`  ${result.problem}`] : []),
  ...(result.stopped ? ['  stopped before its last step'] : []),
  ...result.steps.map(step =>
    step.notRun
      ? `  · ${step.said} — not run`
      : `  ${step.ok ? '✓' : '✗'} ${step.said}${step.read ? ` — ${step.read}` : ''}`
  )
];
