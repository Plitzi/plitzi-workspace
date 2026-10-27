import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { issueToken } from '../../../runs/agents/identity';
import { ensureKeeper, keeperText, leadStartText } from '../../../runs/agents/keeper';
import {
  heldRoles,
  ensureTeam,
  leadModelText,
  readTeam,
  startText,
  startedAgents,
  TEAM_FILE,
  teamSize,
  SCOUT,
  teamTakes,
  TESTER
} from '../../../runs/agents/team';
import { writeJson } from '../../../runs/core/files';
import { runPaths } from '../../../runs/core/paths';
import { RunRefusal } from '../../../runs/core/refusal';
import { usageCaller } from '../../../runs/core/usage';
import { amendRun } from '../../../runs/plan/amend';
import { backlogOfPlan, backlogText } from '../../../runs/plan/backlog';
import { atPace } from '../../../runs/plan/estimate';
import { extendRun } from '../../../runs/plan/extend';
import { rehearsalText, rehearse } from '../../../runs/plan/rehearse';
import { isResearch, opensOnResearch, roleOf, SCOPE_SPIKE, scopePlan } from '../../../runs/plan/spike';
import { triedText } from '../../../runs/plan/tryLines';
import { settleFinding } from '../../../runs/report/settle';
import {
  activeRuns,
  allowLeadFinish,
  loadRun,
  checkPlanFile,
  openRun,
  pruneRuns,
  readCheckedPlan,
  readPlanFile
} from '../../../runs/run';
import { LEAD } from '../../../runs/talk/messages';
import { reviewRolesOf, reviewSteps, reviewTeamFrom } from '../../../runs/tasks/reviews';
import { glimpse } from '../../../runs/view/feedLine';
import { planSkills } from '../../project/upgrade';
import { act, opener, runOf } from '../shell';
import { list, pacedText } from '../text';

import type { Team } from '../../../runs/agents/team';
import type { RunRecord, RunTask } from '../../../runs/core/model';
import type { RunContext } from '../../../runs/run';
import type { RunCommandOptions } from '../shell';

/**
 * A run's plan: checked (`run open --dry-run`, as its next stage when a run is open), rehearsed, opened, stacked, amended and
 * noted — and the lead allowed to apply it.
 */

/**
 * What earlier runs noticed and left, said where the next is planned and opened: what the plan takes up — a task's
 * `closes`, closed as the run is applied — and what no task does, which the run takes up or leaves open.
 */
const backlogLines = ({ taken, researched, untaken }: Awaited<ReturnType<typeof backlogOfPlan>>): string[] => [
  ...(taken.length === 0
    ? []
    : [
        `Of the project's backlog, this plan takes up ${String(taken.length)} — closed as the run is applied: ${taken.map(each => `${each.item.id} (${each.task})`).join(', ')}`
      ]),
  ...(researched.length === 0
    ? []
    : [
        `Its research looks into ${researched.map(each => `${each.item.id} (${each.task})`).join(', ')} — the tasks it proposes close ${researched.length === 1 ? 'it' : 'them'} ("closes")`
      ]),
  ...(untaken.length === 0
    ? []
    : [
        chalk.yellow(
          `The project's backlog has ${String(untaken.length)} open that no task of ${taken.length === 0 ? 'the plan' : 'it'} takes up — what earlier runs noticed and left: take it up in this run (a task's "closes"), or leave it (plitzi run backlog):`
        ),
        ...untaken.map(item => `  · ${backlogText(item)}`)
      ])
];

export interface PlanOptions extends RunCommandOptions {
  /** `run open`: a person lets the lead write the run into the project itself. */
  leadFinishes?: boolean;
  /** `run open`: the person's ask, with no plan — the run opens on one spike, its scope, the lead's. */
  spike?: string;
  /** `run start`: the site the run copies, as a plan's `reference` says it. */
  reference?: string;
  /** `run open`: why the run opens though the project fails its own checks — told to every task. */
  despiteChecks?: string;
}

