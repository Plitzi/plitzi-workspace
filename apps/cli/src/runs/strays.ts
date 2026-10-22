import fs from 'node:fs/promises';
import path from 'node:path';

import { readOptional, writeJson } from './files';
import { coLeadsOf, isPrincipal } from './leads';
import { agentAddress, sendMessage } from './messages';
import { TOOL_TMP } from './paths';
import { readTeam, startedAgents } from './team';
import { PROJECT_TMP } from '../scaffold/paths';

import type { RunRecord } from './model';
import type { LoadedRun, RunContext } from './run';

/**
 * What appeared in the project's `tmp/` since the run opened that neither the CLI nor the project's server keeps there,
 * nor the lead handed the run: an agent's script, log or picture, written beside the project instead of in its copy or
 * its scratch (la-velada: `tmp/dev1/`, a co-lead's preview log). Read one level deep — said, never removed: the
 * project's `tmp/` is the person's too.
 */
export const leftInTmp = async (root: string, record: Pick<RunRecord, 'openedAt' | 'inputs'>): Promise<string[]> => {
  const since = Date.parse(record.openedAt);
  const entries = await fs.readdir(path.join(root, PROJECT_TMP), { withFileTypes: true }).catch(() => []);
  const left: string[] = [];
  for (const entry of entries) {
    const file = `${PROJECT_TMP}/${entry.name}`;
    const handed = record.inputs.some(input => input.file === file || input.file.startsWith(`${file}/`));
    // A plan or a stage the lead is writing, to hand the run: its, before it is handed (velada-shell's stage, told to
    // dev-1 in the seconds before \`run extend\` took it).
    const toHand = !entry.isDirectory() && /\.(plan|stage)\.json$/.test(entry.name);
    if (TOOL_TMP.includes(file) || handed || toHand) {
      continue;
    }

    const stat = await fs.stat(path.join(root, file)).catch(() => undefined);
    // Its birth where the disk keeps one, else its last change: either is after the run opened for what it left.
    const at = stat ? stat.birthtimeMs || stat.mtimeMs : 0;
    if (at >= since) {
      left.push(entry.isDirectory() ? `${file}/` : file);
    }
  }

  return left.sort();
};

const toldFile = (loaded: LoadedRun): string => path.join(loaded.paths.dir, 'left-in-tmp.json');

/**
 * What is new in the project's `tmp/` said to every agent, once each — whoever left it hears it with its next command,
 * whatever it holds: the lead's notice alone reached the one who did it only if the lead passed it
 * on (la-velada: a dev's scratch and a co-lead's log). Run at the agents' own commands, never at a read.
 */
export const tellLeftInTmp = async (ctx: RunContext, loaded: LoadedRun): Promise<string[]> => {
  const left = await leftInTmp(ctx.root, loaded.record);
  const bytes = await readOptional(toldFile(loaded));
  const parsed: unknown = bytes === undefined ? [] : JSON.parse(bytes.toString('utf-8'));
  const told = new Set(Array.isArray(parsed) ? parsed.filter((each): each is string => typeof each === 'string') : []);
  const fresh = left.filter(file => !told.has(file));
  if (fresh.length === 0) {
    return [];
  }

  await writeJson(toldFile(loaded), [...told, ...fresh].sort());
  // Each agent by name: a message to every task reaches only the tasks, and an agent between tasks — where a scratch
  // file is most often written — holds none. The principal lead sees it among what needs it.
  const team = await readTeam(ctx.root);
  const agents = new Set([
    ...(team ? startedAgents(team).map(each => each.agent) : []),
    ...coLeadsOf(loaded.record),
    ctx.agent
  ]);
  const text = `Left in the project's tmp/, by none of the CLI's tools: ${fresh.join(', ')}. The project's tmp/ is the person's — what is yours beside the work goes in your copy's tmp/, or between tasks in your scratch (plitzi task next names it), both gone with the run. If it is yours, move it there`;
  for (const agent of [...agents].filter(name => !isPrincipal(name)).sort()) {
    // The CLI's own word, not the lead's: nobody asked it, the run saw it.
    await sendMessage(ctx, loaded, { from: 'plitzi', to: agentAddress(agent), text });
  }

  return fresh;
};
