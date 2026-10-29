import { Option } from 'commander';

import {
  claimCommand,
  taskAnswer,
  taskCheck,
  taskProve,
  taskComplete,
  taskFound,
  taskContextCommand,
  taskShow,
  taskTell,
  taskDiscard,
  taskInbox,
  taskLeave,
  taskLook,
  taskMessage,
  taskNext,
  taskProgress,
  taskPropose,
  taskProposals,
  taskReassign,
  taskProposeShared,
  taskEscalate,
  taskReview,
  taskRevert,
  taskRun,
  taskTake,
  taskUnblock
} from '..';
import {
  AGENT_OPTION,
  EASE_OPTION,
  FRICTION_OPTION,
  PLITZI_IN_THE_WAY_OPTION,
  PLITZI_NO_WAY_OPTION,
  PLITZI_WRONG_OPTION,
  HARDEST_OPTION,
  HELPED_OPTION,
  JSON_OPTION,
  MUTATE_OPTIONS,
  RUN_OPTION,
  TOKEN_OPTION
} from './options';
import { count, duration, durationText, FOLLOW_MS, fraction } from '../../../options';
import { BLOCK_NEEDS } from '../../../runs/core/model';
import { projectExec } from '../../../scaffold/packageManager';
import { groupHelp } from '../../register/helpGroups';
import { withVisitorOptions } from '../../register/options';

import type {
  AnswerOptions,
  ProveOptions,
  ClaimOptions,
  LookOptions,
  ProposeOptions,
  ReviewOptions,
  RunCommandOptions
} from '..';
import type { ExperienceFlags } from '../../../runs/report/experience';
import type { HelpGroup } from '../../register/helpGroups';
import type { TellOptions } from '../task/talk';
import type { Command } from 'commander';

/** Each command of `plitzi task`, by who runs it: an agent at its task, or the lead reviewing them. */
const TASK_HELP: readonly HelpGroup[] = [
  {
    heading: 'Every agent, at its task:',
    commands: ['next', 'context', 'progress', 'check', 'run', 'complete', 'tell', 'inbox']
  },
  {
    heading: 'Files and changes outside your task:',
    commands: ['claim', 'discard', 'propose', 'answer']
  },
  {
    heading: "Reviewing — a tester's, the lead's, and a designer's look:",
    commands: ['look', 'show', 'prove', 'review']
  },
  {
    heading: "The lead's:",
    commands: ['message', 'unblock', 'reassign', 'leave', 'revert']
  }
];

