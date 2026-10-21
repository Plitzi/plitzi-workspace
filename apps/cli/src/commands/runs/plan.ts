import path from 'node:path';

import chalk from 'chalk';

import { act, runOf } from './shell';
import { list, pacedText } from './text';
import { amendRun } from '../../runs/amend';
import { hasDesignReview } from '../../runs/design';
import { extendRun } from '../../runs/extend';
import { atPace } from '../../runs/plan';
import { rehearsalText, rehearse } from '../../runs/rehearse';
import {
  activeRuns,
  allowLeadFinish,
  loadRun,
  checkPlanFile,
  openRun,
  pruneRuns,
  readCheckedPlan,
  readPlanFile
} from '../../runs/run';
import { noteRun } from '../../runs/talk';
import { roleOf } from '../../runs/tasks';
import {
  coLeadNames,
  DESIGNER,
  heldRoles,
  ensureTeam,
  leadModelText,
  modelText,
  reviewsDesign,
  startedAgents,
  TEAM_FILE,
  teamSize
} from '../../runs/team';
import { planSkills } from '../upgrade';

import type { RunCommandOptions } from './shell';
import type { RunRecord, RunTask } from '../../runs/model';
import type { RunContext } from '../../runs/run';
import type { Team } from '../../runs/team';

/**
 * A run's plan: checked (`run plan`, as its next stage when a run is open), rehearsed, opened, stacked, amended and
 * noted — and the lead allowed to apply it.
 */

export interface PlanOptions extends RunCommandOptions {
  /** `run open`: a person lets the lead write the run into the project itself. */
  leadFinishes?: boolean;
}

