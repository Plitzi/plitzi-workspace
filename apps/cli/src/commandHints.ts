/**
 * What a command line commander refused most likely meant, said under its own error — a run's agents were refused
 * 22 command lines as written, each found again by the next session: a shell variable holding two flags, an option
 * another page command has, a command another group has.
 */

/**
 * A command an agent reached for by its plain name, and the one that answers it: only names a model would write for
 * that action unprompted (`task ask`, `task list`) — never one kept because a command was once called so.
 */
const ELSEWHERE: Readonly<Partial<Record<string, string>>> = {
  'run agents': 'plitzi run status lists the tasks, each with the agent at it',
  'run view': 'plitzi run status — or plitzi run monitor, a live board',
  'run state': 'plitzi run status --all lists every run not yet written into the project',
  'run pending': 'plitzi run status --all lists the runs not yet written into the project, ready ones first',
  'run plan': 'plitzi run open <plan> --dry-run holds a plan to the rules and opens nothing',
  'run extend': 'plitzi run open <stage> stacks a plan on the open run — --dry-run sees it first',
  'run purge': 'plitzi run abort <run> ends a run and removes its folder, backups included (a person’s)',
  'run note': 'plitzi task message all "…" tells every task — the ones taken later too',
  'run feedback': 'plitzi run report --plitzi says what the run says of Plitzi',
  'task list': 'plitzi run status lists the tasks and where each stands',
  'task take': 'plitzi task next <task> takes that task by name, now',
  'task ask': 'plitzi task tell "…" --ask asks the lead — its answer comes with your next command',
  'task block': 'plitzi task tell "…" --blocked says what stops your task — it is let go until unblocked',
  'task note': 'plitzi task tell "…" --handoff leaves a note for whoever takes the task next',
  'task handoff': 'plitzi task tell "…" --handoff leaves a note for whoever takes the task next',
  'task request': 'plitzi task propose --file <file> --change "…" asks a change of a shared file',
  'task wait': 'plitzi task claim <file> --wait waits for a file another task holds — --follow until it is yours',
  'task release': 'plitzi task claim <file> --release lets a file go to the next task waiting for it',
  'skills update': 'plitzi upgrade skills --write brings the skills up to the installed packages',
  // A run's scout reached for the pages of the space by name.
  'space pages': 'plitzi space overview lists the pages, each with its files — space overview <page> one of them',
  'page text':
    'plitzi page outline <path> --within <element> says a part’s words; page check --element <id> what one holds',
  // What moves between the project and its space is one command: space pull and space push, a part named.
  'runtime push': 'plitzi space push runtime sends the runtime module — space push alone, whatever changed',
  'functions push':
    'plitzi space push functions saves src/functions/ as the draft — space push alone, whatever changed',
  'functions pull': 'plitzi space pull functions writes the space’s functions into src/functions/'
};

/** An option a model writes for a command by its plain name, and what this command calls the same thing. */
const COUNTERPARTS: Readonly<Partial<Record<string, Readonly<Partial<Record<string, string>>>>>> = {
  'page shot': {
    // A run's designer, twice: a page shot is the whole page unless told otherwise.
    '--full': 'a page shot is the whole page already — --viewport pictures the first screen alone',
    // Nine runs reached for it: one element pictured is a part of the page, as every page command names one.
    '--element': 'one element pictured alone: plitzi page shot <path> --within <element>',
    '--clip': 'one element pictured alone: plitzi page shot <path> --within <element>'
  },
  'page measure': {
    '--element': 'the elements are its arguments: plitzi page measure <path> <element…>',
    // Two agents of a run reached for it to read a dialog's styles: what it measures is every property, always.
    '--css':
      'page measure says every property it measures of each element, as it is; --expect "<property>=<value>" holds one',
    // page shot's and page check's flag, reached for beside them: here a field is typed into as a step.
    '--fill': 'page measure types into a field as a step: --steps "type <element> <text>" — then measures'
  },
  'page play': {
    '--element': '--read <element…> says what elements show after the steps',
    // Asked five runs running: a picture is a step of its own.
    '--shot': 'a shot step pictures the page where it stands: --steps "click open; shot opened" — in tmp/shots'
  },
  'task look': { '--clip': 'one part of each page pictured alone: plitzi task look <task> --within <element>' },
  // Eleven runs reached for it: a brief's whole files are --files, a task's whole notes and diffs task show's --full.
  'task context': {
    '--full':
      'its files whole: plitzi task context --files — the task’s notes, brief and diffs whole: plitzi task show <task> --full'
  },
  'task check': {
    '--before': 'what a task’s acceptance proves is task prove: plitzi task prove <task> --before',
    '--mutate':
      'what a task’s acceptance proves is task prove: plitzi task prove <task> --mutate <file> --from "…" --to "…"',
    '--tasks': 'a stage is seen before it is proposed with plitzi run open <stage.json> --dry-run --lines'
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