/**
 * The plan `run open` opens: the file named — or, with `--spike`, one written for the ask in the project's `tmp/`,
 * moved into the run's folder as any plan is: the scope, the run's first spike, whose result is its tasks.
 */
const planToOpen = async (ctx: RunContext, file: string | undefined, options: PlanOptions): Promise<string> => {
  if (options.spike === undefined) {
    if (file === undefined) {
      throw new RunRefusal(
        'invalid',
        'Name the plan — plitzi run open <plan.json> — or open the run on the ask alone: plitzi run start "…" --run <name>'
      );
    }

    return path.resolve(file);
  }

  if (file !== undefined) {
    throw new RunRefusal(
      'invalid',
      `A plan or a spike: ${file} is a plan already — --spike opens a run on the ask alone, its scope the first task`
    );
  }

  if (options.run === undefined || options.spike.trim() === '') {
    throw new RunRefusal('invalid', 'Say the ask and name the run: plitzi run start "…" --run es-launch');
  }

  const written = path.join(ctx.root, 'tmp', `${options.run}.plan.json`);
  await writeJson(written, scopePlan(options.run, options.spike.trim(), options.reference));

  return written;
};

export const runAllowFinish = (
  runId: string | undefined,
  options: RunCommandOptions & { revoke?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => allowLeadFinish(ctx, await runOf(ctx, options, runId), { revoke: options.revoke ?? false }),
    allowed =>
      allowed.leadFinishes
        ? `The lead of "${allowed.runId}" may now write it into the project itself — once its report is written and the checks pass on the whole result (plitzi run finish --apply). Take it back: plitzi run finish --no-lead-finishes`
        : `The lead of "${allowed.runId}" may no longer write it into the project: a person does (plitzi run finish --apply).`
  );

/**
 * Who to start, from the project's `.plitzi/team.json`: the lead's model, then each agent — its roles, its model, the
 * plan's tasks it takes and the command it takes them with — so a model chosen for designers works only their tasks.
 */
export const startLines = (tasks: readonly RunTask[], team: Team): string[] => {
  const reviewTeam = reviewTeamFrom(team);

  return [
    `Start the team (${TEAM_FILE}):`,
    `  lead — ${leadModelText(team.lead)} — you: plan, review what research finds, answer, decide what is escalated and finish — what waits for you comes in the queue (plitzi task next --role lead --no-wait)${teamTakes(team, TESTER) ? '' : '; with no tester in the team, the tester’s steps of every review are yours too'}`,
    ...startedAgents(team).map(each => {
      // Started at a level, it works that level's tasks: the ones below go to the agent of theirs, when the team has one.
      const theirs = tasks
        .filter(
          task =>
            each.roles.includes(roleOf(task)) &&
            (each.quality === undefined || (task.quality ?? 'standard') === each.quality)
        )
        .map(task => task.id);
      // The cards whose review names a role it reviews as: a designer's looks, a tester's QA.
      const roles = reviewRolesOf(reviewTeam, each.agent);
      const reviewing = tasks
        .filter(task => reviewSteps(task, reviewTeam).some(role => roles.includes(role)))
        .map(task => task.id);
      const work = [
        ...(theirs.length > 0 ? [theirs.join(', ')] : []),
        ...(reviewing.length > 0 ? [`reviews ${reviewing.join(', ')}`] : []),
        // A scout with no research in the plan stays for the research a stage brings; any other agent, for the tasks
        // the plan's research brings — a run's base developer was told to be left out of a plan of research alone.
        ...(theirs.length === 0 && reviewing.length === 0
          ? each.roles.includes(SCOUT)
            ? ['the research a stage brings']
            : tasks.some(isResearch)
              ? ['the tasks its research brings']
              : []
          : [])
      ];

      // The team that says how its agents start is started by the run: the lead never starts its base by hand.
      const byHand = `plitzi task next${each.quality ? ` --quality ${each.quality}` : ''} --agent ${each.agent}`;
      const launch = team.options?.launch;

      return work.length === 0
        ? `  ${each.agent} — nothing for its ${each.roles.join(', ')} in this plan: leave it out`
        : each.onDemand
          ? `  ${each.agent} — ${each.roles.join(', ')} — on demand (${work.join('; ')}): not at the start — ${launch ? `the run starts it in ${launch} when work waits for it` : `when run watch says work waits for it: ${byHand}`} (it stops by itself once nothing is left for it)`
          : `  ${each.agent} — ${each.roles.join(', ')}${each.quality ? ` at ${each.quality}` : ''} — ${startText(each)} (${work.join('; ')}): ${launch ? `the run starts it in ${launch} as it opens` : byHand}`;
    })
  ];
};

export const runPlan = (file: string, options: PlanOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const plan = await readPlanFile(path.resolve(file));
      // A run open in the project: the plan is its next stage — checked as `run extend` would stack it, nothing written.
      const going = await openRunOf(ctx);
      const stage = going ? await extendRun(ctx, going.runId, path.resolve(file), { dryRun: true }) : undefined;
      const checked = stage?.checked ?? (await checkPlanFile(ctx, path.resolve(file)));
      // Read after the check: a project's first plan writes the team it needs.
      const { team } = await ensureTeam(ctx.root, plan);

      // The agents work by the skills the project carries: older than the CLI, they teach what it no longer does.
      const staleSkills = (await planSkills(ctx.root).catch(() => ({ plans: [] }))).plans.map(each => each.name);

      return {
        ...checked,
        team,
        ...(going ? { stackedOn: going.runId } : {}),
        staleSkills,
        // A stage's: what the run's tasks before it take up is taken too.
        backlog: await backlogOfPlan(ctx.root, [
          ...checked.tasks,
          ...(going ? (await loadRun(ctx, going.runId, { anyVersion: true })).tasks : [])
        ])
      };
    },
    checked =>
      [
        chalk.bold(
          `Plan "${checked.runId}": ${checked.goal}${checked.stackedOn ? ` — a stage of "${checked.stackedOn}", open` : ''}`
        ),
        ...checked.tasks.map(
          task =>
            `  ${task.id} (${task.priority}, ${String(task.estimateMinutes)} min${task.dependsOn.length > 0 ? `, after ${task.dependsOn.join(', ')}` : ''}): ${isResearch(task) ? `research — ${glimpse(task.spike ?? '')}` : task.files.join(', ')}`
        ),
        `Shared files these tasks reach — by turns or by request: ${list(checked.sharedReached)} (${String(checked.shared.length)} shared in the project: plitzi space overview)`,
        ...checked.notices.map(notice => `  · ${notice}`),
        checked.leftOut.length > 0
          ? chalk.yellow(`Left out of this run — say it to the person before opening: ${checked.leftOut.join('; ')}`)
          : chalk.yellow(
              'Left out of this run: nothing said (leftOut) — if the job asks for more than these tasks, say what waits, to the person and in the plan'
            ),
        ...(checked.staleSkills.length > 0
          ? [
              chalk.yellow(
                `  · The skills the agents read are not what the Plitzi installed writes (${checked.staleSkills.join(', ')}): bring them up first — plitzi upgrade skills --write — an agent follows what they say`
              )
            ]
          : []),
        `Estimate: ${String(checked.estimate.tasks)} tasks, ${String(checked.estimate.agents)} agents at once, about ${String(checked.estimate.wallMinutes)} min (critical path ${String(checked.estimate.criticalPathMinutes)}, all of it ${String(checked.estimate.totalMinutes)}), at least ${String(checked.estimate.reviewRounds)} reviews`,
        ...(checked.estimate.paced ? [pacedText(checked.estimate.paced)] : []),
        ...startLines(checked.tasks, checked.team),
        ...(checked.stackedOn
          ? [
              `Stack it: plitzi run extend ${checked.stackedOn} ${file} — its tasks begin from the run’s work, and one finish writes both`
            ]
          : [
              checked.estimate.needsConfirmation
                ? chalk.yellow(`A person confirms it when it opens: ${checked.estimate.why ?? ''}`)
                : 'Opens without confirmation.',
              `Open it: plitzi run open ${file}`,
              // The one moment a person is asked, moved to the start when they want: ask before opening, never after.
              `Before opening, ask the person who writes it into the project at the end: they do (plitzi run finish --apply), or they let you — then they open it themselves, in their terminal: plitzi run open ${file} --lead-finishes`
            ]),
        ...backlogLines(checked.backlog)
      ].join('\n')
  );

