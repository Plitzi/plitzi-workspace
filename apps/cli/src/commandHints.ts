/**
 * What a command line commander refused most likely meant, said under its own error — a run's agents were refused
 * 22 command lines as written, each found again by the next session: a shell variable holding two flags, an option
 * another page command has, a command another group has.
 */

/** A command an agent reached for, and the one that answers it. */
const ELSEWHERE: Readonly<Partial<Record<string, string>>> = {
  'run agents': 'plitzi run status lists the agents and what each is at',
  'run view': 'plitzi run status — or plitzi run monitor, a live board',
  'task list': 'plitzi run status lists the tasks and where each stands',
  'page text':
    'plitzi page outline <path> --within <element> says a part’s words; page check --element <id> what one holds',
  // Folded into another, the CLI's surface cut down: what each was is said where it went.
  'task heartbeat': 'plitzi task progress is the sign of life — alone, or with --step',
  'task claims': 'plitzi task claim, with no file named, says who holds which file',
  'task proposals': 'plitzi task propose, with no task named, lists the proposals and their answers',
  'run pending': 'plitzi run state lists the runs not yet written into the project, ready ones first',
  'run feedback': 'plitzi run report --plitzi says what the run says of Plitzi',
  'run allow-finish': 'plitzi run finish --lead-finishes, a person’s (--no-lead-finishes takes it back)',
  'run continue': 'plitzi run resolve <run>, no file named, lets the run go on once every file is settled',
  'run prune': 'nothing to run: every run open, and run watch while it follows, prune the caches'
};

/** An option another page command has, and what this one calls the same thing. */
const COUNTERPARTS: Readonly<Partial<Record<string, Readonly<Partial<Record<string, string>>>>>> = {
  'page shot': {
    '--element': '--clip <element> pictures one element',
    // A run's design-1, twice: a page shot is the whole page unless told otherwise.
    '--full': 'a page shot is the whole page already — --viewport pictures the first screen alone'
  },
  'page measure': { '--element': 'the elements are its arguments: plitzi page measure <path> <element…>' },
  'page play': { '--element': '--read <element…> says what elements show after the steps' },
  'task look': {
    '--clip': 'task look pictures whole pages — page shot <path> --clip <element> pictures one element of the copy'
  },
  'task next': {
    '--take': 'task next takes the task by itself — --peek only looks',
    '--follow': 'task next waits by itself — --no-wait answers now'
  },
  'run watch': { '--until': 'run watch, run by the lead, ends on what needs the lead — no --until' },
  explain: { '--search': 'explain takes the words themselves, quoted: plitzi explain "carousel end"' }
};

/** A command that takes no argument, and where what was given to it is read. */
const TAKES_NONE: Readonly<Partial<Record<string, string>>> = {
  'task inbox':
    'task inbox is what was said to you, from any task; what a task’s agent and reviewers said is in plitzi task show <task>'
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

  // `--as $WHO` with $WHO empty leaves the flag bare, the next flag read as its value would be.
  const bareOption = /option '(--[\w-]+) <[^>]+>' argument missing/.exec(error)?.[1];
  if (bareOption !== undefined) {
    return `${bareOption} takes its value right after it (${bareOption} <value>) — a shell variable that is empty leaves it bare`;
  }

  if (/too many arguments for '[^']+'/.test(error)) {
    return TAKES_NONE[commandOf(argv)];
  }

  const unknownCommand = /unknown command '([^']+)'/.exec(error)?.[1];
  if (unknownCommand !== undefined) {
    return ELSEWHERE[`${argv[0] ?? ''} ${unknownCommand}`];
  }

  return undefined;
};