export const runAllowFinish = (
  runId: string | undefined,
  options: RunCommandOptions & { revoke?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => allowLeadFinish(ctx, await runOf(ctx, options, runId), { revoke: options.revoke ?? false }),
    allowed =>
      allowed.leadFinishes
        ? `The lead of "${allowed.runId}" may now write it into the project itself — once its report is written and the checks pass on the whole result (plitzi run finish --apply). Take it back: plitzi run allow-finish --revoke`
        : `The lead of "${allowed.runId}" may no longer write it into the project: a person does (plitzi run finish --apply).`
  );

/**
 * Who to start, from the project's `.plitzi/team.json`: the lead's model, then each agent — its roles, its model, the
 * plan's tasks it takes and the command it takes them with — so a model chosen for designers works only their tasks.
 */
const startLines = (tasks: readonly RunTask[], team: Team, designReview: boolean): string[] => {
  const reviews = designReview ? tasks.filter(task => hasDesignReview(task, task.files)) : [];

  return [
    `Start the team (${TEAM_FILE}):`,
    `  lead — ${leadModelText(team.lead)} — you: plan, answer, decide, finish and review — take each review from the queue (plitzi task next --role lead --take)${coLeadNames(team).length > 0 ? ', so a lead started beside you does not take it too' : ''}`,
    ...coLeadNames(team).map(
      name =>
        `  ${name} — a lead that reviews, as strictly as you, from one queue — ${leadModelText(team.lead)}: not at the start — when run watch --until lead says the reviews queue up: plitzi task next --role lead --follow --take --agent ${name} (it stops by itself once the queue is empty)`
    ),
    ...startedAgents(team).map(each => {
      // Started at a level, it works that level's tasks: the ones below go to the agent of theirs, when the team has one.
      const theirs = tasks
        .filter(
          task =>
            each.roles.includes(roleOf(task)) &&
            (each.quality === undefined || (task.quality ?? 'standard') === each.quality)
        )
        .map(task => task.id);
      const reviewing = each.roles.includes(DESIGNER) ? reviews.map(task => task.id) : [];
      const work = [
        ...(theirs.length > 0 ? [theirs.join(', ')] : []),
        ...(reviewing.length > 0 ? [`the UI of ${reviewing.join(', ')}`] : [])
      ];

      return work.length === 0
        ? `  ${each.agent} — nothing for its ${each.roles.join(', ')} in this plan: leave it out`
        : `  ${each.agent} — ${each.roles.join(', ')}${each.quality ? ` at ${each.quality}` : ''} — ${each.model ? modelText(each.model) : 'the harness’s own model'} (${work.join('; ')}): plitzi task next --role ${each.roles.join(',')}${each.quality ? ` --quality ${each.quality}` : ''} --follow --take --agent ${each.agent}`;
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
        designReview: going?.record.designReview === true || reviewsDesign(team, plan),
        ...(going ? { stackedOn: going.runId } : {}),
        staleSkills
      };
    },
    checked =>
      [
        chalk.bold(
          `Plan "${checked.runId}": ${checked.goal}${checked.stackedOn ? ` — a stage of "${checked.stackedOn}", open` : ''}`
        ),
        ...checked.tasks.map(
          task =>
            `  ${task.id} (${task.priority}, ${String(task.estimateMinutes)} min${task.dependsOn.length > 0 ? `, after ${task.dependsOn.join(', ')}` : ''}): ${task.files.join(', ')}`
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
        ...startLines(checked.tasks, checked.team, checked.designReview),
        ...(checked.designReview
          ? [
              'A designer reviews the UI of the others’ tasks before you: you approve each after it (or now, with --skip-design)'
            ]
          : []),
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
            ])
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

export const runExtend = (runId: string | undefined, file: string, options: PlanOptions): Promise<void> =>
  act(
    options,
    async ctx => extendRun(ctx, await runOf(ctx, options, runId), path.resolve(file)),
    extended =>
      [
        `Stacked on "${extended.runId}": ${extended.added.join(', ')} — written into the project with the rest, in one finish.`,
        extended.ready.length > 0
          ? `Ready now: ${extended.ready.join(', ')}`
          : 'None ready yet: each waits for what it depends on.',
        ...(extended.notes > 0 ? [`  ${String(extended.notes)} note(s) sent to every task`] : []),
        ...(extended.primer ? ['  the run’s primer, written again'] : []),
        ...(extended.agents
          ? [
              `  ${String(extended.agents.after)} agents may work at once now (${String(extended.agents.before)} before)`
            ]
          : []),
        ...(extended.newLeads
          ? [
              `  ${extended.newLeads.join(', ')} review beside you now: start each — plitzi task next --role lead --follow --take --agent <name>`
            ]
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
      const { paced } = checked.estimate;
      const atThisPace = paced
        ? rehearse(
            atPace(checked.tasks, paced.ratio),
            { agents, roles, reviewMinutes },
            { ownership, created: checked.created }
          )
        : undefined;

      return {
        runId: checked.runId,
        reviewMinutes,
        ...rehearse(checked.tasks, { agents, roles, reviewMinutes }, { ownership, created: checked.created }),
        ...(paced && atThisPace ? { paced: { ...paced, wallMinutes: atThisPace.wallMinutes } } : {})
      };
    },
    rehearsed =>
      [
        rehearsalText(rehearsed.runId, rehearsed, rehearsed.reviewMinutes),
        ...(rehearsed.paced ? [`${pacedText(rehearsed.paced)} — the reviews' minutes as given`] : [])
      ].join('\n')
  );

export const runOpen = (file: string, options: PlanOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const opened = await openRun(ctx, path.resolve(file), {
        leadFinishes: options.leadFinishes ?? false
      });
      await pruneRuns(ctx);

      return {
        runId: opened.checked.runId,
        folder: opened.paths.dir,
        tasks: opened.checked.tasks.map(task => task.id),
        backedUp: opened.backedUp,
        estimate: opened.checked.estimate,
        leadFinishes: options.leadFinishes ?? false,
        leftOut: opened.checked.leftOut,
        inputs: opened.inputs
      };
    },
    opened =>
      [
        `Run "${opened.runId}" is open: ${String(opened.tasks.length)} tasks, ${String(opened.backedUp)} files backed up in ${opened.folder}.`,
        ...(opened.leftOut.length > 0 ? [`Left out of it, as the plan says: ${opened.leftOut.join('; ')}`] : []),
        ...(opened.inputs.length > 0
          ? [
              `The plan is the run's now, in its folder: ${opened.inputs.join(', ')} — edit it there and amend (plitzi run amend ${opened.runId} ${opened.inputs[0]}); it goes with the run`
            ]
          : []),
        opened.leadFinishes
          ? 'The lead writes it into the project at the end, as you allowed — once its report is written and the checks pass on the whole result.'
          : `A person writes it into the project at the end (plitzi run finish --apply) — or lets the lead, in their terminal: plitzi run allow-finish ${opened.runId}`,
        `Start a task: plitzi task next --run ${opened.runId}`,
        'Watch it in a browser as the tasks are approved: npm run start:preview (plitzi run preview, on 8300) — the project itself is untouched until the finish'
      ].join('\n')
  );

export const runNote = (text: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => noteRun(ctx, await runOf(ctx, options), text),
    note => `Noted for every task (${note.id}) — the ones in hand with their next command, the rest with their take.`
  );

export const runAmend = (runId: string | undefined, file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => amendRun(ctx, await runOf(ctx, options, runId), path.resolve(file)),
    amended =>
      [
        `Run "${amended.runId}" amended:`,
        ...amended.tasks.map(each => `  ${each.task}: ${each.changed.join(', ')} — told, with what it now asks`),
        ...(amended.notes.length > 0 ? [`  ${String(amended.notes.length)} new note(s), sent to every task`] : []),
        ...(amended.goal === undefined ? [] : [`  the goal: ${amended.goal}`]),
        ...(amended.primer ? ['  the run’s primer, written again — every task told'] : []),
        ...(amended.removed
          ? [`  out of the run, as nobody had taken them: ${amended.removed.join(', ')} — say it to the person`]
          : []),
        ...(amended.inventory ? ['  the inventory: what the run covers and what waits, checked again'] : [])
      ].join('\n')
  );
