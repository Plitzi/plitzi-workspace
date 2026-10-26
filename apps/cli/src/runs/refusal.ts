/**
 * Why a run or a task command did not do what it was asked, as one code a harness branches on — and the exit code it
 * leaves, distinct per reason, so a script that reads no output still knows what to do next.
 */
export const REFUSAL_EXIT_CODES = {
  claimed: 10,
  waiting: 11,
  reassigned: 12,
  'version-mismatch': 13,
  stopping: 14,
  'forced-stop': 15,
  reconciliation: 16,
  'person-only': 17,
  conflict: 18,
  'checks-failed': 19,
  invalid: 20,
  'not-found': 21,
  'other-machine': 22,
  'another-run': 23,
  'agent-limit': 24,
  'lead-only': 25,
  identity: 26
} as const;

export type RefusalCode = keyof typeof REFUSAL_EXIT_CODES;

/** What the harness does on each code: printed with the refusal, so the answer carries the next step. */
const NEXT_STEP: Record<RefusalCode, string> = {
  claimed: 'take another ready task (plitzi task next), or wait for the file (plitzi task claim <file> --wait)',
  waiting: 'take another ready task meanwhile; the file comes to this task when its holder is approved',
  reassigned: 'stop working on this task: it is no longer yours',
  'version-mismatch':
    'the Plitzi version changed while the run is open: a person re-pins it in their terminal (plitzi run attach) — an agent keeps its work in its copy and waits (plitzi task next waits through it); the lead tells the person',
  stopping: 'finish the task in hand and take no other',
  'forced-stop':
    'stop writing now: a task in hand was cut, and what it wrote since its last review is not kept (a task in review keeps its work); plitzi task next waits for the lead to resume the run',
  reconciliation: 'wait: the lead resolves each file (plitzi run resolve), then continues the run',
  'person-only': 'ask a person to run it in their own terminal',
  conflict:
    'the lead decides, from what the message offers; a task takes the run’s version (plitzi task discard <file>) and redoes its change on it; never write conflict markers',
  'checks-failed': 'fix each step marked ✗ below, then complete again (plitzi task check runs them without completing)',
  invalid: 'do what the refusal above says, then run the command again',
  'not-found': 'check the name: plitzi run status --all lists the runs and their tasks',
  'other-machine':
    'the run is active on another machine: release it there (plitzi run release), or a person takes it over',
  'another-run': 'one run at a time: finish or abort the open one first (plitzi run status)',
  'agent-limit':
    'hand back to the lead: this task waits until one of the agents at work has nothing in progress (plitzi run status)',
  'lead-only': 'it is the lead’s (lead) to do: leave it to it, and go on with your own part',
  identity:
    'pass your own token (--token): the one your first command on the run printed, kept in its scratch/<you>/token — never another’s'
};

export interface RefusalDetail {
  file?: string;
  task?: string;
  holder?: string;
  until?: string;
  problems?: string[];
  /** What to do next, when this refusal knows better than its code's general advice. */
  next?: string;
  /**
   * The messages it hands over, read now: a verdict or a complete held until the lead's word is read. A step of the flow,
   * never a loop — encore-10's report counted a tester's three as "refused 3 times over".
   */
  messages?: string[];
  [key: string]: unknown;
}

export class RunRefusal extends Error {
  readonly code: RefusalCode;
  readonly detail: RefusalDetail;

  constructor(code: RefusalCode, message: string, detail: RefusalDetail = {}) {
    super(message);
    this.name = 'RunRefusal';
    this.code = code;
    this.detail = detail;
  }

  get exitCode(): number {
    return REFUSAL_EXIT_CODES[this.code];
  }

  get next(): string {
    return this.detail.next ?? NEXT_STEP[this.code];
  }

  toJSON(): Record<string, unknown> {
    return { refused: this.code, message: this.message, ...this.detail, next: this.next };
  }
}

export const isRunRefusal = (error: unknown): error is RunRefusal => error instanceof RunRefusal;
