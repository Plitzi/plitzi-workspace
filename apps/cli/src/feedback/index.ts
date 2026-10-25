import fs from 'node:fs/promises';
import path from 'node:path';

import { feedbackBrief } from './brief';
import { feedbackFacts } from './facts';
import { reportTemplate } from './template';
import { findProject } from '../commands/existingProject';
import { fail } from '../commands/terminal';
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

export const feedback = async (options: FeedbackOptions): Promise<void> => {
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
