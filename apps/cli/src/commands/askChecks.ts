import { emitKeypressEvents } from 'node:readline';

import chalk from 'chalk';

/**
 * Several of a list, ticked at the terminal: ↑/↓ (or k/j) move, space ticks, `a` ticks all or none, Enter takes what is
 * ticked, Esc or Ctrl-C takes nothing. For a choice of parts rather than of one thing — what `plitzi push` sends.
 *
 * Only for somebody at the terminal (`atTerminal`): a command run by nobody takes its answer from its arguments, and
 * refuses — saying what to pass — when they are missing.
 */

export type Check<T> = {
  label: string;
  value: T;
  /** Ticked when the list is first shown. */
  checked: boolean;
  /** Said dimmed beside the label: why it is ticked, or not. */
  hint?: string;
};

export type ChecksState = { cursor: number; checked: boolean[] };

/** A key as `readline` reads one: its name, and whether Ctrl was held. */
export type ChecksKey = { name?: string; ctrl?: boolean };

/** What a key does to the list: a new state, or the end of the question — taken or given up. */
export const checksAfter = (state: ChecksState, key: ChecksKey): ChecksState | 'done' | 'cancel' => {
  const count = state.checked.length;
  if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
    return 'cancel';
  }

  if (key.name === 'return' || key.name === 'enter') {
    return 'done';
  }

  if (key.name === 'up' || key.name === 'k') {
    return { ...state, cursor: (state.cursor - 1 + count) % count };
  }

  if (key.name === 'down' || key.name === 'j') {
    return { ...state, cursor: (state.cursor + 1) % count };
  }

  if (key.name === 'space') {
    return { ...state, checked: state.checked.map((on, index) => (index === state.cursor ? !on : on)) };
  }

  if (key.name === 'a') {
    const all = state.checked.every(Boolean);

    return { ...state, checked: state.checked.map(() => !all) };
  }

  return state;
};

/** The list as it is drawn: the question, a line per option, and the keys. */
export const renderChecks = <T>(question: string, options: readonly Check<T>[], state: ChecksState): string[] => [
  chalk.bold(question),
  ...options.map(({ label, hint }, index) => {
    const pointer = index === state.cursor ? chalk.cyan('›') : ' ';
    const box = state.checked[index] ? chalk.green('[x]') : '[ ]';

    return `${pointer} ${box} ${label}${hint ? chalk.dim(`  ${hint}`) : ''}`;
  }),
  chalk.dim('  ↑/↓ move · space ticks · a all · enter takes · esc cancels')
];

/** What is ticked once the person takes the list — `undefined` when they give it up. */
export const askChecks = async <T>(question: string, options: readonly Check<T>[]): Promise<T[] | undefined> => {
  const { stdin, stdout } = process;
  let state: ChecksState = { cursor: 0, checked: options.map(({ checked }) => checked) };
  let drawn = 0;
  const draw = (): void => {
    const lines = renderChecks(question, options, state);
    // Back over what was drawn last, cleared, so the list is redrawn where it stands rather than below itself.
    stdout.write(`${drawn ? `\x1b[${String(drawn)}A\x1b[0J` : ''}${lines.join('\n')}\n`);
    drawn = lines.length;
  };

  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write('\x1b[?25l');
  draw();

  return new Promise(resolve => {
    const onKey = (_text: string | undefined, key: ChecksKey | undefined): void => {
      const next = checksAfter(state, key ?? {});
      if (next !== 'done' && next !== 'cancel') {
        state = next;
        draw();

        return;
      }

      stdin.off('keypress', onKey);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write('\x1b[?25h');
      resolve(
        next === 'done' ? options.filter((_option, index) => state.checked[index]).map(({ value }) => value) : undefined
      );
    };
    stdin.on('keypress', onKey);
  });
};
