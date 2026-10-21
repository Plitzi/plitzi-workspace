import fs from 'node:fs/promises';
import path from 'node:path';

import { auditRun } from './audit';
import { fingerprint, readJson, readOptional, writeJson } from './files';
import { requireLead } from './leads';
import { acceptanceOnResult, checkVersions } from './materialise';
import { mergeLines } from './merge3';
import { entryOf, isMergeManifest } from './model';
import { BACKUPS_DIR, under } from './paths';
import { RunRefusal } from './refusal';
import { leaveReport, readSummary } from './report';
import {
  assertStatus,
  loadRun,
  logRun,
  readApproved,
  readBase,
  readRecord,
  removeRun,
  requireNoTask,
  requirePerson,
  updateRecord
} from './run';
import { getBlob, placeVersion, putBlob, withLock } from './store';
import { leftInTmp } from './strays';
import { requestsOf } from './tasks';
import { viewTask } from './taskStore';
import { viewRun } from './view';

import type { CheckResult } from './checks';
import type { AcceptanceAgain } from './materialise';
import type { ApprovedManifest, MergeEntry, ReconciledFile, RunRecord } from './model';
import type { LoadedRun, RemovedInputs, RunContext } from './run';
import type { Attention } from './view';

/** No task is in hand at the finish: what fails is the run's, and the next step is a task of the run, or a revert. */
const FINISH_AGAIN =
  'a task of the run puts it right (plitzi run extend with a stage for it), or the lead reverts the task that broke it (plitzi task revert) — then finish again (plitzi run finish)';

/**
 * The run into the project: the only write the project ever gets from a run — shown first as a
 * dry run with the project's checks over the whole result, approved by a person, written file by file as one
 * transaction with a backup of everything it overwrites, which puts it all back if it is cut. Once it is in, the run
 * goes — kept as plain files only with `--keep-backup`. A file changed on both sides is never written: the run enters
 * reconciliation, resolved file by file.
 */

const at = (ctx: RunContext): string => ctx.now().toISOString();

export interface FinishPlan {
  /** Files the run changes that the project did not: written. */
  apply: { file: string; before: string | null; after: string | null }[];
  /** Files the project already holds as the run would write them. */
  same: string[];
  /** Files changed on both sides since the run copied them: never written. */
  conflicts: ReconciledFile[];
  /** Files written over a change made outside the run, as the lead decided: said, and the other version kept. */
  overwrites: { file: string; task: string; by: string; at: string }[];
  checks?: CheckResult;
  /** Every done task's acceptance checks, run again on the whole result: what a later task may have broken. */
  /** `reused`: every line held on this same result before, none run again; `kept`: how many of them, the rest run. */
  acceptance?: { results: AcceptanceAgain[]; reused?: string; kept?: number };
}

const planFinish = async (ctx: RunContext, approved: ApprovedManifest): Promise<FinishPlan> => {
  const plan: FinishPlan = { apply: [], same: [], conflicts: [], overwrites: [] };
  for (const [file, entry] of Object.entries(approved.files).sort(([a], [b]) => a.localeCompare(b))) {
    const project = await fingerprint(under(ctx.root, file));
    if (project === entry.digest) {
      plan.same.push(file);
    } else if (project === entry.base) {
      plan.apply.push({ file, before: project, after: entry.digest });
      if (entry.overrode) {
        plan.overwrites.push({ file, task: entry.task, by: entry.overrode.by, at: entry.overrode.at });
      }
    } else {
      plan.conflicts.push({ file, base: entry.base, project, run: entry.digest });
    }
  }

  return plan;
};

/** What stops a run from finishing: tasks in hand, tasks left (without `--leave-pending`), requests not integrated. */
/** What needs someone and keeps a run from closing: each said where it is answered — a finish never leaves one behind. */
const OPEN_ATTENTION: Readonly<Partial<Record<Attention['kind'], string>>> = {
  message: 'read and answer it: plitzi task inbox',
  proposal: 'answer it, or have its task answer it',
  blocked: 'unblock it: plitzi task unblock <task> --answer "…"',
  person: 'a person answers it in their terminal',
  version: 're-pin the run: plitzi run attach',
  'left-in-tmp': 'remove what nobody needs from the project’s tmp/'
};

