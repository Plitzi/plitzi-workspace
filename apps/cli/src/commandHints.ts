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
  // Folded into another, the surface cut down after encore-10: what each was is said where it went.
  'task take': 'plitzi task next <task> takes that task by name, now',
  'run rehearse': 'plitzi run open <plan> --dry-run --rehearse plays the plan out',
  'run plan': 'plitzi run open <plan> --dry-run holds a plan to the rules and opens nothing',
  'run state': 'plitzi run status --all lists every run not yet written into the project',
  'run note': 'plitzi task message all "…" tells every task — the ones taken later too',
  'run bench': 'plitzi run report --bench measures every run of the project the same way',
  'skills update': 'plitzi upgrade skills --write brings the skills up to the installed packages',
  // encore-10's scout reached for the pages of the space by name.
  'space pages': 'plitzi space overview lists the pages, each with its files — space overview <page> one of them',
  'page text':
    'plitzi page outline <path> --within <element> says a part’s words; page check --element <id> what one holds',
  // Folded into another, the CLI's surface cut down: what each was is said where it went.
  'task heartbeat': 'plitzi task progress is the sign of life — alone, or with --step',
  'task claims': 'plitzi task claim, with no file named, says who holds which file',
  'task proposals': 'plitzi task propose, with no task named, lists the proposals and their answers',
  'run pending': 'plitzi run status --all lists the runs not yet written into the project, ready ones first',
  'run feedback': 'plitzi run report --plitzi says what the run says of Plitzi',
  'run allow-finish': 'plitzi run finish --lead-finishes, a person’s (--no-lead-finishes takes it back)',
  'run continue': 'plitzi run resolve <run>, no file named, lets the run go on once every file is settled',
  'run prune': 'nothing to run: every run open, and run watch while it follows, prune the caches',
  'task wait': 'plitzi task claim <file> --wait waits for a file another task holds — --follow until it is yours',
  'task release': 'plitzi task claim <file> --release lets a file go to the next task waiting for it',
  'run copy': 'plitzi run preview --copy [dir] makes the run’s approved work a folder of yours',
  'run restore': 'plitzi run show <run> <file> --restore [backup] puts the file back from a backup (a person’s)',
  'run release': 'plitzi run attach <run> --release lets the run go from this machine',
  // What moves between the project and its space is one command: space pull and space push, a part named.
  'runtime push': 'plitzi space push runtime sends the runtime module — space push alone, whatever changed',
  'functions push':
    'plitzi space push functions saves src/functions/ as the draft — space push alone, whatever changed',
  'functions pull': 'plitzi space pull functions writes the space’s functions into src/functions/'
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
  // A run's designer, after an edit, could not tell whether an outline was read anew: it always is.
  'page outline': { '--fresh': 'page outline reads the page anew on every call — nothing of it is kept to read again' },
  'task look': {
    '--clip': 'task look pictures whole pages — page shot <path> --clip <element> pictures one element of the copy'
  },
  'task next': {
    '--take': 'task next takes the task by itself — --peek only looks',
    '--follow': 'task next waits by itself — --no-wait answers now'
  },
  'page same': { '--than': '--compare <origin> is the server the pages are held to — every page command’s other side' },
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

  // A required flag is missed before an unknown one is: given by its old name (`page same --than`), the name is said.
  if (/required option '[^']+' not specified/.test(error)) {
    const counterparts = COUNTERPARTS[commandOf(argv)];
    const given = argv.find(arg => counterparts?.[arg] !== undefined);

    return given === undefined ? undefined : counterparts?.[given];
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
    // Under a group (`run team check`) or a group of its own gone (`skills update`, refused as 'skills').
    const at = argv.indexOf(unknownCommand);
    const said = [
      `${argv[0] ?? ''} ${unknownCommand}`,
      argv.slice(Math.max(0, at - 1), at + 1).join(' '),
      argv.slice(at, at + 2).join(' ')
    ];

    return (
      said.map(each => ELSEWHERE[each]).find(each => each !== undefined) ??
      (unknownCommand === 'check' && argv[1] === 'team'
        ? 'plitzi doctor says whether .plitzi/team.json is a team the runs read as written'
        : undefined)
    );
  }

  return undefined;
};
