import { EASE_SCALE } from '../../../runs/report/experience';

import type { Command } from 'commander';

export const JSON_OPTION = ['--json', 'One object, for a tool or an agent'] as const;
export const TOKEN_OPTION = [
  '--token <token>',
  'Who you are: your own token, as your first command on the run printed it — on every command, inside a task’s copy too (or PLITZI_TOKEN)'
] as const;
export const RUN_OPTION = [
  '--run <run>',
  'The run, when the token does not say it and more than one is open (or PLITZI_RUN)'
] as const;
export const AGENT_OPTION = [
  '--agent <name>',
  'Your name, said once — your first command on the run, which answers your token — then your token says it (or PLITZI_AGENT)'
] as const;

/** A flag said again for each value, as the list of them. */
const each = (value: string, previous: readonly string[]): string[] => [...previous, value];

/** What a list flag starts as before any is said: never changed, each value makes a new list. */
const NONE: readonly string[] = [];

/** What it was like to work with Plitzi (`experience.ts`): said by an agent at `task complete`, by the lead at its report. */
export const EASE_OPTION = ['--ease <1-5>', `How Plitzi was to work with: ${EASE_SCALE}`] as const;
export const HARDEST_OPTION = ['--hardest <text>', 'What cost you the most — time, tries, tokens — and why'] as const;
export const FRICTION_OPTION = [
  '--friction <text>',
  'Something of Plitzi that got in your way — a command, a doc, an error, something missing; again for each',
  each,
  NONE
] as const;
export const HELPED_OPTION = [
  '--helped <text>',
  'Something of Plitzi that helped — what a change must not take away; again for each',
  each,
  NONE
] as const;

/** What was piped in, read once: the text a `-` stands for. */
let piped: Promise<string> | undefined;
const readPiped = (): Promise<string> =>
  (piped ??= new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('"-" reads the text from stdin, and nothing is piped in: echo "…" | plitzi task ask -'));

      return;
    }

    let text = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => (text += chunk));
    process.stdin.on('end', () => resolve(text.replace(/\n$/, '')));
    process.stdin.on('error', reject);
  }));

/**
 * What every command of a run shares: who calls it, for the run's log — and a text written `-` read from stdin, and
 * `PLITZI_JSON=1` an answer in JSON — the same in every command.
 */
export const sharedOptions = (groups: readonly Command[]): void => {
  for (const group of groups) {
    // A text written as `-` — a question, a note, a reason — is read from stdin: no quoting of a shell to get right.
    group.hook('preAction', async (_group, action) => {
      // An agent that reads every answer as JSON says so once, for its whole shell, not on each command.
      if (process.env.PLITZI_JSON === '1' && action.options.some(option => option.long === '--json')) {
        action.setOptionValue('json', true);
      }

      if (!action.processedArgs.includes('-') && !Object.values(action.opts()).includes('-')) {
        return;
      }

      const text = await readPiped();
      action.processedArgs = action.processedArgs.map((arg: unknown) => (arg === '-' ? text : arg));
      for (const [key, value] of Object.entries(action.opts())) {
        if (value === '-') {
          action.setOptionValue(key, text);
        }
      }
    });

    for (const command of group.commands) {
      if (!command.options.some(option => option.long === '--agent')) {
        command.option(...AGENT_OPTION);
      }

      if (!command.options.some(option => option.long === '--token')) {
        command.option(...TOKEN_OPTION);
      }

      const first = command.registeredArguments.at(0);
      if (first?.name() === 'run' && !first.required && !command.options.some(option => option.long === '--run')) {
        command.option(...RUN_OPTION);
      }
    }
  }
};

/** `task check --mutate`: a change to the code — said again, with its own --from and --to, for each change more. */
export const MUTATE_OPTIONS = [
  [
    '--mutate <file>',
    'Its acceptance run on its copy and on a mutant of it — the copy with a change to the code, --from "…" --to "…" (again, the three, for a change more: a behaviour held in two places): a line that fails on the mutant holds that behaviour; one passing on both lets it break unseen (a task of tests, reviewed)',
    each,
    NONE
  ],
  ['--from <text>', 'With --mutate: the code to change, quoted as the file writes it — found once', each, NONE],
  ['--to <text>', 'With --mutate: what it says instead', each, NONE],
  [
    '--line <n>',
    'With --before or --mutate: the acceptance line run, by its place (1 the first) — again for each: a unit test proved without the task’s Playwright lines',
    each,
    NONE
  ]
] as const;