const assertNothingOpen = async (ctx: RunContext, runId: string): Promise<void> => {
  const open = (await viewRun(ctx, runId)).attention.filter(item => OPEN_ATTENTION[item.kind] !== undefined);
  if (open.length > 0) {
    throw new RunRefusal(
      'invalid',
      `Run "${runId}" still needs attention — it closes once nothing does:\n${open.map(item => `  - ${item.text}\n    → ${String(OPEN_ATTENTION[item.kind])}`).join('\n')}`,
      { attention: open.map(item => item.kind) }
    );
  }
};

const assertFinishable = async (loaded: LoadedRun, leavePending: boolean): Promise<string[]> => {
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const inHand = views.filter(view =>
    ['in-progress', 'in-review', 'waiting', 'changes-requested'].includes(view.state.status)
  );
  if (inHand.length > 0) {
    throw new RunRefusal(
      'invalid',
      `Tasks are still in hand: ${inHand.map(view => `${view.task.id} (${view.state.status})`).join(', ')} — they finish first`,
      { tasks: inHand.map(view => view.task.id) }
    );
  }

  const left = views.filter(view => view.state.status !== 'done').map(view => `${view.task.id} (${view.state.status})`);
  if (left.length > 0 && !leavePending) {
    throw new RunRefusal(
      'invalid',
      `Tasks are not done: ${left.join(', ')}. Finish them, or finish without them (--leave-pending)`,
      { tasks: left }
    );
  }

  const pending = (await requestsOf(loaded)).filter(each => !each.integrated);
  if (pending.length > 0) {
    throw new RunRefusal(
      'invalid',
      `Requests on shared files are not integrated: ${pending
        .map(each => `${each.request.file} from ${each.task}${each.integratedBy ? ` (task ${each.integratedBy})` : ''}`)
        .join(', ')}`,
      { requests: pending.map(each => `${each.task}/${each.request.id}`) }
    );
  }

  return left;
};

/** A merge cut half-way — its journal says it was not complete — undone from its own backups. Under the merge lock. */
const recoverMerges = async (ctx: RunContext, loaded: LoadedRun): Promise<string[]> => {
  const recovered: string[] = [];
  const journals = await fs.readdir(loaded.paths.merges).catch(() => []);
  for (const name of journals.filter(each => each.endsWith('.json')).sort()) {
    const file = path.join(loaded.paths.merges, name);
    const entry = await readJson(file, isMergeManifest, 'a merge’s journal');
    if (!entry || entry.complete) {
      continue;
    }

    for (const [written, { before, after }] of Object.entries(entry.files)) {
      const now = await fingerprint(under(ctx.root, written));
      if (now === after && now !== before) {
        await placeVersion(loaded.paths, under(ctx.root, written), before);
      }
    }

    await fs.rm(file, { force: true });
    recovered.push(entry.id);
    await logRun(ctx, loaded.paths, { action: 'recover', merge: entry.id });
  }

  return recovered;
};

/**
 * Writes `files` into the project as one merge: its journal first, a backup of each file it overwrites, then each file
 * atomically; a failure half-way puts back everything written. Under the merge lock.
 */
const writeMerge = async (
  ctx: RunContext,
  loaded: LoadedRun,
  kind: MergeEntry['kind'],
  files: Record<string, { before: string | null; after: string | null }>
): Promise<MergeEntry> => {
  const record = await readRecord(loaded.paths);
  let n = (record?.merges.length ?? 0) + 1;
  while (await readOptional(path.join(loaded.paths.merges, `merge_${String(n)}.json`))) {
    n += 1;
  }

  const id = `merge_${String(n)}`;
  for (const file of Object.keys(files)) {
    const bytes = await readOptional(under(ctx.root, file));
    if (bytes !== undefined) {
      await putBlob(loaded.paths, bytes);
    }
  }

  const entry: MergeEntry = { id, kind, at: at(ctx), complete: false, files };
  const journal = path.join(loaded.paths.merges, `${id}.json`);
  await writeJson(journal, entry);
  const written: string[] = [];
  try {
    for (const [file, { after }] of Object.entries(files)) {
      await placeVersion(loaded.paths, under(ctx.root, file), after);
      written.push(file);
    }
  } catch (error) {
    for (const file of written.reverse()) {
      await placeVersion(loaded.paths, under(ctx.root, file), files[file].before);
    }

    await fs.rm(journal, { force: true });
    throw error;
  }

  const complete = { ...entry, complete: true };
  await writeJson(journal, complete);

  return complete;
};

