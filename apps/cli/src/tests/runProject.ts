import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { CheckResult, CheckRunner } from '../runs/checks';
import type { RunPlan } from '../runs/model';
import type { RunContext } from '../runs/run';
import type { Team } from '../runs/team';

/**
 * The bench of the runs of several agents: a seeded project in a folder of its own, and scripted agents — contexts that call the run's
 * commands as a harness would, each with its own name and token — over one clock the test moves. No model, no network:
 * every run is the same run.
 */

/** A small space as a project lays one out: a page that is a folder, pages importing shared tokens and classes. */
export const PROJECT_FILES: Record<string, string> = {
  'package.json': `${JSON.stringify({ name: 'bench', type: 'module', private: true }, null, 2)}\n`,
  '.env': 'PLITZI_SECRET=never-copied\n',
  '.env.example': 'PLITZI_SECRET=\n',
  'src/space/index.ts': `import { tokens } from './tokens.ts';
import { theme } from './theme.ts';
import { home } from './pages/home/index.ts';
import { menu } from './pages/menu.ts';
import { book } from './pages/book.ts';
import { about } from './pages/about.ts';

export const space = { tokens, theme, pages: [home, menu, book, about] };
`,
  'src/space/tokens.ts': `export const tokens = { ink: '#111' };
`,
  'src/space/theme.ts': `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink } };
`,
  'src/space/pages/home/index.ts': `import { hero } from './hero.ts';
import { theme } from '../../theme.ts';

export const home = { id: 'home', body: [hero], theme };
`,
  'src/space/pages/home/hero.ts': `export const hero = { text: 'Welcome' };
`,
  'src/space/pages/menu.ts': `import { theme } from '../theme.ts';

export const menu = { id: 'menu', title: 'Menu', theme };
`,
  'src/space/pages/book.ts': `import { theme } from '../theme.ts';

export const book = { id: 'book', title: 'Book', theme };
`,
  'src/plugins/Badge/declaration.ts': `export default { type: 'badge' };
`,
  'src/plugins/Badge/index.ts': `import declaration from './declaration.ts';

export default declaration;
`,
  'src/space/pages/about.ts': `export const about = { id: 'about', title: 'About' };
`,
  'src/data/menu.json': '{ "items": [] }\n',
  'public/logo.png': '\u0089PNG-bytes-no-check-reads'
};

