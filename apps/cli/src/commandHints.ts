/**
 * What a command line commander refused most likely meant, said under its own error — encore-3's agents were refused
 * 22 command lines as written, each found again by the next session: a shell variable holding two flags, an option
 * another page command has, a command another group has.
 */

/** A command an agent reached for, and the one that answers it. */
const ELSEWHERE: Readonly<Partial<Record<string, string>>> = {
  'run agents': 'plitzi run status lists the agents and what each is at',
  'run view': 'plitzi run status — or plitzi run monitor, a live board',
  'task list': 'plitzi run status lists the tasks and where each stands',
  'page text':
    'plitzi page outline <path> --within <element> says a part’s words; page check --element <id> what one holds'
};

/** An option another page command has, and what this one calls the same thing. */
const COUNTERPARTS: Readonly<Partial<Record<string, Readonly<Partial<Record<string, string>>>>>> = {
  'page shot': { '--element': '--clip <element> pictures one element' },
  'page measure': { '--element': 'the elements are its arguments: plitzi page measure <path> <element…>' },
  'page play': { '--element': '--read <element…> says what elements show after the steps' }
};

/** The command's two words, flags aside: `page shot` of `page shot / --width 390`. */
const commandOf = (argv: readonly string[]): string => {
  const flag = argv.findIndex(arg => arg.startsWith('-'));

  return argv.slice(0, flag === -1 ? 2 : Math.min(flag, 2)).join(' ');
};

export const commandHint = (error: string, argv: readonly string[]): string | undefined => {
  const unknownOption = /unknown option '([^']+)'/.exec(error)?.[1];
  // A shell that does not split a variable hands two flags as one: `$FLAGS` in zsh is `--as mika`, whole.
  if (unknownOption !== undefined && /\s/.test(unknownOption)) {
    return `'${unknownOption}' arrived as one argument — a shell variable holding several flags is not split by zsh: write the flags out, or expand it with \${=FLAGS}`;
  }

  if (unknownOption !== undefined) {
    return COUNTERPARTS[commandOf(argv)]?.[unknownOption];
  }

  const unknownCommand = /unknown command '([^']+)'/.exec(error)?.[1];
  if (unknownCommand !== undefined) {
    return ELSEWHERE[`${argv[0] ?? ''} ${unknownCommand}`];
  }

  return undefined;
};