const enterReconciliation = async (
  ctx: RunContext,
  loaded: LoadedRun,
  reason: string,
  files: ReconciledFile[]
): Promise<RunRecord> => {
  for (const conflict of files) {
    const bytes = await readOptional(under(ctx.root, conflict.file));
    if (bytes !== undefined) {
      await putBlob(loaded.paths, bytes);
    }
  }

  return updateRecord(ctx, loaded.paths, record => ({
    ...record,
    status: 'reconciliation',
    reconciliation: { reason, at: at(ctx), files }
  }));
};

export interface Finished {
  dryRun: boolean;
  plan: FinishPlan;
  /** Tasks left, when it finished without them. */
  left: string[];
  /** With `--keep-backup`, or for what was written over a change made outside the run: the files as they were. */
  backup?: string;
  /** The run's report, left when it ends. */
  report?: string;
  /** The plan and summary it was handed: removed with it, or kept when changed since. */
  inputs?: RemovedInputs;
  /** Written: by whom — a person, or the lead a person allowed. */
  writtenBy?: string;
  /** Dry run: whether the lead may write it itself, a person having allowed it. */
  leadFinishes?: boolean;
  /** What appeared in the project's `tmp/` during the run that is nobody's tool — left there, said (`strays.ts`). */
  leftInTmp?: string[];
  /** What the run's activity shows was wrong in how it was worked: said, never refusing — and kept in the report. */
  audit: string[];
}

/**
 * What the final merge overwrote, as plain files at their project paths — the files that did not exist named in the
 * manifest — so a person puts any back by copying it, with or without the CLI.
 */
const keepBackup = async (
  ctx: RunContext,
  loaded: LoadedRun,
  files: Record<string, { before: string | null; after: string | null }>
): Promise<string> => {
  const stamp = ctx
    .now()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const dir = path.join(ctx.root, BACKUPS_DIR, `${loaded.record.runId}-${stamp}`);
  const created: string[] = [];
  for (const [file, { before }] of Object.entries(files)) {
    if (before === null) {
      created.push(file);
    } else {
      await placeVersion(loaded.paths, under(path.join(dir, 'files'), file), before);
    }
  }

  await writeJson(path.join(dir, 'manifest.json'), {
    run: loaded.record.runId,
    goal: loaded.plan.goal,
    mergedAt: at(ctx),
    note: 'files/ holds each project file as it was before the run was merged; created lists the files the merge made, which did not exist before. Copy a file back to undo it.',
    overwritten: Object.keys(files)
      .filter(file => !created.includes(file))
      .sort(),
    created: created.sort()
  });

  return dir;
};

/**
 * `plitzi run finish`: the whole run's diff as a dry run, the project's checks over the result; `--apply`, a person's,
 * writes it. Files changed on both sides put the run into reconciliation and nothing is written.
 */
