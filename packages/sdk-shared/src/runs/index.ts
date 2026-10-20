import { isRecord } from '../helpers';

/**
 * A run of agents (`plitzi run`), as the page its preview serves can show it: `plitzi run preview` keeps a snapshot of
 * the run in a file and names it to the project's server (`RUN_STATUS_ENV`), which answers it at `RUN_STATUS_PATH`, and
 * the dev tools draw it (their Run tab). Written by the CLI, read by the dev tools: this is what both agree it holds.
 * Only a preview's server answers it — a project's own `start:dev`, or a deployment, has no run behind it.
 */

/** Where the preview's server answers the run's snapshot. */
export const RUN_STATUS_PATH = '/__plitzi/run';

/** The variable that names the snapshot's file to the preview's server. */
export const RUN_STATUS_ENV = 'PLITZI_RUN_STATUS';

export interface RunSnapshotTask {
  id: string;
  title: string;
  role: string;
  status: string;
  /** The agent that holds it. */
  agent?: string;
  /** The lead reviewing it, while it is in review and one took it. */
  reviewer?: string;
  round: number;
  /** What it writes, by project path. */
  files: string[];
  step?: string;
  fraction?: number;
}

export interface RunSnapshot {
  runId: string;
  goal: string;
  status: string;
  done: number;
  total: number;
  /** When the CLI wrote it, ISO in UTC. */
  at: string;
  expectedEnd?: string;
  tasks: RunSnapshotTask[];
  /** What needs someone: a block, a question, a notice — and who acts on it. */
  attention: { text: string; who: string }[];
}

const isTask = (value: unknown): value is RunSnapshotTask =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.role === 'string' &&
  typeof value.status === 'string' &&
  typeof value.round === 'number' &&
  Array.isArray(value.files) &&
  value.files.every(file => typeof file === 'string');

export const isRunSnapshot = (value: unknown): value is RunSnapshot =>
  isRecord(value) &&
  typeof value.runId === 'string' &&
  typeof value.goal === 'string' &&
  typeof value.status === 'string' &&
  typeof value.done === 'number' &&
  typeof value.total === 'number' &&
  typeof value.at === 'string' &&
  Array.isArray(value.tasks) &&
  value.tasks.every(isTask) &&
  Array.isArray(value.attention) &&
  value.attention.every(item => isRecord(item) && typeof item.text === 'string' && typeof item.who === 'string');
