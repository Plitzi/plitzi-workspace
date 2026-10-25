import { Option } from 'commander';

import {
  runAbort,
  runAttach,
  runCanWrite,
  runContinue,
  runFinish,
  runOpen,
  runPlan,
  runRehearse,
  runPreview,
  runPrune,
  runBench,
  runReport,
  runPurge,
  runRelease,
  runResolve,
  runRestore,
  runResume,
  runShow,
  runState,
  runStatus,
  runStop,
  runMonitor,
  runUpgrade,
  runWatch,
  runKeep,
  runAllowFinish,
  runAmend,
  runExtend,
  runTeam,
  runPending,
  runTeamCheck,
  runTeamSet,
  runTeamUnset,
  runNote,
  runSettle,
  runBacklog,
  runFeedback,
  runNotice,
  runReference
} from '..';
import { runAgent } from '../agent';
import { runStart } from '../start';
import {
  AGENT_OPTION,
  EASE_OPTION,
  FRICTION_OPTION,
  HARDEST_OPTION,
  HELPED_OPTION,
  JSON_OPTION,
  RUN_OPTION,
  TOKEN_OPTION
} from './options';
import { duration, FOLLOW_MS, names, pagePaths, positiveInteger } from '../../../options';

import type {
  FinishOptions,
  PlanOptions,
  ReferenceOptions,
  RunCommandOptions,
  UpgradeRunOptions,
  WatchRunOptions
} from '..';
import type { ExperienceFlags } from '../../../runs/experience';
import type { AgentOptions } from '../agent';
import type { StartOptions } from '../start';
import type { TeamSetOptions } from '../team';
import type { Command } from 'commander';

/**
 * Each command of `plitzi run`, by who runs it: a person new to it reads the four or five that are theirs first, not
 * thirty-five in the order they were written.
 */
const RUN_HELP: readonly { heading: string; commands: readonly string[] }[] = [
  {
    heading: 'Start and follow a run — you, or the agent you ask:',
    commands: ['start', 'agent', 'monitor', 'watch', 'keep', 'status', 'state', 'preview', 'pending', 'team']
  },
  {
    heading: 'Yours alone — what writes into the project, or throws work away:',
    commands: ['finish', 'allow-finish', 'abort', 'restore', 'purge', 'resolve', 'continue', 'upgrade']
  },
  {
    heading: "The lead's — the agent that plans, reviews and closes:",
    commands: [
      'open',
      'plan',
      'rehearse',
      'extend',
      'amend',
      'reference',
      'note',
      'notice',
      'backlog',
      'report',
      'bench',
      'stop',
      'resume',
      'show',
      'can-write',
      'attach',
      'release',
      'prune'
    ]
  }
];

/** Puts each command under its heading in `run --help`: one left out of the table goes under the last. */
export const groupHelp = (group: Command, table: readonly { heading: string; commands: readonly string[] }[]): void => {
  for (const command of group.commands) {
    const heading = table.find(each => each.commands.includes(command.name()))?.heading ?? table.at(-1)?.heading;
    if (heading) {
      command.helpGroup(heading);
    }
  }
};