export const finishRun = async (
  ctx: RunContext,
  runId: string,
  { apply, leavePending, backup = false }: { apply: boolean; leavePending: boolean; backup?: boolean }
): Promise<Finished> => {
  if (apply) {
    requireNoTask(ctx, 'write a run into the project');
  }

  const loaded = await loadRun(ctx, runId);
  if (apply) {
    await requireLead(ctx, loaded, 'write the run into the project');
  }

  assertStatus(loaded, ['open', 'stopping', 'stopped'], 'finish');
  const left = await assertFinishable(loaded, leavePending);
  await assertNothingOpen(ctx, runId);
  const approved = await readApproved(loaded.paths);
  const plan = await planFinish(ctx, approved);
  // A file changed on both sides is resolved first, dry run or not: checking the project's version of one file beside
  // the run's of the others checks a result that will never exist.
  if (plan.conflicts.length > 0) {
    await enterReconciliation(
      ctx,
      loaded,
      'files changed in the project and in the run since the run copied them',
      plan.conflicts
    );
    throw new RunRefusal(
      'reconciliation',
      `Run "${runId}" is in reconciliation: ${plan.conflicts.map(each => each.file).join(', ')} changed on both sides. Nothing was written. The lead resolves each (plitzi run resolve ${runId} <file> --take project|run|merge|<file>), then continues (plitzi run continue ${runId}) or aborts (plitzi run abort ${runId})`,
      { run: runId, files: plan.conflicts.map(each => each.file) }
    );
  }

  plan.checks = await checkVersions(ctx, loaded, Object.fromEntries(plan.apply.map(each => [each.file, each.after])), {
    final: true
  });
  if (!plan.checks.ok) {
    throw new RunRefusal('checks-failed', 'The project’s checks fail on the run’s whole result: nothing is written', {
      steps: plan.checks.steps.filter(step => !step.ok),
      next: FINISH_AGAIN
    });
  }

  // What each task was accepted on, again on the whole result: a later task may have broken what one's review saw pass.
  const versions = Object.fromEntries(plan.apply.map(each => [each.file, each.after]));
  const lines = (
    await Promise.all(
      loaded.tasks.map(async task => {
        const { state } = await viewTask(loaded.paths, task);

        return state.status === 'done'
          ? (state.accepted ?? [])
              .filter(each => each.ok)
              .map(each => ({ task: task.id, said: each.said, check: each.check }))
          : [];
      })
    )
  ).flat();
  plan.acceptance = await acceptanceOnResult(ctx, loaded, versions, lines);
  const broken = plan.acceptance.results.filter(each => !each.ok);
  if (broken.length > 0) {
    throw new RunRefusal(
      'checks-failed',
      `What ${[...new Set(broken.map(each => `"${each.task}"`))].join(', ')} ${broken.length === 1 ? 'was' : 'were'} accepted on no longer holds on the run's whole result — passed at its review, broken since by another task's work: ${broken.map(each => `${each.task}: ${each.said}`).join('; ')}. Nothing is written: a task of the run puts it right (plitzi run extend), or the lead reverts what broke it (plitzi task revert)`,
      {
        steps: broken.map(each => ({
          name: `acceptance — ${each.task}: ${each.said}`,
          ok: false,
          said: [each.check, ...(each.output ?? [])]
        })),
        next: FINISH_AGAIN
      }
    );
  }

  const strays = await leftInTmp(ctx.root, loaded.record);
  const leftThere = { ...(strays.length > 0 ? { leftInTmp: strays } : {}), audit: await auditRun(loaded) };
  if (!apply) {
    return { dryRun: true, plan, left, leadFinishes: loaded.record.leadFinishes !== undefined, ...leftThere };
  }

  // The lead closes the run: its report is written before the person writes the run into the project.
  if ((await readSummary(loaded)) === undefined) {
    throw new RunRefusal(
      'invalid',
      `Run "${runId}" has no report yet: the lead, who closes it, writes its summary first — what it did, what went wrong, what is left (plitzi run report ${runId} --summary <file>)`,
      { run: runId }
    );
  }

  // A person writes it — unless one let the lead, at its open or since: then the report and the checks above are what
  // stand between the run and the project, and the finish says who allowed it.
  const byLead = loaded.record.leadFinishes !== undefined;
  if (!byLead) {
    await requirePerson(ctx, runId, `write run "${runId}" into the project (${String(plan.apply.length)} files)`);
  }

  const entry = await withLock(
    loaded.paths.mergeLock,
    async () => {
      await recoverMerges(ctx, loaded);
      const again = await planFinish(ctx, await readApproved(loaded.paths));
      if (JSON.stringify(again.apply) !== JSON.stringify(plan.apply) || again.conflicts.length > 0) {
        throw new RunRefusal(
          'conflict',
          'The project changed since the dry run: run plitzi run finish again to see it',
          {
            run: runId
          }
        );
      }

      return writeMerge(
        ctx,
        loaded,
        'finish',
        Object.fromEntries(plan.apply.map(each => [each.file, { before: each.before, after: each.after }]))
      );
    },
    { now: ctx.now }
  );
  // What was written over a change made outside the run is kept whatever was asked: overwriting it must not lose it.
  const overwritten = new Set(plan.overwrites.map(each => each.file));
  const keep = backup
    ? entry.files
    : Object.fromEntries(Object.entries(entry.files).filter(([file]) => overwritten.has(file)));
  const kept = Object.keys(keep).length > 0 ? await keepBackup(ctx, loaded, keep) : undefined;
  const writtenBy = byLead
    ? `the lead (${ctx.agent}), as a person allowed it at ${String(loaded.record.leadFinishes)}`
    : 'a person, who confirmed it in their terminal';
  const report = await leaveReport(ctx, loaded, {
    outcome: 'finished',
    files: Object.keys(entry.files).sort(),
    writtenBy,
    ...(kept ? { backup: kept } : {})
  });
  // Its work is in the project: the run goes, backups and all, unless a person asked to keep them. Its report stays.
  const inputs = await removeRun(ctx, loaded.paths, runId);

  return { dryRun: false, plan, left, report, inputs, writtenBy, ...(kept ? { backup: kept } : {}), ...leftThere };
};

