import fs from 'node:fs/promises';
import path from 'node:path';

import { isRunReport } from '@plitzi/sdk-shared/runs';

import { VIEW_HEIGHT } from '../../browser';
import { logRun } from '../run';
import { LEAD, sendMessage } from '../talk/messages';

import type { LoadedRun, RunContext } from '../run';
import type { RunReport, RunReportStep } from '@plitzi/sdk-shared/runs';

/**
 * What the person watching a run's preview reports from its page, handed to the lead: the preview's server leaves each
 * report in this folder (`RUN_REPORTS_ENV`), and the preview's watch hands it on as the person's message, with the
 * command that plays it again. A run's lead got "with tornadoes selected Strongest breaks" and reproduced it by
 * guessing the address, the layers clicked and the width.
 */
export const reportsDir = (paths: { cache: string }): string => path.join(paths.cache, 'preview-reports');

/** One argument as a shell reads it whole: in single quotes, a quote of its own closed, escaped and opened again. */
const shellArg = (text: string): string => (/^[\w./:=,@-]+$/.test(text) ? text : `'${text.replaceAll("'", `'\\''`)}'`);

/** A text no step writes: the steps quote a text in double or single quotes, and have no way to hold both. */
const unwritable = (text: string): boolean => text.includes('"') && text.includes("'");

/** A text a `type` step writes, quoted as the steps read it: in double quotes, or single when it holds one. */
const typedText = (text: string): string => (text.includes('"') ? `'${text}'` : `"${text}"`);

const stepOf = (step: RunReportStep): string =>
  step.kind === 'click'
    ? `click ${step.element}`
    : 'secret' in step
      ? `type ${step.element} "<the password>"`
      : unwritable(step.text)
        ? `type ${step.element} "<the text below>"`
        : `type ${step.element} ${typedText(step.text)}`;

/**
 * The report as the lead reads it: what the person says, where and how they saw it, what they did, and the command
 * that plays it again on `url` — the preview, whose page they were on.
 */
export const reportText = (report: RunReport, url: string): string => {
  const steps = report.steps.map(stepOf).join('; ');
  const secrets = report.steps.filter(step => 'secret' in step).map(step => step.element);
  const quoted = report.steps.flatMap(step =>
    step.kind === 'type' && 'text' in step && unwritable(step.text) ? [step] : []
  );
  const command = [
    'plitzi page shot',
    shellArg(report.path),
    `--url ${url}`,
    `--width ${String(report.width)}`,
    ...(report.height === VIEW_HEIGHT ? [] : [`--height ${String(report.height)}`]),
    `--scheme ${report.scheme}`,
    ...(steps === '' ? [] : [`--steps ${shellArg(steps)}`]),
    ...(report.element ? [`--within ${shellArg(report.element)}`] : [])
  ].join(' ');

  return [
    `The person reports from the preview, at ${String(report.width)}×${String(report.height)} ${report.scheme}${report.pageWidth === undefined ? '' : ` (the dev tools' panel open: the page ${String(report.pageWidth)} px wide)`}: "${report.text}"`,
    ...(report.seenOn ? [`They were on ${report.seenOn}, where their steps took them from ${report.path}.`] : []),
    ...(report.element ? [`Pointed at: ${report.element}.`] : ['Pointed at nothing: the page as a whole.']),
    steps === ''
      ? 'Did nothing on the page before it: what it shows as it loads.'
      : `What they did: ${steps}${report.earlier ? ` (${String(report.earlier)} earlier left out)` : ''}.`,
    ...(secrets.length > 0 ? [`A password typed into ${secrets.join(', ')} was not sent: write it in its place.`] : []),
    ...quoted.map(
      step =>
        `What they typed into ${step.element} holds both quote marks, which no step writes — type it there: ${step.text}`
    ),
    `Play it: ${command}`
  ].join('\n');
};

/** One report handed to the lead and logged — or refused, when the file is no report, and kept apart. */
const handReport = async (ctx: RunContext, loaded: LoadedRun, file: string, url: string): Promise<void> => {
  let read: unknown;
  try {
    read = JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    read = undefined;
  }

  if (!isRunReport(read)) {
    await fs.rename(file, `${file}.refused`);
    await logRun(ctx, loaded.paths, {
      by: 'person',
      action: 'report-refused',
      file: `${path.basename(file)}.refused`
    });

    return;
  }

  const told = await sendMessage(ctx, loaded, { from: 'person', to: LEAD, text: reportText(read, url), fyi: true });
  await fs.rm(file, { force: true });
  await logRun(ctx, loaded.paths, {
    by: 'person',
    action: 'report',
    message: told.id,
    path: read.path,
    width: read.width,
    ...(read.element ? { element: read.element } : {})
  });
};

/**
 * Every report the preview's server left, handed to the lead as the person's message and logged, then removed. One
 * that is no report — written by something else — is kept apart (`.refused`), and one that could not be handed
 * (`.failed`), each logged once with why: never dropped unsaid, never tried again every round.
 */
export const handReports = async (ctx: RunContext, loaded: LoadedRun, url: string): Promise<void> => {
  const dir = reportsDir(loaded.paths);
  const names = (await fs.readdir(dir).catch(() => [])).filter(name => name.endsWith('.json')).sort();
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      await handReport(ctx, loaded, file, url);
    } catch (error) {
      await fs.rename(file, `${file}.failed`).catch(() => undefined);
      await logRun(ctx, loaded.paths, {
        by: 'person',
        action: 'report-failed',
        file: `${name}.failed`,
        why: error instanceof Error ? error.message : String(error)
      });
    }
  }
};