/** The run open in the project, when one is: what a plan written now is a stage of. */
const openRunOf = async (ctx: RunContext): Promise<{ runId: string; record: RunRecord } | undefined> => {
  for (const runId of await activeRuns(ctx.root)) {
    const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true }).catch(() => undefined);
    if (loaded?.record.status === 'open') {
      return { runId, record: loaded.record };
    }
  }

  return undefined;
};

export const runExtend = (
  runId: string | undefined,
  file: string,
  options: PlanOptions & { dryRun?: boolean; lines?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx =>
      extendRun(ctx, await runOf(ctx, options, runId), path.resolve(file), {
        dryRun: options.dryRun ?? false,
        lines: options.lines ?? false
      }),
    extended =>
      [
        // A stage looked at before it is stacked — a run's lead had no way but stacking it.
        extended.checked
          ? `Checked, nothing stacked on "${extended.runId}": ${extended.added.join(', ')} would be added — run it again without --dry-run to stack them.`
          : `Stacked on "${extended.runId}": ${extended.added.join(', ')} — written into the project with the rest, in one finish.`,
        extended.ready.length > 0
          ? `Ready now: ${extended.ready.join(', ')}`
          : 'None ready yet: each waits for what it depends on.',
        ...(extended.notes > 0 ? [`  ${String(extended.notes)} note(s) sent to every task`] : []),
        ...(extended.primer ? ['  the run’s primer, written again'] : []),
        ...(extended.takenUp
          ? [`  covered now, no longer left out: ${extended.takenUp.join(', ')} — say it to the person`]
          : []),
        ...(extended.agents
          ? [
              `  ${String(extended.agents.after)} agents may work at once now (${String(extended.agents.before)} before)`
            ]
          : []),
        ...(extended.notices ?? extended.checked?.notices ?? []).map(notice => `  · ${notice}`),
        ...(extended.tried && extended.tried.length > 0
          ? ['Each line, run once on the run’s work as it is:', ...triedText(extended.tried)]
          : [])
      ].join('\n')
  );

export const runRehearse = (file: string, options: PlanOptions & { review?: number }): Promise<void> =>
  act(
    options,
    async ctx => {
      const { checked, ownership, team } = await readCheckedPlan(ctx.root, path.resolve(file));
      const agents = teamSize(team);
      // An agent of the team that takes one role is held to it; one of several takes any of them, as a free one.
      const roles = heldRoles(team);
      const reviewMinutes = Math.max(0, Math.round((options.review ?? 5 * 60_000) / 60_000));
      // The testers review, one task each at a time; with none, the lead alone.
      const testers = startedAgents(team).filter(each => each.roles.includes(TESTER)).length;
      const reviewers = testers > 0 ? { by: 'testers' as const, count: testers } : { by: 'lead' as const, count: 1 };
      const { paced } = checked.estimate;
      const atThisPace = paced
        ? rehearse(
            atPace(checked.tasks, paced.ratio),
            { agents, roles, reviewMinutes, reviewers },
            { ownership, created: checked.created }
          )
        : undefined;

      return {
        runId: checked.runId,
        reviewMinutes,
        ...rehearse(
          checked.tasks,
          { agents, roles, reviewMinutes, reviewers },
          { ownership, created: checked.created }
        ),
        ...(paced && atThisPace ? { paced: { ...paced, wallMinutes: atThisPace.wallMinutes } } : {})
      };
    },
    rehearsed =>
      [
        rehearsalText(rehearsed.runId, rehearsed, rehearsed.reviewMinutes),
        ...(rehearsed.paced ? [`${pacedText(rehearsed.paced)} — the reviews' minutes as given`] : [])
      ].join('\n')
  );

export const runOpen = (file: string | undefined, options: PlanOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      opener(ctx);
      const opened = await openRun(ctx, await planToOpen(ctx, file, options), {
        leadFinishes: options.leadFinishes ?? false,
        ...(options.despiteChecks === undefined ? {} : { despiteChecks: options.despiteChecks })
      });
      await pruneRuns(ctx);
      // The open is the lead's first command of the run: its cost counted as the lead's, not an unnamed caller's.
      usageCaller(opened.paths.dir, ctx.agent);
      // Made with the run, so no one after takes the lead's name: the lead passes it on every command.
      const lead = await issueToken(opened.paths, opened.checked.runId, LEAD, ctx.now());
      if (!lead) {
        throw new Error(`Run "${opened.checked.runId}" opened with a lead's token already made: a bug of the CLI`);
      }

      const team = await readTeam(ctx.root).catch(() => undefined);

      return {
        keeper: await ensureKeeper(ctx, opened.checked.runId, lead.token),
        // Who the keeper starts at once: the team's base, said by name so nobody starts it again by hand.
        base: team ? startedAgents(team).flatMap(each => (each.onDemand === true ? [] : [each.agent])) : [],
        runId: opened.checked.runId,
        folder: opened.paths.dir,
        tasks: opened.checked.tasks.map(task => task.id),
        researching: opensOnResearch(opened.checked.tasks),
        backedUp: opened.backedUp,
        estimate: opened.checked.estimate,
        leadFinishes: options.leadFinishes ?? false,
        leftOut: opened.checked.leftOut,
        inputs: opened.inputs,
        backlog: await backlogOfPlan(ctx.root, opened.checked.tasks),
        leadToken: lead.token,
        leadTokenFile: lead.file,
        leadCli: lead.cli,
        launch: team?.options?.launch,
        // Who finds out the scope: a scout of the team, or the lead with none.
        scouts: team ? startedAgents(team).flatMap(each => (each.roles.includes(SCOUT) ? [each.agent] : [])) : []
      };
    },
    opened =>
      [
        `Run "${opened.runId}" is open: ${String(opened.tasks.length)} task${opened.tasks.length === 1 ? '' : 's'}, ${String(opened.backedUp)} files backed up in ${opened.folder}.`,
        keeperText(opened.keeper, opened.base, opened.researching),
        chalk.bold(
          `The lead's own CLI: ${opened.leadCli} — every command of the run as the lead goes through it, which passes the lead's token (${opened.leadToken}, kept in ${opened.leadTokenFile}); a command as lead without it is refused`
        ),
        leadStartText(opened.leadCli, opened.launch),
        ...(opened.leftOut.length > 0 ? [`Left out of it, as the plan says: ${opened.leftOut.join('; ')}`] : []),
        ...(opened.inputs.length > 0
          ? [
              `The plan is the run's now, in its folder: ${opened.inputs.join(', ')} — edit it there and amend (plitzi run amend ${opened.runId}); it goes with the run`
            ]
          : []),
        opened.leadFinishes
          ? 'The lead writes it into the project at the end, as you allowed — once its report is written and the checks pass on the whole result.'
          : `A person writes it into the project at the end (plitzi run finish --apply) — or lets the lead, in their terminal: plitzi run finish --lead-finishes ${opened.runId}`,
        // On its scope alone, the next step is the lead's, not an agent's: there is nothing to take until it ends.
        ...(opened.researching
          ? []
          : [
              chalk.yellow(
                'Scoped before the run: what was found out to write this plan is in no record of it — not in the monitor, the report or the bench. A run scoped inside it opens on the ask: plitzi run start "…" --run <name>'
              )
            ]),
        opened.researching
          ? opened.scouts.length > 0
            ? `Next: ${opened.tasks.length === 1 ? 'the scope is' : `its ${String(opened.tasks.length)} research cards are`} ${opened.scouts.join(' or ')}'s — the keeper starts ${opened.tasks.length === 1 ? 'one' : 'them, a scout each up to the team’s most,'} to find out what the ask takes; what each proposes comes to the lead (plitzi run watch wakes it, plitzi task next --role lead hands it), to decide with the person: plitzi task review ${opened.tasks[0] ?? SCOPE_SPIKE} --approve [--leave <tasks>] | --changes "…". The team starts once there are tasks to take.`
            : `Next, yours: ${opened.tasks.length === 1 ? 'the scope' : `its ${String(opened.tasks.length)} research cards, one after another`} — find out what the ask takes (plitzi run reference --run ${opened.runId} --pages "…" keeps the site it copies), then end each with its tasks: plitzi task complete ${opened.tasks[0] ?? SCOPE_SPIKE} --found "what you found" --tasks <stage.json>. The team starts once there are tasks to take.`
          : `Start a task: plitzi task next --run ${opened.runId}`,
        'Watch it in a browser as the tasks are approved: p in plitzi run monitor, or npm run start:preview (on 8300) — the project itself is untouched until the finish',
        ...backlogLines(opened.backlog)
      ].join('\n')
  );

