import { Option } from 'commander';

import {
  taskAnswer,
  taskAsk,
  taskBlock,
  taskClaim,
  taskCheck,
  taskClaims,
  taskComplete,
  taskContextCommand,
  taskShow,
  taskTell,
  taskDiscard,
  taskInbox,
  taskLook,
  taskMessage,
  taskNext,
  taskNote,
  taskProgress,
  taskPropose,
  taskProposals,
  taskReassign,
  taskRelease,
  taskRequest,
  taskReview,
  taskRevert,
  taskTake,
  taskUnblock,
  taskWait
} from '..';
import { JSON_OPTION, TOKEN_OPTION, RUN_OPTION, AGENT_OPTION } from './options';
import { duration, FOLLOW_MS, fraction } from '../../../options';
import { NEEDS } from '../../../runs/model';

import type { AnswerOptions, LookOptions, ProposeOptions, ReviewOptions, RunCommandOptions } from '..';
import type { Command } from 'commander';

/** `plitzi task …`: its commands, registered on the program. */
export const registerTaskGroup = (program: Command): Command => {
  const taskGroup = program
    .command('task')
    .description(
      'A task of a run: taken, worked in its copy, completed, reviewed — and what it shares with the others'
    );

  taskGroup
    .command('next')
    .description('The ready task to take: highest priority, then the longest chain still to do')
    .option(
      '--role <roles>',
      'Only a task for these roles, separated by commas: developer, designer, reviewer, tester, writer…'
    )
    .option('--follow', 'Wait until one is ready — or every task of the role is done (finished: true)')
    .option('--take', 'Take it too, in the same breath: one another agent took meanwhile is passed for the next')
    .option('--timeout <duration>', 'With --follow: give up after this long, said (90s, 8m, 1h)', duration, FOLLOW_MS)
    .addOption(
      new Option(
        '--quality <level>',
        'The level this agent was started at: only tasks of it or below (PLITZI_QUALITY otherwise)'
      ).choices(['light', 'standard', 'high'])
    )
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions & { role?: string; follow?: boolean; timeout?: number; take?: boolean }) =>
      taskNext(options)
    );

  taskGroup
    .command('take')
    .description('Take a task: its files locked, its copy made, and its token answered')
    .argument('<task>', 'The task')
    .option('--role <role>', 'The role taking it: refused for another role’s task')
    .option(...RUN_OPTION)
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: RunCommandOptions & { role?: string }) => taskTake(task, options));

  taskGroup
    .command('claims')
    .description('Which files each task locks, why and since when')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => taskClaims(options));

  taskGroup
    .command('claim')
    .description('Take a shared file by turns')
    .argument('<file>', 'The project file')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((file: string, options: RunCommandOptions) => taskClaim(file, options));

  taskGroup
    .command('release')
    .description('Let a file held by turns go to the next task waiting for it')
    .argument('<file>', 'The project file')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((file: string, options: RunCommandOptions) => taskRelease(file, options));

  taskGroup
    .command('wait')
    .description(
      'Wait for a file another task holds; it comes with the approved version. Exits 11, or with --follow stays until it is yours'
    )
    .argument('<file>', 'The project file')
    .option('--follow', 'Stay until the file is yours, giving the task’s sign of life meanwhile')
    .option(
      '--timeout <duration>',
      'With --follow: give up after this long, said, exit 11 (90s, 8m, 1h)',
      duration,
      FOLLOW_MS
    )
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((file: string, options: RunCommandOptions & { follow?: boolean; timeout?: number }) =>
      taskWait(file, options)
    );

  taskGroup
    .command('discard')
    .description('Put a file of your copy back to the run’s version now, and start from it')
    .argument('<file>', 'The project file')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((file: string, options: RunCommandOptions) => taskDiscard(file, options));

  taskGroup
    .command('progress')
    .description('Where the task is: its fraction and step — a heartbeat too')
    .option('--fraction <n>', 'Between 0 and 1', fraction)
    .option('--step <step>', 'What it is on: "page 3 of 5"')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions & { fraction?: number; step?: string }) => taskProgress(options));

  taskGroup
    .command('heartbeat')
    .description('A sign of life, for a long think or test run with no write — at least every 2 minutes')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => taskProgress(options));

  taskGroup
    .command('block')
    .description('Something outside the plan stops it — said, never waited on silently')
    .argument('[task]', 'The task — the token’s when left out')
    .requiredOption('--reason <reason>', 'What stops it: "an API key is missing"')
    .addOption(new Option('--needs <who>', 'Who unblocks it').choices(NEEDS).default('person'))
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action(
      (task: string | undefined, options: RunCommandOptions & { reason: string; needs?: (typeof NEEDS)[number] }) =>
        taskBlock(task, options)
    );

  taskGroup
    .command('unblock')
    .description('Lift a block — the lead’s or a person’s')
    .argument('<task>', 'The task')
    .option('--answer <text>', 'What it waited for, said to the task: it reaches its agent with its next command')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: RunCommandOptions & { answer?: string }) => taskUnblock(task, options));

  taskGroup
    .command('note')
    .alias('handoff')
    .description('What whoever comes next must know: a note, a handoff')
    .argument('<text>', 'The note')
    .option('--task <task>', 'The task — the token’s when left out')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((text: string, options: RunCommandOptions & { task?: string }) => taskNote(options.task, text, options));

  taskGroup
    .command('request')
    .description('Ask for a change in a shared file: change it in your copy too; one integration task applies them all')
    .argument('<file>', 'The shared file')
    .requiredOption('--summary <text>', 'The change and why: "a language tag on cards"')
    .option('--used-in <files>', 'Where you use it, comma-separated')
    .option('--blocking', 'It cannot wait: its integration task is made now, and this task waits for it')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((file: string, options: RunCommandOptions & { summary: string; usedIn?: string; blocking?: boolean }) =>
      taskRequest(file, options)
    );

  taskGroup
    .command('propose')
    .description(
      'Ask another task to agree to a change — to make it, or to accept it in its work; --wait for the answer'
    )
    .argument('<task>', 'The task asked')
    .requiredOption('--change <change>', 'The change, specifically: "the card takes a `lang` prop"')
    .option('--about <file>', 'The file it is about')
    .option('--why <why>', 'Why this task needs it')
    .option('--wait', 'Wait for the answer; go on with what does not need it')
    .option('--follow', 'Stay until the answer comes, giving the task’s sign of life meanwhile')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: ProposeOptions) => taskPropose(task, options));

  taskGroup
    .command('answer')
    .description('Answer a proposal made to your task — or, as the lead, to any: accept, reject or counter it')
    .argument('<proposal>', 'The proposal: t-home-p1')
    .option('--accept', 'Agree: both tasks carry it into review')
    .option('--reject <why>', 'Refuse it, saying why')
    .option('--counter <change>', 'Propose a change instead — three rounds at most, then the lead decides')
    .option('--note <note>', 'A note with an acceptance')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((proposal: string, options: AnswerOptions) => taskAnswer(proposal, options));

  taskGroup
    .command('proposals')
    .description('The proposals between tasks and their answers — your task’s, with its token')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => taskProposals(options));

  taskGroup
    .command('check')
    .description(
      'What complete would hold your copy to — the checks, the acceptance’s commands, long files — run now; nothing changes'
    )
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => taskCheck(options));

  taskGroup
    .command('complete')
    .description('Finish the task: its copy compared by fingerprint, the project’s checks run in it, and to review')
    .option(
      '--known-failure <why>',
      'Go to review although the checks fail — for a reason that weighs, said to the lead'
    )
    .option('--fixed-by <task>', 'With --known-failure: the task that fixes what fails')
    .option(
      '--review <kind>',
      'The review it asks for: code (the lead’s alone — nothing a visitor sees changed) or ui (its UI by a designer, or the lead, then the code); the run decides when left out'
    )
    .option(
      '--note <text>',
      'What the lead should know as it reviews — a choice you made, what to look at — told with it'
    )
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action(
      (options: RunCommandOptions & { knownFailure?: string; fixedBy?: string; note?: string; review?: string }) =>
        taskComplete(options)
    );

  taskGroup
    .command('tell')
    .description('Tell the lead what it should know — a finding, a choice you made, a risk — when no answer is needed')
    .argument('<text>', 'What to tell')
    .option('--about <task>', 'The task it is about — with no task in hand (a reviewer), said by your --agent name')
    .option(...RUN_OPTION)
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((text: string, options: RunCommandOptions & { about?: string }) => taskTell(text, options));

  taskGroup
    .command('ask')
    .description('Ask the lead — stuck or unsure: the answer comes with your next command, or --follow for it')
    .argument('<text>', 'The question')
    .option('--follow', 'Stay until the lead answers, giving the task’s sign of life meanwhile')
    .option('--timeout <duration>', 'With --follow: give up after this long, said (90s, 8m, 1h)', duration, FOLLOW_MS)
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((text: string, options: RunCommandOptions & { follow?: boolean; timeout?: number }) =>
      taskAsk(text, options)
    );

  taskGroup
    .command('message')
    .description('The lead tells a task — or every task in hand, or an agent by name — what it needs to know')
    .argument('<task>', 'The task, all, or an agent as @name: it reaches it between tasks too (task next)')
    .argument('<text>', 'What to say')
    .option('--reply-to <message>', 'The question it answers: m3')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, text: string, options: RunCommandOptions & { replyTo?: string }) =>
      taskMessage(task, text, options)
    );

  taskGroup
    .command('look')
    .description(
      'Look at a task in review in one go: its copy served, page check from it at 1440 and 390, a picture light and dark of each page — then stopped'
    )
    .argument('<task>', 'The task in review')
    .argument('[paths...]', 'Its pages: those its files are drawn at when left out')
    .option('--click <id>', 'Click an element once each page settles: the state it opens, looked at too')
    .option(
      '--hover <id>',
      'Put the pointer over an element once each page settles: what that changes, said, and pictured at 1440'
    )
    .option(
      '--element <id>',
      'Read an element in the page — its attributes, box and classes — once for each',
      (id: string, before: string[] = []) => (before.includes(id) ? before : [...before, id])
    )
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, paths: string[], options: LookOptions) => taskLook(task, paths, options));

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
    .argument('<task>', 'The task')
    .argument(
      '[file]',
      'One file it changed, whole — as the diff reads it: as it went to review, its copy, or approved'
    )
    .option('--full', 'Every line of each diff — cut at 80 a file otherwise')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, file: string | undefined, options: RunCommandOptions & { full?: boolean }) =>
      taskShow(task, file, options)
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
    .option(
      '--skip-design <why>',
      'With --approve, a task whose UI waits for a designer’s review, approved without it — why: lead (you looked at its UI yourself) or no-ui (it changes nothing a visitor sees)'
    )
    .option('--note <note>', 'With --approve, what you saw and do not ask to change — kept with the task, for the lead')
    .option(...RUN_OPTION)
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: ReviewOptions) => taskReview(task, options));

  taskGroup
    .command('reassign')
    .description('Cut a task — its holder’s token revoked — for another to take from its last reviewed version')
    .argument('<task>', 'The task')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string, options: RunCommandOptions) => taskReassign(task, options));

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
    .option('--files', 'Its files as they are, and the shape of the data they import, in the same answer')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((task: string | undefined, options: RunCommandOptions & { files?: boolean }) =>
      taskContextCommand(task, options)
    );

  return taskGroup;
};