export interface Bench {
  root: string;
  /** The clock every agent reads: moved by the test. */
  advance: (ms: number) => void;
  now: () => Date;
  /** A scripted agent, or the coordinator (no token), or a person who confirms (or not) by typing the run's name. */
  agent: (name: string, overrides?: Partial<RunContext>) => RunContext;
  person: (confirms?: boolean) => RunContext;
  /** What the project's checks answer: pass, unless a file of the folder checked holds `BROKEN`. */
  checks: CheckRunner;
  checked: string[];
  write: (file: string, text: string) => Promise<void>;
  read: (file: string) => Promise<string | undefined>;
  writePlan: (plan: RunPlan) => Promise<string>;
  /** The project's team, `.plitzi/team.json`: what every run is worked by. */
  writeTeam: (team: Team) => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * The file of `dir/src` that fails the bench's checks: one holding `BROKEN`, or one holding `NEEDS:<name>` where no
 * file holds `HAS:<name>` — a file that reads what another declares (lx-copy: t-shell's shell, reading keys its
 * request on site.json held).
 */
const holdsBroken = async (dir: string): Promise<string | undefined> => {
  const texts: { file: string; text: string }[] = [];
  const walk = async (at: string): Promise<void> => {
    for (const entry of await fs.readdir(at, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        texts.push({ file: path.relative(dir, full), text: await fs.readFile(full, 'utf-8') });
      }
    }
  };
  await walk(path.join(dir, 'src'));
  const has = new Set(texts.flatMap(({ text }) => [...text.matchAll(/HAS:(\w+)/g)].map(match => match[1])));

  return texts.find(
    ({ text }) => text.includes('BROKEN') || [...text.matchAll(/NEEDS:(\w+)/g)].some(match => !has.has(match[1]))
  )?.file;
};

export const makeBench = async (files: Record<string, string> = PROJECT_FILES): Promise<Bench> => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-runs-')));
  for (const [file, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }

  let clock = Date.now();
  const now = (): Date => new Date(clock);
  const checked: string[] = [];
  const checks: CheckRunner = async (dir): Promise<CheckResult> => {
    checked.push(dir);
    const broken = await holdsBroken(dir);

    return broken
      ? { ok: false, steps: [{ name: 'author', ok: false, said: [`${broken}: BROKEN`] }] }
      : { ok: true, steps: [{ name: 'author', ok: true }] };
  };
  const base = (agent: string): RunContext => ({
    root,
    now,
    machine: 'bench',
    cli: '0.0.0-bench',
    agent,
    person: () => Promise.resolve(false),
    checks
  });

  return {
    root,
    advance: ms => {
      clock += ms;
    },
    now,
    agent: (name, overrides = {}) => ({ ...base(name), ...overrides }),
    person: (confirms = true) => ({ ...base('person'), person: () => Promise.resolve(confirms) }),
    checks,
    checked,
    write: async (file, text) => {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), text);
    },
    read: file => fs.readFile(path.join(root, file), 'utf-8').catch(() => undefined),
    writeTeam: async team => {
      await fs.mkdir(path.join(root, '.plitzi'), { recursive: true });
      await fs.writeFile(path.join(root, '.plitzi', 'team.json'), JSON.stringify(team));
    },
    writePlan: async plan => {
      const file = path.join(root, `${plan.runId}.plan.json`);
      await fs.writeFile(file, JSON.stringify(plan));

      return file;
    },
    cleanup: () => fs.rm(root, { recursive: true, force: true })
  };
};

/** A plan over the bench's pages: one task a page, a fourth that depends on two. */
export const benchPlan = (runId = 'es-launch'): RunPlan => ({
  version: 1,
  runId,
  goal: 'Spanish version of the pages',
  tasks: [
    {
      id: 't-home',
      title: 'Translate home',
      files: ['src/space/pages/home/index.ts'],
      dependsOn: [],
      priority: 'high',
      estimateMinutes: 20,
      acceptance: ['Home reads in Spanish']
    },
    {
      id: 't-menu',
      title: 'Translate menu',
      files: ['src/space/pages/menu.ts'],
      dependsOn: [],
      priority: 'medium',
      estimateMinutes: 20,
      acceptance: ['Menu reads in Spanish']
    },
    {
      id: 't-book',
      title: 'Translate book',
      files: ['src/space/pages/book.ts'],
      dependsOn: ['t-home', 't-menu'],
      priority: 'medium',
      estimateMinutes: 20,
      acceptance: ['Book reads in Spanish']
    },
    {
      id: 't-about',
      title: 'Translate about',
      files: ['src/space/pages/about.ts'],
      dependsOn: [],
      priority: 'low',
      estimateMinutes: 10,
      acceptance: ['About reads in Spanish']
    }
  ]
});

/** Writes into a task's copy, as its agent's harness would with its own tools. */
export const writeInCopy = async (work: string, file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(work, file)), { recursive: true });
  await fs.writeFile(path.join(work, file), text);
};

export const readInCopy = (work: string, file: string): Promise<string | undefined> =>
  fs.readFile(path.join(work, file), 'utf-8').catch(() => undefined);

/** A team of `count` agents, each taking every role the plan's tasks name: a run held only by how many work at once. */
export const teamFor = (plan: Pick<RunPlan, 'tasks'>, count: number): Team => ({
  version: 1,
  agents: [
    {
      name: 'agent',
      roles: [...new Set(['developer', ...plan.tasks.map(task => task.role ?? 'developer')])],
      count
    }
  ]
});