export const runSettle = (subject: string, options: RunCommandOptions & { note: string }): Promise<void> =>
  act(
    options,
    async ctx => settleFinding(ctx, await runOf(ctx, options), subject, options.note),
    settled =>
      `Settled ${settled.subject}, your note kept beside it for the report: ${settled.text.split(' — ')[0] ?? ''}`
  );

/**
 * The plan the run keeps, as `run open` moved it into its `inputs/`: what `run amend` reads when given no file — a run's
 * lead ran `run amend` alone after editing it there, and was refused for a missing argument.
 */
export const keptPlan = async (ctx: Pick<RunContext, 'root'>, runId: string): Promise<string> => {
  const inputs = path.join(runPaths(ctx.root, runId).dir, 'inputs');
  const plans = (await fs.readdir(inputs).catch(() => [])).filter(name => name.endsWith('.json'));
  if (plans.length !== 1) {
    throw new RunRefusal(
      'invalid',
      plans.length === 0
        ? `Run "${runId}" keeps no plan in its inputs: name the plan, edited — plitzi run amend ${runId} <plan.json>`
        : `Run "${runId}" keeps ${String(plans.length)} plans in its inputs (${plans.join(', ')}): name the one edited — plitzi run amend ${runId} <plan.json>`
    );
  }

  return path.join(inputs, plans[0] ?? '');
};

