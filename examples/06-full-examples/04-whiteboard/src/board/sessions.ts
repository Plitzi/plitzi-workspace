import { isRecord } from './model.ts';

/**
 * A session with a script: a retro, a brainstorm, a quick decision — steps the whole board goes through together, each
 * with its time. Anyone on the board runs it, or an agent does (`start_session`, `session_next`): the steps are the
 * board's, kept with it and announced on its channel like its timer, so a page arriving in the middle is at the same
 * step as everyone else.
 *
 * - `write`: everyone writes on their own — the notes the others make are face down until the step is over;
 * - `reveal`: everything shows, and there is a moment to read it;
 * - `vote`: the notes worth taking on get a vote;
 * - `discuss`: the most voted, talked through.
 */

export const STEP_KINDS = ['write', 'reveal', 'vote', 'discuss'] as const;

export type StepKind = (typeof STEP_KINDS)[number];

export type ScriptStep = { kind: StepKind; minutes: number; say: string };

export const SCRIPT_IDS = ['retro', 'brainstorm', 'decide'] as const;

export type ScriptId = (typeof SCRIPT_IDS)[number];

export const SCRIPTS: Record<ScriptId, { label: string; steps: readonly ScriptStep[] }> = {
  retro: {
    label: 'Retro',
    steps: [
      { kind: 'write', minutes: 5, say: 'Write what went well and what did not — nobody sees your notes yet' },
      { kind: 'reveal', minutes: 2, say: 'Everything is showing: read what the others wrote' },
      { kind: 'vote', minutes: 3, say: 'Vote for what the team should take on next' },
      { kind: 'discuss', minutes: 10, say: 'Talk through the most voted, and agree on what to do' }
    ]
  },
  brainstorm: {
    label: 'Brainstorm',
    steps: [
      { kind: 'write', minutes: 5, say: 'One idea per note — as many as you like, nobody sees them yet' },
      { kind: 'reveal', minutes: 2, say: 'All the ideas are out: read them, group the ones that belong together' },
      { kind: 'vote', minutes: 2, say: 'Vote for the ideas worth trying' }
    ]
  },
  decide: {
    label: 'Quick decision',
    steps: [
      { kind: 'discuss', minutes: 5, say: 'Put the options on the board and say what you think of each' },
      { kind: 'vote', minutes: 1, say: 'One vote each: pick one' }
    ]
  }
};

/** A script under way: which, where it is, when that step ends, who runs it — and its id, for notes written in it. */
export type BoardSession = { id: string; script: ScriptId; step: number; endsAt: number; host: string };

const isScriptId = (value: unknown): value is ScriptId => SCRIPT_IDS.some(id => id === value);

/** A session from outside — a page's prop, a channel's message — checked, or nothing. */
export const parseSession = (value: unknown): BoardSession | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const { id, script, step, endsAt, host } = value;

  return typeof id === 'string' &&
    isScriptId(script) &&
    typeof step === 'number' &&
    Number.isInteger(step) &&
    step >= 0 &&
    step < SCRIPTS[script].steps.length &&
    typeof endsAt === 'number' &&
    typeof host === 'string'
    ? { id, script, step, endsAt, host }
    : undefined;
};

/** The step a session is at. */
export const stepOf = (session: BoardSession): ScriptStep => SCRIPTS[session.script].steps[session.step];

/** What a writing step turns face down: what people write their thoughts on. */
const VEILED_TYPES: ReadonlySet<string> = new Set(['sticky', 'card', 'text']);

/** The session an element made now is written in, face down — during a writing step, for what people write on. */
export const veiledIn = (session: BoardSession | undefined, type: string): string | undefined =>
  session && stepOf(session).kind === 'write' && VEILED_TYPES.has(type) ? session.id : undefined;

/** Whether an element written during `session`'s writing step is still face down for the others. */
export const isFaceDown = (
  element: { veiled?: string; author?: string },
  session: BoardSession | null | undefined,
  me: string
): boolean =>
  element.veiled !== undefined &&
  session !== null &&
  session !== undefined &&
  element.veiled === session.id &&
  stepOf(session).kind === 'write' &&
  element.author !== me;

/** A session in a line: its script, its step and what the step is for. */
export const describeSession = (session: BoardSession): string => {
  const { label, steps } = SCRIPTS[session.script];
  const step = stepOf(session);
  const left = Math.max(0, Math.round((session.endsAt - Date.now()) / 1000));

  return `${label}, step ${session.step + 1} of ${steps.length} — ${step.kind}: ${step.say} (${left}s left, run by ${session.host})`;
};
