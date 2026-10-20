import type { Command } from 'commander';

export const JSON_OPTION = ['--json', 'One object, for a tool or an agent'] as const;
export const TOKEN_OPTION = [
  '--token <token>',
  'The task’s token plitzi task take answered (or PLITZI_TASK_TOKEN)'
] as const;
export const RUN_OPTION = [
  '--run <run>',
  'The run, when the token does not say it and more than one is open (or PLITZI_RUN)'
] as const;
export const AGENT_OPTION = ['--agent <name>', 'Who is calling, for the run’s log (or PLITZI_AGENT)'] as const;

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

      const first = command.registeredArguments.at(0);
      if (first?.name() === 'run' && !first.required && !command.options.some(option => option.long === '--run')) {
        command.option(...RUN_OPTION);
      }
    }
  }
};
