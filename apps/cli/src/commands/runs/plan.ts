import path from 'node:path';

import chalk from 'chalk';

import { act, opener, runOf } from './shell';
import { list, pacedText } from './text';
import { amendRun } from '../../runs/amend';
import { backlogText, openBacklog } from '../../runs/backlog';
import { hasDesignReview } from '../../runs/design';
import { extendRun } from '../../runs/extend';
import { writeJson } from '../../runs/files';
import { issueToken } from '../../runs/identity';
import { ensureKeeper, keeperText } from '../../runs/keeper';
import { LEAD } from '../../runs/messages';
import { atPace } from '../../runs/plan';
import { RunRefusal } from '../../runs/refusal';
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
import { SCOPE_SPIKE, scopePlan } from '../../runs/spike';
import { noteRun } from '../../runs/talk';
import { roleOf } from '../../runs/tasks';
import {
  coLeadNames,
  DESIGNER,
  heldRoles,
  ensureTeam,
  leadModelText,
  startText,
  reviewsDesign,
  startedAgents,
  TEAM_FILE,
  teamSize
} from '../../runs/team';
import { triedText } from '../../runs/tryLines';
import { usageCaller } from '../../runs/usage';
import { planSkills } from '../upgrade';

import type { RunCommandOptions } from './shell';
import type { BacklogItem } from '../../runs/backlog';
import type { RunRecord, RunTask } from '../../runs/model';
import type { RunContext } from '../../runs/run';
import type { Team } from '../../runs/team';

/**
 * A run's plan: checked (`run plan`, as its next stage when a run is open), rehearsed, opened, stacked, amended and
 * noted — and the lead allowed to apply it.
 */

/**
 * What earlier runs noticed and left, said where the next is planned and opened: a run takes it up — a task of its
 * plan, closed with `run backlog done <id>` once done — or leaves it open.
 */
const backlogLines = (items: readonly BacklogItem[]): string[] =>
  items.length === 0
    ? []
    : [
        chalk.yellow(
          `The project's backlog has ${String(items.length)} open — what earlier runs noticed and left: take it up in this run, or leave it (plitzi run backlog):`
        ),
        ...items.map(item => `  · ${backlogText(item)}`)
      ];

export interface PlanOptions extends RunCommandOptions {
  /** `run open`: a person lets the lead write the run into the project itself. */
  leadFinishes?: boolean;
  /** `run open`: the person's ask, with no plan — the run opens on one spike, its scope, the lead's. */
  spike?: string;
  /** `run open --spike`: the site the run copies, as a plan's `reference` says it. */
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
        'Name the plan — plitzi run open <plan.json> — or open the run on the ask alone: plitzi run open --spike "…" --run <name>'
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
    throw new RunRefusal('invalid', 'Say the ask and name the run: plitzi run open --spike "…" --run es-launch');
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
        : each.onDemand
          ? `  ${each.agent} — ${each.roles.join(', ')} — on demand: not at the start — when run watch --until lead says work waits for it: plitzi task next --role ${each.roles.join(',')}${each.quality ? ` --quality ${each.quality}` : ''} --follow --take --agent ${each.agent} (it stops by itself once nothing is left for it)`
          : `  ${each.agent} — ${each.roles.join(', ')}${each.quality ? ` at ${each.quality}` : ''} — ${startText(each)} (${work.join('; ')}): plitzi task next --role ${each.roles.join(',')}${each.quality ? ` --quality ${each.quality}` : ''} --follow --take --agent ${each.agent}`;
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
        staleSkills,
        backlog: await openBacklog(ctx.root)
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
              'A designer reviews the UI of the others’ tasks before you: you approve each after it — or now, saying why: --skip-design lead (you looked at its UI yourself) or no-ui (it changes nothing a visitor sees)'
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
        // A stage looked at before it is stacked — velada-polish's lead had no way but stacking it.
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
        ...(extended.newLeads
          ? [
              `  ${extended.newLeads.join(', ')} review beside you now: start each — plitzi task next --role lead --follow --take --agent <name>`
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

      return {
        keeper: await ensureKeeper(ctx, opened.checked.runId, lead.token),
        runId: opened.checked.runId,
        folder: opened.paths.dir,
        tasks: opened.checked.tasks.map(task => task.id),
        backedUp: opened.backedUp,
        estimate: opened.checked.estimate,
        leadFinishes: options.leadFinishes ?? false,
        leftOut: opened.checked.leftOut,
        inputs: opened.inputs,
        backlog: await openBacklog(ctx.root),
        leadToken: lead.token,
        leadTokenFile: lead.file,
        leadCli: lead.cli
      };
    },
    opened =>
      [
        `Run "${opened.runId}" is open: ${String(opened.tasks.length)} task${opened.tasks.length === 1 ? '' : 's'}, ${String(opened.backedUp)} files backed up in ${opened.folder}.`,
        keeperText(opened.keeper),
        chalk.bold(
          `The lead's own CLI: ${opened.leadCli} — every command of the run as the lead goes through it, which passes the lead's token (${opened.leadToken}, kept in ${opened.leadTokenFile}); a command as lead without it is refused`
        ),
        ...(opened.leftOut.length > 0 ? [`Left out of it, as the plan says: ${opened.leftOut.join('; ')}`] : []),
        ...(opened.inputs.length > 0
          ? [
              `The plan is the run's now, in its folder: ${opened.inputs.join(', ')} — edit it there and amend (plitzi run amend ${opened.runId} ${opened.inputs[0]}); it goes with the run`
            ]
          : []),
        opened.leadFinishes
          ? 'The lead writes it into the project at the end, as you allowed — once its report is written and the checks pass on the whole result.'
          : `A person writes it into the project at the end (plitzi run finish --apply) — or lets the lead, in their terminal: plitzi run allow-finish ${opened.runId}`,
        // On its scope alone, the next step is the lead's, not an agent's: there is nothing to take until it ends.
        ...(opened.tasks.includes(SCOPE_SPIKE)
          ? []
          : [
              chalk.yellow(
                'Scoped before the run: what was found out to write this plan is in no record of it — not in the monitor, the report or the bench. A run scoped inside it opens on the ask: plitzi run open --spike "…" --run <name>'
              )
            ]),
        opened.tasks.length === 1 && opened.tasks[0] === SCOPE_SPIKE
          ? `Next, yours: the scope — find out what the ask takes (plitzi run reference --run ${opened.runId} --pages "…" keeps the site it copies), then end it with its tasks: plitzi task spike ${SCOPE_SPIKE} --done "what you found" --tasks <stage.json>. Agents start once there are tasks to take.`
          : `Start a task: plitzi task next --run ${opened.runId}`,
        'Watch it in a browser as the tasks are approved: npm run start:preview (plitzi run preview, on 8300) — the project itself is untouched until the finish',
        ...backlogLines(opened.backlog)
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
