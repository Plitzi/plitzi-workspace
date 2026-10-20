/**
 * Why a run or a task command did not do what it was asked, as one code a harness branches on — and the exit code it
 * leaves, distinct per reason, so a script that reads no output still knows what to do next (RFC 0028 §9.12).
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
  'agent-limit': 24
} as const;

export type RefusalCode = keyof typeof REFUSAL_EXIT_CODES;

/** What the harness does on each code: printed with the refusal, so the answer carries the next step. */
const NEXT_STEP: Record<RefusalCode, string> = {
  claimed: 'take another ready task (plitzi task next), or wait for the file (plitzi task wait)',
  waiting: 'take another ready task meanwhile; the file comes to this task when its holder is approved',
  reassigned: 'stop working on this task: it is no longer yours',
  'version-mismatch': 'the Plitzi version changed while the run is open: run plitzi run attach to re-read it',
  stopping: 'finish the task in hand and take no other',
  'forced-stop': 'stop now: what was written since the last review is discarded',
  reconciliation: 'wait: the lead resolves each file (plitzi run resolve), then continues the run',
  'person-only': 'ask a person to run it in their own terminal',
  conflict:
    'the lead decides (--overwrite, or --changes to redo it on the project’s version); never write conflict markers',
  'checks-failed': 'fix what the output names, then complete again',
  invalid: 'fix what the output names',
  'not-found': 'check the name: plitzi run state lists the runs and their tasks',
  'other-machine':
    'the run is active on another machine: release it there (plitzi run release), or a person takes it over',
  'another-run': 'one run at a time: finish or abort the open one first (plitzi run status)',
  'agent-limit':
    'hand back to the lead: it starts this task when one of the tasks at work goes to review (plitzi run status)'
};

export interface RefusalDetail {
  file?: string;
  task?: string;
  holder?: string;
  until?: string;
  problems?: string[];
  /** What to do next, when this refusal knows better than its code's general advice. */
  next?: string;
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