/** `plitzi run resolve`: one file of a reconciliation settled by a person — the project's, the run's, or a file of theirs. */
export const resolveFile = async (
  ctx: RunContext,
  runId: string,
  file: string,
  take: string
): Promise<ReconciledFile> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['reconciliation'], 'resolve a file');
  const conflict = loaded.record.reconciliation?.files.find(each => each.file === file);
  if (!conflict) {
    throw new RunRefusal(
      'invalid',
      `${file} is not under reconciliation: ${loaded.record.reconciliation?.files.map(each => each.file).join(', ') ?? ''}`,
      { file }
    );
  }

  // The lead decides, as a person may: whichever way, what is written over is kept and said.
  requireNoTask(ctx, 'resolve a reconciliation');
  await requireLead(ctx, loaded, 'resolve a reconciliation');
  const resolved: ReconciledFile['resolved'] =
    take === 'project' ? 'project' : take === 'run' ? 'run' : take === 'merge' ? 'merged' : 'file';
  let chosen: Buffer | undefined;
  if (resolved === 'merged') {
    // Both changes, line by line, from the version the run copied: the checks of the finish run over the result.
    const textOf = async (digest: string | null): Promise<string> =>
      digest === null ? '' : (await getBlob(loaded.paths, digest)).toString('utf-8');
    const result = mergeLines(
      await textOf(conflict.base),
      await textOf(conflict.run),
      (await readOptional(under(ctx.root, file)))?.toString('utf-8') ?? ''
    );
    if (!result.ok) {
      throw new RunRefusal(
        'conflict',
        `${file}: the project's change and the run's touch the same lines, so they cannot be put together by themselves — take project, run, or a file you wrote with both (--take <path>)`,
        { file, next: `plitzi run resolve ${runId} ${file} --take project|run|<path>` }
      );
    }

    chosen = Buffer.from(result.text);
  }

  if (resolved === 'file') {
    chosen = await readOptional(path.resolve(ctx.root, take));
    if (chosen === undefined) {
      throw new RunRefusal('not-found', `There is no file at ${take} to resolve ${file} with`);
    }
  }

  await withLock(
    loaded.paths.mergeLock,
    async () => {
      const approved = await readApproved(loaded.paths);
      const entry = Object.hasOwn(approved.files, file) ? approved.files[file] : undefined;
      if (!entry) {
        throw new RunRefusal('invalid', `The run holds no version of ${file} any more`, { file });
      }

      const project = await fingerprint(under(ctx.root, file));
      const files = Object.fromEntries(Object.entries(approved.files).filter(([name]) => name !== file));
      const overrode = { project, by: ctx.agent, at: at(ctx) };
      if (resolved === 'run') {
        files[file] = { ...entry, base: project, overrode };
      } else if (chosen) {
        files[file] = {
          ...entry,
          digest: await putBlob(loaded.paths, chosen),
          base: project,
          at: at(ctx),
          ...(resolved === 'merged' ? { joined: overrode } : { overrode })
        };
      }

      await writeJson(loaded.paths.approved, { ...approved, files });
      const record = await readRecord(loaded.paths);
      if (!record) {
        throw new RunRefusal('not-found', `The run's record is gone from ${loaded.paths.dir}`);
      }

      await writeJson(loaded.paths.record, {
        ...record,
        reconciliation: record.reconciliation && {
          ...record.reconciliation,
          files: record.reconciliation.files.map(each => (each.file === file ? { ...each, resolved } : each))
        }
      });
    },
    { now: ctx.now }
  );
  await logRun(ctx, loaded.paths, { action: 'resolve', file, take: resolved });

  return { ...conflict, resolved };
};