/** `plitzi run …`: its commands, registered on the program. */
export const registerRunGroup = (program: Command): Command => {
  const runGroup = program
    .command('run')
    .description(
      'Multi-agent: a team of agents — several, in parallel — on one project, tasks in copies of it merged once by you. Only when asked for a team (plitzi run start "…")'
    );

  runGroup
    .command('start')
    .description(
      'A team of agents on the project, from one command: what it needs checked, the run opened on its scope, and every step after it said'
    )
    .argument('<ask>', 'What the team is to do: "Translate the site into Catalan"')
    .option('--run <name>', 'The run’s name (the ask’s first words when left out)')
    .option('--reference <site>', 'The site the run copies — https://www.example.com — kept for --compare')
    .option('--harness <harness>', 'Where its agents start: claude, codex or opencode — checked to be installed')
    .option(
      '--despite-checks <why>',
      'Open it though the project fails its own checks — why, told to every task (it is refused otherwise)'
    )
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((ask: string, options: StartOptions) => runStart(ask, options));

  runGroup
    .command('agent')
    .description(
      'An agent of the team started: its prompt, and the command that starts it headless — --launch starts it now'
    )
    .argument('<name>', 'The agent, as the team names it (dev-1, design-1, lead-2) — or lead')
    .option('--launch', 'Start it now, in the background: its output kept beside its prompt, in the run’s scratch')
    .option('--harness <harness>', 'With --launch: claude, codex or opencode (the one installed, when only one is)')
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((name: string, options: AgentOptions) => runAgent(name, options));

  runGroup
    .command('plan')
    .description('Hold a plan the lead wrote to the rules — disjoint files, no cycles — expand it and estimate it')
    .argument(
      '<file>',
      'The plan, JSON: { version: 1, runId, goal, tasks: [{ id, title, files, dependsOn, priority, estimateMinutes, acceptance }] }'
    )
    .option(...JSON_OPTION)
    .action((file: string, options: PlanOptions) => runPlan(file, options));

  runGroup
    .command('extend')
    .description(
      'Stack the next plan on an open run: its tasks begin from the run’s work, and one finish writes both into the project'
    )
    .argument('<run-or-file>', 'The open run — or, alone, the next plan: the run is then the one open')
    .argument('[file]', 'The next plan')
    .option('--dry-run', 'Check the stage against the run as it is — its tasks, what is ready — and stack nothing')
    .option(
      '--lines',
      'With --dry-run: run each acceptance line once on the run’s work, and say what it is — what the task changes, a part it builds, or a line that cannot pass (the other site has no such element, a command it refuses)'
    )
    .option(...JSON_OPTION)
    .action((first: string, file: string | undefined, options: PlanOptions & { dryRun?: boolean; lines?: boolean }) =>
      file === undefined ? runExtend(undefined, first, options) : runExtend(first, file, options)
    );

  runGroup
    .command('pending')
    .description(
      'The runs of this project not yet written into it — ready ones first, each with the command that applies it'
    )
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => runPending(options));

  const team = runGroup
    .command('team')
    .description(
      'Who works this project’s runs — .plitzi/team.json, the project’s: the lead and each agent, its roles, how many and its model'
    )
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => runTeam(options));

  team
    .command('set')
    .description('Add an agent to the team or change one — lead for the lead’s model — said before and after')
    .argument('<name>', 'The agent: dev is dev-1, dev-2… — or lead')
    .option(
      '--roles <roles>',
      'What it takes: developer, designer, reviewer, tester, writer… — several with commas',
      names
    )
    .option('--count <n>', 'How many agents of it', positiveInteger)
    .option(
      '--min <n>',
      'How many of them start with the run: the rest are on demand — started when work waits, stopped when none is left',
      positiveInteger
    )
    .option('--model <model>', 'The harness’s own name for it: claude-sonnet-5-5')
    .option(
      '--effort <effort>',
      'How hard it thinks: low, medium, high, xhigh, max (Claude Code’s --effort, Codex’s reasoning effort)'
    )
    .option(
      '--session <mode>',
      'When its agents start again with a fresh context, between two pieces of work: task (after each task or review, the default), context (past options.freshContextAt), keep (never)'
    )
    .option(
      '--resume-session',
      'Started again after it died mid-task, an agent resumes its own session (Claude Code) — what it knew kept'
    )
    .option('--no-resume-session', 'Started again after it died mid-task, an agent starts a fresh session')
    .option(...JSON_OPTION)
    .action((name: string, options: TeamSetOptions) => runTeamSet(name, options));

  team
    .command('unset')
    .description('Take an agent out of the team — or, for lead, the lead’s own model')
    .argument('<name>', 'The agent, or lead')
    .option(...JSON_OPTION)
    .action((name: string, options: RunCommandOptions) => runTeamUnset(name, options));

  team
    .command('check')
    .description('Whether .plitzi/team.json is a team the runs read as written — every wrong or unknown field said')
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => runTeamCheck(options));

  runGroup
    .command('rehearse')
    .description(
      'Play a plan out before any agent starts: who works what when, the critical path, the lead’s reviews, the files several tasks change at once, and how many agents are worth it — nothing opened'
    )
    .argument('<file>', 'The plan, as plitzi run plan takes it')
    .option('--review <duration>', 'How long the lead takes over one review (90s, 8m)', duration, 5 * 60_000)
    .option(...JSON_OPTION)
    .action((file: string, options: PlanOptions & { review?: number }) => runRehearse(file, options));

  runGroup
    .command('open')
    .description(
      'Open a run from a plan: its folder, every file it touches backed up — a person confirms above the threshold. Or on the ask alone (--spike): one spike, the scope, whose result is the tasks'
    )
    .argument('[file]', 'The plan — left out with --spike')
    .option(
      '--spike <ask>',
      'The person’s ask, with no plan: the run opens on its scope, a lead’s spike that ends with the tasks (plitzi task spike s-scope --done "…" --tasks <stage.json>)'
    )
    .option('--run <name>', 'With --spike: the run’s name')
    .option(
      '--despite-checks <why>',
      'Open it though the project fails its own checks — why, told to every task (it is refused otherwise)'
    )
    .option(
      '--reference <site>',
      'With --spike: the site the run copies — https://www.example.com — kept by run reference'
    )
    .option(
      '--lead-finishes',
      'Let the lead write the run into the project itself once its report is written and the checks pass — a person confirms it in their terminal'
    )
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((file: string | undefined, options: PlanOptions) => runOpen(file, options));

  runGroup
    .command('allow-finish')
    .description(
      'A person lets the lead of an open run write it into the project itself (finish --apply), once its report is written and the checks pass — --revoke takes it back'
    )
    .argument('[run]', 'The run — the only open one when left out')
    .option('--revoke', 'Take it back: a person writes the run into the project')
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: RunCommandOptions & { revoke?: boolean }) =>
      runAllowFinish(run, options)
    );

  runGroup
    .command('state')
    .description('Every run of the project, and where it stands')
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => runState(options));

  runGroup
    .command('status')
    .description('A run at a glance: a line per task, then what needs attention')
    .argument('[run]', 'The run — the only open one when left out')
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: RunCommandOptions) => runStatus(run, options));

  runGroup
    .command('note')
    .description(
      'Tell every task what holds for the whole run — a known issue, a decision: the ones in hand and those taken later'
    )
    .argument('<text>', 'The note — or - to read it from stdin')
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((text: string, options: RunCommandOptions) => runNote(text, options));

  runGroup
    .command('settle')
    .description(
      'Say what you did about a finding the run raised to you — an agent that went on after it was told to stop, a check that answered two ways — and it leaves your attention, your note kept for the report'
    )
    .argument('<finding>', 'The finding, as run watch names it (after-stop:dev-2, flaky:t-home:…)')
    .requiredOption(
      '--note <text>',
      'What you did about it: looked and found it harmless, amended the line, told Plitzi'
    )
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((finding: string, options: RunCommandOptions & { note: string }) => runSettle(finding, options));

  runGroup
    .command('reference')
    .description(
      'Keep the plan’s reference site as it is now — each page of the inventory pictured and measured at 1440 and 390, both schemes — for page shot --compare to measure against while the run works; the run finishing removes it'
    )
    .option('--pages <paths>', 'The pages to keep, by path, comma-separated: the inventory’s when left out', pagePaths)
    .option(...RUN_OPTION)
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((options: ReferenceOptions) => runReference(options));

  runGroup
    .command('notice')
    .description(
      'Something wrong you saw that no task owns — outside yours, there before the run: kept for the finish and the next stage, never fixed in your task'
    )
    .argument('<text>', 'What is wrong — or - to read it from stdin')
    .option('--on <where>', 'Where it is: a page, an element, a file')
    .option(
      '--plitzi',
      'Of Plitzi itself — the CLI, the platform, its docs — not of the project: for the run’s feedback to Plitzi, never the project’s backlog'
    )
    .option(...TOKEN_OPTION)
    .option(...RUN_OPTION)
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((text: string, options: RunCommandOptions & { on?: string; plitzi?: boolean }) => runNotice(text, options));

  runGroup
    .command('feedback')
    .description(
      'What the run says of Plitzi itself — written by the finish too: its agents’ notices of Plitzi, the refusals, the crashes, the checks no one’s work failed — for Plitzi’s team'
    )
    .argument('[run]', 'The run')
    .option(...TOKEN_OPTION)
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: RunCommandOptions) => runFeedback(run, options));

  runGroup
    .command('backlog')
    .description(
      'What is left to do, kept in .plitzi/backlog.json for the next run — what runs noticed, or add "…" with none open; done <id> closes one, saying how'
    )
    .argument('[action]', 'add, to keep an item; done, to close one')
    .argument('[item]', 'With add: what to do, in words; with done: the item it closes, b-3')
    .option('--on <where>', 'With add: where it is — a page, an element, a file')
    .option('--note <how>', 'With done: how it was done, or why it is no longer wanted')
    .option('--all', 'The closed items too')
    .option(...JSON_OPTION)
    .action(
      (
        action: string | undefined,
        id: string | undefined,
        options: RunCommandOptions & { note?: string; all?: boolean; on?: string }
      ) => runBacklog(action, id, options)
    );

  runGroup
    .command('amend')
    .description(
      'Correct what the open run asks — a task’s title, acceptance, priority or estimate, the goal, a note more — from its plan file edited; each task changed is told'
    )
    .argument('<run-or-file>', 'The open run — or, alone, the plan: the run is then the one open')
    .argument(
      '[file]',
      'The plan, edited — the run’s, or a stage’s as it was stacked: the same tasks, files and dependencies'
    )
    .option(...RUN_OPTION)
    .option(...JSON_OPTION)
    .action((first: string, file: string | undefined, options: RunCommandOptions) =>
      file === undefined ? runAmend(undefined, first, options) : runAmend(first, file, options)
    );

  runGroup
    .command('monitor')
    .description(
      'A run, live, for a person — in a terminal of its own, beside the harness: its tasks, its leads, what needs someone; it only reads'
    )
    .argument('[run]', 'The run — the only open one when left out')
    .option(
      '--interval <seconds>',
      'How often it reads the run anyway (5): it follows the run live, as the CLI writes it',
      positiveInteger
    )
    .action((run: string | undefined, options: RunCommandOptions & { interval?: number }) => runMonitor(run, options));

  runGroup
    .command('watch')
    .description(
      'Follow a run: printed again whenever it changes, until it finishes — one JSON object a line with --json'
    )
    .argument('[run]', 'The run — the only open one when left out')
    .option('--interval <seconds>', 'How often to look (2; 10 with --until lead)', positiveInteger)
    .addOption(
      new Option(
        '--until <who>',
        'End the moment something new needs them — a review, a question, a block, a notice — each said once'
      ).choices(['lead'])
    )
    .option(
      '--timeout <duration>',
      'With --until: how long to wait before ending with nothing new (90s, 8m, 1h; a number is minutes)',
      duration,
      FOLLOW_MS
    )
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: WatchRunOptions) => runWatch(run, options));

  runGroup
    .command('keep')
    .description(
      "The run's keeper: starts the agents the run asks for — its base when not running, one on demand for waiting work — in the team's options.launch harness, until the run is gone. The run starts it"
    )
    .argument('[run]', 'The run')
    .option(...AGENT_OPTION)
    .option(...TOKEN_OPTION)
    .action((run: string | undefined, options: RunCommandOptions) => runKeep(run, options));

  runGroup
    .command('can-write')
    .description(
      'Whether a file may be written: no — with the task and until when — if a task of any open run holds it. For any hook'
    )
    .argument('<file>', 'The project file')
    .option('--task <task>', 'The task asking, when it has no token at hand')
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((file: string, options: RunCommandOptions & { task?: string }) => runCanWrite(file, options));

  runGroup
    .command('stop')
    .description(
      'Stop a run: the tasks in hand finish and go to review, none starts. --force is a person’s: it cuts them now'
    )
    .argument('[run]', 'The run')
    .option('--force', 'Now: tokens revoked, what was written since the last review discarded')
    .option(...AGENT_OPTION)
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: RunCommandOptions & { force?: boolean }) => runStop(run, options));

  runGroup
    .command('upgrade')
    .description(
      'A person’s: upgrade Plitzi under an open run — stopped gently, upgraded once nothing is being written, re-pinned and resumed'
    )
    .argument('[run]', 'The run')
    .option('--install <command>', 'What upgrades, run in the project (plitzi upgrade --write --with-open-runs)')
    .option(
      '--timeout <duration>',
      'How long to wait for the tasks in hand (90s, 8m, 1h; a number is minutes)',
      duration
    )
    .action((run: string | undefined, options: UpgradeRunOptions) => runUpgrade(run, options));

  runGroup
    .command('resume')
    .description('Open a stopped run again')
    .argument('[run]', 'The run')
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: RunCommandOptions) => runResume(run, options));

  runGroup
    .command('finish')
    .description(
      'The whole run into the project: a dry run with the checks on the result; --apply, a person’s, writes it'
    )
    .argument('[run]', 'The run')
    .option('--apply', 'Write it — a person, typing the run’s name')
    .option('--leave-pending', 'Finish without the tasks not done, said as such')
    .option(
      '--keep-backup',
      'Keep the project’s files as they were before the merge, in tmp/plitzi-backups/ — off by default'
    )
    .option(...TOKEN_OPTION)
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: FinishOptions) => runFinish(run, options));

  runGroup
    .command('preview')
    .description('The run’s work as it goes, served by the project’s dev server: each approval shows in it')
    .argument('[run]', 'The run')
    .option('--task <task>', 'A task in review instead: its copy as it went to review, to look at before approving it')
    .option('--port <port>', 'Where to serve it (8300; 8301 with --task)', positiveInteger)
    .action((run: string | undefined, options: RunCommandOptions & { port?: number; task?: string }) =>
      runPreview(run, options)
    );

  runGroup
    .command('report')
    .description('How the run went, as the CLI saw it — and, with --summary, the lead’s summary that closes it')
    .argument('[run]', 'The run')
    .option(
      '--summary <file>',
      'The lead’s report: what the run did, what went wrong that no record says, what is left (Markdown) — with --ease and --hardest'
    )
    .option(...EASE_OPTION)
    .option(...HARDEST_OPTION)
    .option(...FRICTION_OPTION)
    .option(...HELPED_OPTION)
    .option('--full', 'The whole report — each finding with its evidence and fix, the flow, the cost, the bench')
    .option(...JSON_OPTION)
    .action(
      (run: string | undefined, options: RunCommandOptions & { summary?: string; full?: boolean } & ExperienceFlags) =>
        runReport(run, options)
    );

  runGroup
    .command('bench')
    .description(
      'Every run of the project measured the same way, oldest first: minutes a task, rounds, checks failed, waits, cost'
    )
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => runBench(options));

  runGroup
    .command('resolve')
    .description(
      'Settle one file of a reconciliation: the project’s version, the run’s, both merged, or a file of yours'
    )
    .argument('<run>', 'The run')
    .argument('<file>', 'The file under reconciliation')
    .requiredOption(
      '--take <version>',
      'project, run, merge (both changes line by line, when they touch different lines), or the path of a file holding the version to keep'
    )
    .option(...JSON_OPTION)
    .action((run: string, file: string, options: RunCommandOptions & { take: string }) =>
      runResolve(run, file, options)
    );

  runGroup
    .command('continue')
    .description('Every file resolved: the run goes on — a person’s')
    .argument('[run]', 'The run')
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: RunCommandOptions) => runContinue(run, options));

  runGroup
    .command('abort')
    .description('End the run writing nothing into the project, and remove it with its agents’ work — a person’s')
    .argument('[run]', 'The run')
    .option(...JSON_OPTION)
    .action((run: string | undefined, options: RunCommandOptions) => runAbort(run, options));

  runGroup
    .command('restore')
    .description('Put one project file back from a backup — a person’s')
    .argument('<run>', 'The run')
    .argument('<file>', 'The project file')
    .option('--from <backup>', 'base (when the run opened) or a merge (before it)', 'base')
    .option(...JSON_OPTION)
    .action((run: string, file: string, options: RunCommandOptions & { from?: string }) =>
      runRestore(run, file, options)
    );

  runGroup
    .command('show')
    .description('A version of a file the run keeps: the run’s, the backup when it opened, or the project’s')
    .argument('<run>', 'The run')
    .argument('<file>', 'The project file')
    .addOption(new Option('--version <which>', 'Which one').choices(['run', 'base', 'project']).default('run'))
    .option(...JSON_OPTION)
    .action((run: string, file: string, options: RunCommandOptions & { version?: 'run' | 'base' | 'project' }) =>
      runShow(run, file, options)
    );

  runGroup
    .command('attach')
    .description(
      'Pick a run up: after the harness died, on another machine (--take-over, a person’s), after an upgrade'
    )
    .argument('<run>', 'The run')
    .option('--take-over', 'Take it from the machine it is active on')
    .option(...AGENT_OPTION)
    .option(...JSON_OPTION)
    .action((run: string, options: RunCommandOptions & { takeOver?: boolean }) => runAttach(run, options));

  runGroup
    .command('release')
    .description('Let a run go from this machine, so another can attach to it')
    .argument('<run>', 'The run')
    .option(...JSON_OPTION)
    .action((run: string, options: RunCommandOptions) => runRelease(run, options));

  runGroup
    .command('purge')
    .description('Remove a run’s folder, backups included — a person’s')
    .argument('<run>', 'The run')
    .option(...JSON_OPTION)
    .action((run: string, options: RunCommandOptions) => runPurge(run, options));

  runGroup
    .command('prune')
    .description('Remove the caches of a run idle for 8 hours — never its backups or its approved work')
    .option(...JSON_OPTION)
    .action((options: RunCommandOptions) => runPrune(options));

  groupHelp(runGroup, RUN_HELP);
  runGroup.addHelpText(
    'after',
    `
A run, from the ask to your project — multi-agent mode, only when you ask for a team:
  1. plitzi run start "<what you want>"   the project checked, the run opened on its scope (your agent is its lead)
  2. the lead scopes it: what the job takes, written as tasks, each with how it is checked
  3. plitzi run agent <name> --launch --harness claude|codex|opencode   each agent of .plitzi/team.json started
  4. plitzi run monitor                  follow it; npm run start:preview serves the approved work as it grows
  5. plitzi run finish --apply           yours: the work into the project once you read the lead's report
     plitzi run abort                    yours: the run ended, nothing written — it leaves no trace
Nothing touches the project before step 5. The guide: https://docs.plitzi.com/guides/team`
  );

  return runGroup;
};