export const runAmend = (
  runId: string | undefined,
  file: string | undefined,
  options: RunCommandOptions
): Promise<void> =>
  act(
    options,
    async ctx => {
      const id = await runOf(ctx, options, runId);

      return amendRun(ctx, id, file === undefined ? await keptPlan(ctx, id) : path.resolve(file));
    },
    amended =>
      [
        `Run "${amended.runId}" amended:`,
        ...amended.tasks.map(each =>
          each.done
            ? `  ${each.task}, done: its acceptance — held again at the finish, on the whole result (nobody is at it to tell)`
            : `  ${each.task}: ${each.changed.join(', ')} — told, with what it now asks`
        ),
        ...(amended.notes.length > 0 ? [`  ${String(amended.notes.length)} new note(s), sent to every task`] : []),
        ...(amended.goal === undefined ? [] : [`  the goal: ${amended.goal}`]),
        ...(amended.reference === undefined
          ? []
          : [`  the site it copies: ${amended.reference} — keep it: plitzi run reference --run ${amended.runId}`]),
        ...(amended.primer ? ['  the run’s primer, written again — every task told'] : []),
        ...(amended.removed
          ? [`  out of the run, as nobody had taken them: ${amended.removed.join(', ')} — say it to the person`]
          : []),
        ...(amended.inventory ? ['  the inventory: what the run covers and what waits, checked again'] : [])
      ].join('\n')
  );