/** `plitzi run continue`: every file resolved, the run goes on — the next finish checks the project again. */
export const continueRun = async (ctx: RunContext, runId: string): Promise<void> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['reconciliation'], 'continue');
  const open = loaded.record.reconciliation?.files.filter(each => each.resolved === undefined) ?? [];
  if (open.length > 0) {
    throw new RunRefusal('reconciliation', `Still to resolve: ${open.map(each => each.file).join(', ')}`, {
      files: open.map(each => each.file)
    });
  }

  requireNoTask(ctx, 'continue a run');
  await requireLead(ctx, loaded, 'continue a run');
  await updateRecord(ctx, loaded.paths, record => ({ ...record, status: 'open', reconciliation: undefined }));
  await logRun(ctx, loaded.paths, { action: 'continue' });
};

/**
 * `plitzi run abort`: the run ends writing nothing into the project — a person's change is never undone by aborting —
 * and goes, with every version it held: what its agents did is discarded, said file by file.
 */
export const abortRun = async (
  ctx: RunContext,
  runId: string
): Promise<{ discarded: string[]; report: string; inputs: RemovedInputs }> => {
  const loaded = await loadRun(ctx, runId);
  await requirePerson(ctx, runId, `abort run "${runId}" — nothing of it is written, and its agents' work is discarded`);
  const discarded = Object.keys((await readApproved(loaded.paths)).files).sort();
  const report = await leaveReport(ctx, loaded, { outcome: 'aborted', files: discarded });
  const inputs = await removeRun(ctx, loaded.paths, runId);

  return { discarded, report, inputs };
};

/** `plitzi run restore`: one project file put back from a backup — the run's opening one, or before a merge. */
export const restoreFile = async (
  ctx: RunContext,
  runId: string,
  file: string,
  from: string
): Promise<{ file: string; to: string | null; merge: string }> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  let version: string | null | undefined;
  if (from === 'base') {
    const base = await readBase(loaded.paths);
    version = Object.hasOwn(base.files, file) ? base.files[file] : undefined;
  } else {
    const merge = loaded.record.merges.find(each => each.id === from);
    version = merge && Object.hasOwn(merge.files, file) ? merge.files[file].before : undefined;
  }

  if (version === undefined) {
    throw new RunRefusal(
      'not-found',
      `Run "${runId}" kept no backup of ${file} ${from === 'base' ? 'when it opened' : `before ${from}`}`,
      {
        file
      }
    );
  }

  if (version !== null) {
    await getBlob(loaded.paths, version);
  }

  await requirePerson(
    ctx,
    runId,
    `put ${file} back as it was ${from === 'base' ? 'when the run opened' : `before ${from}`}`
  );
  const now = await fingerprint(under(ctx.root, file));
  const entry = await withLock(
    loaded.paths.mergeLock,
    async () => {
      await recoverMerges(ctx, loaded);

      return writeMerge(ctx, loaded, 'restore', { [file]: { before: now, after: version } });
    },
    { now: ctx.now }
  );
  await updateRecord(ctx, loaded.paths, record => ({ ...record, merges: [...record.merges, entry] }));
  await logRun(ctx, loaded.paths, { action: 'restore', file, from, merge: entry.id });

  return { file, to: version, merge: entry.id };
};

/** `plitzi run show`: a version the run keeps of a file — the run's, its backup when it opened, or a conflict's. */
export const showVersion = async (
  ctx: RunContext,
  runId: string,
  file: string,
  which: 'run' | 'base' | 'project'
): Promise<Buffer | undefined> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  if (which === 'project') {
    return readOptional(under(ctx.root, file));
  }

  const digest =
    which === 'base'
      ? entryOf((await readBase(loaded.paths)).files, file)
      : entryOf((await readApproved(loaded.paths)).files, file)?.digest;
  if (digest === undefined) {
    throw new RunRefusal('not-found', `Run "${runId}" holds no ${which} version of ${file}`, { file });
  }

  return digest === null ? undefined : getBlob(loaded.paths, digest);
};
