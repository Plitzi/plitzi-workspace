import fs from 'node:fs/promises';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { feedbackBrief } from './brief';
import { feedbackFacts } from './facts';
import { privateIn, privateWords } from './privacy';
import { reportTemplate } from './template';
import { findProject } from '../commands/project/existingProject';
import { fail } from '../commands/shared/terminal';
import { AGENT_REPORTS_DIR } from '../scaffold/paths';

import type { FeedbackFacts } from './facts';

/**
 * `plitzi feedback`: the start of a report to Plitzi, for the agent to write and the developer to send as a link. It
 * reads what the report must not get wrong — the versions, the project, what `plitzi doctor` says — writes the page the
 * report is laid out in, in a folder of its own beside the runs' reports (`.plitzi/plitzi-reports/agents/<date>/`,
 * committed with the project), and says to the agent how to fill and publish it.
 */

export interface FeedbackOptions {
  /** Earlier reports this one continues: their numbering, and what changed of what they found. */
  previous?: string[];
  /** A filled report, checked for what of the person or the project it holds — before it is published. */
  check?: string;
  json?: boolean;
}

/** What `--json` answers: the page to fill, the facts in it and the instructions. */
export interface FeedbackAnswer {
  file: string;
  facts: FeedbackFacts;
  brief: string;
}

const ARTIFACT_URL = /^https:\/\/claude\.ai\/(?:code\/)?artifact\/[\w-]+(?:[?#].*)?$/;

/** The page, in a folder of the project's reports of its own — the day's, or the day's next — or of the folder it runs in. */
const reportFile = async (from: string, date: string): Promise<string> => {
  const root = (await findProject(from))?.root ?? from;
  const reports = path.join(root, AGENT_REPORTS_DIR);
  await fs.mkdir(reports, { recursive: true });
  const taken = new Set(await fs.readdir(reports));
  let name = date;
  for (let n = 2; taken.has(name); n++) {
    name = `${date}-${String(n)}`;
  }

  await fs.mkdir(path.join(reports, name));

  return path.join(reports, name, 'report.html');
};

const REPORT_START = 'const REPORT = ';
const REPORT_END = '\nconst L = REPORT.labels;';

/** Every text of a value, each on a line of its own. */
const textsOf = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(textsOf)
      : isRecord(value)
        ? Object.values(value).flatMap(textsOf)
        : [];

/**
 * The `REPORT` an agent filled, read off its page: its texts — never its labels, which are the page's words — and what
 * the developer agreed to send (`shared`). Read as the object literal it is, in a context of its own with nothing in it.
 */
export const reportTexts = (page: string): { texts: string[]; shared: string[] } | { problem: string } => {
  const start = page.indexOf(REPORT_START);
  const end = page.indexOf(REPORT_END, start);
  if (start < 0 || end < 0) {
    return { problem: 'it is no page plitzi feedback wrote: its REPORT object is not there' };
  }

  const literal = page
    .slice(start + REPORT_START.length, end)
    .trim()
    .replace(/;$/, '');
  let value: unknown;
  try {
    // A context with no prototype and nothing in it: `Object.create(null)` is typed `any`, and a context is an object.
    value = runInNewContext(`(${literal})`, Object.create(null) as object, { timeout: 1000 });
  } catch (error) {
    return { problem: `its REPORT does not read: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (!isRecord(value)) {
    return { problem: 'its REPORT is not an object' };
  }

  const { labels: _labels, lang: _lang, shared, ...written } = value;

  return {
    texts: textsOf(written),
    shared: Array.isArray(shared) ? shared.filter((each): each is string => typeof each === 'string') : []
  };
};

/**
 * `plitzi feedback --check <file>`: what of the person or the project a filled report still holds, each named — what
 * the agent writes over, or agrees with the developer before publishing. Exit 1 while anything is left.
 */
const checkReport = async (file: string, json: boolean): Promise<void> => {
  const page = await fs.readFile(file, 'utf-8').catch(() => undefined);
  if (page === undefined) {
    fail(`${file} cannot be read: name the report.html plitzi feedback wrote.`);

    return;
  }

  const read = reportTexts(page);
  if ('problem' in read) {
    fail(`${file}: ${read.problem}.`);

    return;
  }

  const root = (await findProject(path.dirname(path.resolve(file))))?.root ?? process.cwd();
  const found = privateIn(read.texts.join('\n'), await privateWords(root), read.shared);
  if (json) {
    console.log(JSON.stringify({ file, found, shared: read.shared }));
  } else if (found.length === 0) {
    console.log(
      `✓ Nothing of the person or the project found in ${file}${read.shared.length > 0 ? ` but the ${String(read.shared.length)} passage(s) the developer agreed to send (shared)` : ''}: publish it.`
    );
  } else {
    console.log(
      [
        `${String(found.length)} thing(s) of the person or the project in ${file} — a report to Plitzi says how Plitzi behaved, never what was built with it:`,
        ...found.map(each => `  - ${each}`),
        'Write each over with a <placeholder>. One a finding cannot be understood without: ask the developer, saying what would be sent and why, and with their yes list it word for word in REPORT.shared.'
      ].join('\n')
    );
  }

  if (found.length > 0) {
    process.exitCode = 1;
  }
};

export const feedback = async (options: FeedbackOptions): Promise<void> => {
  if (options.check !== undefined) {
    return checkReport(options.check, options.json === true);
  }

  const previous = options.previous ?? [];
  const wrong = previous.filter(url => !ARTIFACT_URL.test(url));
  if (wrong.length > 0) {
    fail(`--previous takes the link of an earlier report, a claude.ai artifact: ${wrong.join(', ')} is not one.`);

    return;
  }

  const facts = await feedbackFacts(process.cwd());
  const file = await reportFile(process.cwd(), facts.date);
  await fs.writeFile(file, reportTemplate(facts, previous));
  const shown = path.relative(process.cwd(), file) || file;
  const brief = feedbackBrief(facts, shown, previous);
  const answer: FeedbackAnswer = { file, facts, brief };
  console.log(options.json ? JSON.stringify(answer) : brief);
};