/** `plitzi task …`: its commands, registered on the program. */
export const registerTaskGroup = (program: Command): Command => {
  const taskGroup = program
    .command('task')
    .description(
      'Multi-agent: a task of a run, as its agent works it — taken, worked in its copy, completed, reviewed. Only inside a run'
    );

  taskGroup
    .command('next')
    .description(
      'The next task, taken — waiting until one is ready: the most urgent — its priority or the highest of what waits on it — then the longest chain still to do. Named, that one, taken now'
    )
    .argument('[task]', 'A task to take by name, now: its files locked, its copy made, its token answered')
    .option(
      '--role <roles>',
      'Only a task for these roles, separated by commas: developer, designer, reviewer, tester, writer…'
    )
    .option(
      '--no-wait',
      'Answer now — the ready one taken, or none — rather than wait until one is ready or every task of the role is done'
    )
    .option('--peek', 'Only say what is next: nothing taken, nothing waited for')
    .option('--timeout <duration>', 'While it waits: give up after this long, said (90s, 8m, 1h)', duration, FOLLOW_MS)
    .addOption(
      new Option(
        '--quality <level>',
        'The level this agent was started at: only tasks of it or below (PLITZI_QUALITY otherwise)'
      ).choices(['light', 'standard', 'high'])
    )
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action(
      (
        task: string | undefined,
        options: RunCommandOptions & { role?: string; wait: boolean; peek?: boolean; timeout?: number }
      ) => (task === undefined ? taskNext(options) : taskTake(task, options))
    );

  taskGroup
    .command('claim')
    .description(
      'Take shared files by turns, --wait for one another task holds, or --release one to the next task waiting — with none named, which files each task locks, why and since when'
    )
    .argument('[files...]', 'The project files')
    .option(
      '--wait',
      'Wait for a file another task holds: it comes with the approved version. Exits 11, or with --follow stays until it is yours'
    )
    .option('--release', 'Let a file held by turns go to the next task waiting for it')
    .option('--follow', 'With --wait: stay until the file is yours, giving the task’s sign of life meanwhile')
    .option(
      '--timeout <duration>',
      'With --follow: give up after this long, said, exit 11 (90s, 8m, 1h)',
      duration,
      FOLLOW_MS
    )
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((files: string[], options: ClaimOptions) => claimCommand(files, options));

  taskGroup
    .command('discard')
    .description('Put files of your copy back to the run’s version now, and start from them')
    .argument('<files...>', 'The project files')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((files: string[], options: RunCommandOptions) => taskDiscard(files, options));

  taskGroup
    .command('progress')
    .description(
      'Where the task is — its fraction and step — and a sign of life: alone, during a long think or test run with no write, at least every 2 minutes'
    )
    .option('--fraction <n>', 'Between 0 and 1', fraction)
    .option('--step <step>', 'What it is on: "page 3 of 5"')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions & { fraction?: number; step?: string }) => taskProgress(options));

  taskGroup
    .command('unblock')
    .description('Lift a block — the lead’s or a person’s')
    .argument('<task>', 'The task')
    .option('--answer <text>', 'What it waited for, said to the task: it reaches its agent with its next command')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: RunCommandOptions & { answer?: string }) => taskUnblock(task, options));

  taskGroup
    .command('propose')
    .description(
      'Ask for a change outside your files: of another task, to make it or to accept it in its work (--wait for the answer); of a shared file (--file), which one integration task applies. With neither, the proposals between tasks and their answers — your task’s, with its token'
    )
    .argument('[task]', 'The task asked — none with --file')
    .option('--change <change>', 'The change, specifically: "the card takes a `lang` prop"')
    .option('--why <why>', 'Why this task needs it')
    .option('--about <file>', 'With a task: the file it is about')
    .option('--wait', 'With a task: wait for the answer; go on with what does not need it')
    .option('--follow', 'With a task: stay until the answer comes, giving the task’s sign of life meanwhile')
    .option(
      '--file <file>',
      'A shared file the change is to, no task asked: change it in your copy too — one integration task applies every change asked of it'
    )
    .option('--used-in <files>', 'With --file: where you use it, comma-separated')
    .option('--blocking', 'With --file: it cannot wait — its integration task is made now, and this task waits for it')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string | undefined, options: ProposeOptions) =>
      options.file !== undefined
        ? taskProposeShared(task, options)
        : task === undefined
          ? taskProposals(options)
          : taskPropose(task, options)
    );

  taskGroup
    .command('answer')
    .description(
      'Answer a proposal made to your task — or, as the lead, to any: accept, reject or counter it; withdraw your own'
    )
    .argument('<proposal>', 'The proposal: t-home-p1')
    .option('--accept', 'Agree: both tasks carry it into review')
    .option('--reject <why>', 'Refuse it, saying why')
    .option('--counter <change>', 'Propose a change instead — three rounds at most, then the lead decides')
    .option('--withdraw <why>', 'Take back a proposal your task made, no longer asked — the lead changed course')
    .option('--note <note>', 'A note with an acceptance')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((proposal: string, options: AnswerOptions) => taskAnswer(proposal, options));

  taskGroup
    .command('check')
    .description(
      'What complete would hold your copy to — the checks, the acceptance’s commands, long files — run now; nothing changes (but --fix)'
    )
    .option('--acceptance', 'Only the acceptance’s commands, the copy served for them: iterating on one line')
    .option(
      '--fix',
      'First, what the project’s linter and formatter fix by themselves (eslint --fix, prettier --write), on your changed files alone'
    )
    .option(
      '--fresh',
      'Run it all, though it passed already and nothing changed since — lint too, its kept answers dropped'
    )
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions & { acceptance?: boolean; fix?: boolean; fresh?: boolean }) =>
      taskCheck(options)
    );

  taskGroup
    .command('prove')
    .description(
      'What a task’s acceptance proves — a reviewer’s: each line beside the run before the task (--before), or on a mutant of its copy (--mutate), one way at a time'
    )
    .argument('[task]', 'The task — a review’s — your own when left out')
    .option(
      '--before',
      'Each line run on the run before it too — the approved work without it: a line that fails there and passes with it proves the change; one passing on both proves nothing (a test’s or a bug’s fix, reviewed)'
    )
    .option(...MUTATE_OPTIONS[0])
    .option(...MUTATE_OPTIONS[1])
    .option(...MUTATE_OPTIONS[2])
    .option(...MUTATE_OPTIONS[3])
    .option(
      '--tests',
      'With --mutate: the project’s own tests run too, on the copy and on the mutant, a line of their own — whether any test holds what a line a reviewer judges leans on'
    )
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((named: string | undefined, options: ProveOptions) => taskProve(named, options));

  taskGroup
    .command('run')
    .description(
      'A command of your own — a spec, a probe, a test file — run as the run’s checks are: a Playwright suite in its turn on the machine, what it printed kept in a file and what failed said, what the lead told you meanwhile with it'
    )
    .argument(
      '<command>',
      `The command, quoted whole: "${projectExec('playwright test visual/room.spec.ts --repeat-each 3')}"`
    )
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((command: string, options: RunCommandOptions) => taskRun(command, options));

  taskGroup
    .command('complete')
    .description(
      'Finish the task: its copy compared by fingerprint, the project’s checks run in it, and to review — a research card with what it found (--found)'
    )
    .argument(
      '[task]',
      'The task your token holds — named, it must be that one (the lead names the research it found out)'
    )
    .option(
      '--found <findings>',
      'A research card’s: what was found — kept with it, read by every task that waits for it; a scout’s goes to the lead’s review'
    )
    .option(
      '--tasks <stage.json>',
      'With --found: its result, the tasks it makes — a stage, as `run open` stacks, each task with its "findings"'
    )
    .option(
      '--closes <items>',
      'With --found: the backlog items it found no longer to do — b-3,b-7 — closed with what it found as the run is applied, once the lead approves'
    )
    .option(
      '--known-failure <why>',
      'Go to review although the checks fail — for a reason that weighs, said to the lead'
    )
    .option(
      '--fixed-by <task>',
      'With --known-failure, optional: the task that fixes what fails — or lead, when it is the lead’s to settle (a line of its)'
    )
    .option(
      '--note <text>',
      'What the lead should know as it reviews — a choice you made, what to look at — told with it'
    )
    .option(...EASE_OPTION)
    .option(...HARDEST_OPTION)
    .option(...FRICTION_OPTION)
    .option(...PLITZI_WRONG_OPTION)
    .option(...PLITZI_NO_WAY_OPTION)
    .option(...PLITZI_IN_THE_WAY_OPTION)
    .option(...HELPED_OPTION)
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action(
      (
        task: string | undefined,
        options: RunCommandOptions & {
          knownFailure?: string;
          fixedBy?: string;
          note?: string;
          found?: string;
          tasks?: string;
          closes?: string;
        } & ExperienceFlags
      ) =>
        options.found === undefined && options.tasks === undefined && options.closes === undefined
          ? taskComplete(task, options)
          : taskFound(task, options)
    );

  taskGroup
    .command('tell')
    .description(
      'Tell the run what it should know, one kind at a time: news for the lead (a finding, a choice, a risk), a question (--ask), what stops your task (--blocked), a note for whoever takes it next (--handoff), or where it stands (--standing)'
    )
    .argument('[text]', 'What to say — with --standing, what you add to it')
    .option(
      '--about <task>',
      'The task it is about — with no task in hand (a reviewer, a scout), said by your --agent name; the task blocked or handed off'
    )
    .option('--ask', 'A question for the lead: its answer comes with your next command')
    .option('--follow', 'With --ask: stay until the lead answers, giving the task’s sign of life meanwhile')
    .option(
      '--timeout <duration>',
      `With --ask --follow: give up after this long, said (90s, 8m, 1h — ${durationText(FOLLOW_MS)} when left out)`,
      duration
    )
    .option(
      '--blocked',
      'Something outside the plan stops the task: it is let go until unblocked (plitzi task unblock)'
    )
    .addOption(
      new Option(
        '--needs <who>',
        'With --blocked: who unblocks it — the lead (who asks the person when it must), or another task'
      ).choices(BLOCK_NEEDS)
    )
    .option('--handoff', 'What whoever takes the task next must know: read in its plitzi task context')
    .option('--standing', 'Where your task stands, as the lead asked: --fraction, --eta, --done, --left and --held-by')
    .option('--fraction <n>', 'With --standing: how much is done, between 0 and 1', fraction)
    .option('--eta <minutes>', 'With --standing: the minutes it still takes', count)
    .option('--done <text>', 'With --standing: what is done')
    .option('--left <text>', 'With --standing: what is left')
    .option('--held-by <text>', 'With --standing: what holds you, if something does')
    .option(...RUN_OPTION)
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((text: string | undefined, options: TellOptions) => taskTell(text ?? '', options));

  taskGroup
    .command('message')
    .description(
      'The lead tells a task — or every task in hand, or an agent by name — what it needs to know; --standing asks where it stands'
    )
    .argument('<task>', 'The task, all, or an agent as @name: it reaches it between tasks too (task next)')
    .argument('[text]', 'What to say — with --standing, what you add to the asking')
    .option('--reply-to <message>', 'The question it answers: m3')
    .option(
      '--standing',
      'Ask where it stands — a task that takes long: its agent answers with task tell --standing, and you decide on it'
    )
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action(
      (task: string, text: string | undefined, options: RunCommandOptions & { replyTo?: string; standing?: boolean }) =>
        taskMessage(task, text ?? '', options)
    );

  withVisitorOptions(
    taskGroup
      .command('look')
      .description(
        'Look at a task in review in one go: its copy served, page check from it at 1440 and 390, a picture light and dark of each page — then stopped'
      )
      .argument('<task>', 'The task in review')
      .argument(
        '[paths...]',
        'Its pages: those its files are drawn at when left out — a path with its own visitor and status in quotes: "/moderation --as juno --status 403"'
      )
      .option('--click <id>', 'Click an element once each page settles: the state it opens, looked at too')
      .option(
        '--hover <id>',
        'Put the pointer over an element once each page settles: what that changes, said, and pictured at 1440'
      )
      .option(
        '--steps <script>',
        'Played on each page before it is checked and pictured, as page play writes them — "state notice {"room":"r1"}" shows what only a message or a flow makes; another account’s (as <account> …) only in the pictures'
      )
      .option(
        '--element <id>',
        'Read an element in the page — its attributes, box and classes — once for each',
        (id: string, before: string[] = []) => (before.includes(id) ? before : [...before, id])
      )
      .option(
        '--before',
        'Each page beside the run before the task — its approved work — and what changed, section by section: what it moved, and that nothing else did (a designer’s look of the UI it reviews does it unless --no-before)'
      )
      .option('--no-before', 'Not beside the run before it: the designer’s look of the UI it reviews, as it is alone')
      .option(
        '--status <code>',
        'The status its pages are sent with — 404 for a not-found page — as page check --status',
        Number
      )
      .option('--width <px>', 'The widths looked at, comma-separated (1440,390 when left out)')
      .option(
        '--within <element>',
        'One part alone — its element’s name, a tag or any selector, as page outline takes it: pictured, and beside the run before'
      )
      .option(
        '--scheme <schemes>',
        'light, dark, or light,dark: each width in each (light at 1440, dark at 390 when left out)'
      )
      .option(...RUN_OPTION)
      .option(...JSON_OPTION),
    { url: false }
  ).action((task: string, paths: string[], options: LookOptions) => taskLook(task, paths, options));

  taskGroup
    .command('inbox')
    .description('What was said to you and you have not read: a task’s with its token, the lead’s without')
    .option('--all', 'Every message to you and from you, read or not — ← to you, → from you')
    .option('--follow', 'Stay until something is said to you')
    .option('--timeout <duration>', 'With --follow: give up after this long (90s, 8m, 1h)', duration, FOLLOW_MS)
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions & { all?: boolean; follow?: boolean; timeout?: number }) => taskInbox(options));

  taskGroup
    .command('show')
    .description(
      'A task as its lead reviews it: acceptance, checks, agreements, notes, what was said, each file’s diff, and what to run next'
    )
    .argument('[task]', 'The task — the one you hold or review when left out')
    .argument(
      '[files...]',
      'Files it changed, each whole — as the diff reads it: as it went to review, its copy, or approved'
    )
    .option(
      '--full',
      'Every line of each diff, as many files whole as one answer holds (12k characters) — each one past it said with how to read it alone; 80 lines a file otherwise'
    )
    .option(
      '--diff',
      'With files: each one’s whole diff from where the task started — the task’s own change, never another’s approved since'
    )
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action(
      (task: string | undefined, files: string[], options: RunCommandOptions & { full?: boolean; diff?: boolean }) =>
        taskShow(task, files, options)
    );

  taskGroup
    .command('review')
    .description('The lead’s or a reviewer’s verdict: --approve merges it into the run’s work; --changes sends it back')
    .argument('<task>', 'The task in review')
    .option('--approve', 'Approve it')
    .option(
      '--overwrite',
      'With --approve, over a change someone made in the project while it worked: its version wins at the finish — said, the other kept'
    )
    .option(
      '--merge',
      'With --approve, with a change someone made in the project while it worked: both put together line by line, the checks run on the result'
    )
    .option('--changes <note>', 'What to change')
    .option(
      '--on <element>',
      'The element the change is about — once for each, when it spans several',
      (id: string, before?: string) => (before === undefined ? id : `${before}, ${id}`)
    )
    .option('--file <file>', 'The file the change is about')
    .option('--note <note>', 'With --approve, what you saw and do not ask to change — kept with the task, for the lead')
    .option(
      '--escalate <why>',
      'A tester’s, instead of a verdict: what it cannot decide — what was asked reads two ways, a change past the task, a disagreement — handed to the lead'
    )
    .option(
      '--with <task>',
      'With --approve, another task in review approved beside it as one change — each reads a file the other makes'
    )
    .option(
      '--leave <tasks>',
      'With --approve, a research card’s: the tasks it proposes left out — t-a,t-b, or all (its findings kept alone); a left <id>-tests is its card with no tests'
    )
    .option(...RUN_OPTION)
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: ReviewOptions) =>
      options.escalate === undefined
        ? taskReview(task, options)
        : taskEscalate(task, { ...options, escalate: options.escalate })
    );

  taskGroup
    .command('reassign')
    .description(
      'Take a task back from its agent — its token revoked, told why — for another to take from its last reviewed version: anyone, one agent (--to dev-2), or you (--to lead)'
    )
    .argument('<task>', 'The task')
    .option('--reason <why>', 'Why: said to the agent it is taken from, and kept in its notes and the log')
    .option(
      '--to <agent>',
      'Who takes it: an agent of the team of its role — or lead, taken by you now, a copy of your own'
    )
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: RunCommandOptions & { reason?: string; to?: string }) =>
      taskReassign(task, options)
    );

  taskGroup
    .command('leave')
    .description(
      'Take a task out of the open run — and those that wait on it: whoever holds one is cut, no one takes them, and the finish writes the run without them (the lead’s)'
    )
    .argument('<task>', 'The task')
    .option('--why <why>', 'Why (required): what the report says of it — the platform’s, decided with the person…')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: RunCommandOptions & { why?: string }) => taskLeave(task, options));

  taskGroup
    .command('revert')
    .description('Take an approved task’s work back out of the run’s, before the final merge — the others’ untouched')
    .argument('<task>', 'The task')
    // Not a required option: who may revert is said before what a revert needs.
    .option('--reason <why>', 'Why (required): kept in its notes, and said to whoever takes it again')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: RunCommandOptions & { reason?: string }) => taskRevert(task, options));

  taskGroup
    .command('context')
    .description(
      'A task’s brief: what is asked, what holds for the whole run, what a review asked, what was agreed — --json for its files and diffs too'
    )
    .argument('[task]', 'The task — the token’s when left out')
    .option(
      '--files',
      'Its files as they are, whole, in the same answer — for a harness with no reader of its own: one that reads a file before editing it reads each twice'
    )
    .option(
      '--again',
      'The brief whole — the run’s primer too — though you read it in this context already: said in a line otherwise'
    )
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string | undefined, options: RunCommandOptions & { files?: boolean; again?: boolean }) =>
      taskContextCommand(task, options)
    );

  groupHelp(taskGroup, TASK_HELP);
  taskGroup.addHelpText(
    'after',
    `
Multi-agent mode: what an agent of a run uses at its task — started by plitzi run agent <name>, whose prompt says
its first command (task next … --agent <name>) and the token it passes on every command after. A job of your own is
done in the project itself, never with these. The protocol: .claude/skills/plitzi-cli/reference/runs.md`
  );

  return taskGroup;
};
