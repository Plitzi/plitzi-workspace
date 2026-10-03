import { categories } from './categories';

/** The parts CI runs the suite in, each on a runner of its own (`.github/workflows/ci.yml`), printed as the `--project`
 *  flags for one of them: `node --import tsx ciParts.ts server`.
 *
 *  One is named and `server` is the rest, so a category added to `categories.ts` runs in CI without anybody adding it
 *  here. A category run only on request is in neither. */
const NAMED: Record<string, string[]> = {
  apps: ['sdk', 'desktop', 'builder']
};

const named = new Set(Object.values(NAMED).flat());

const parts = new Map<string, string[]>([
  ...Object.entries(NAMED),
  [
    'server',
    categories.filter(category => !category.onRequest && !named.has(category.name)).map(category => category.name)
  ]
]);

const part = process.argv[2] ?? '';
const projects = parts.get(part);
if (!projects) {
  console.error(`No CI part "${part}": ${[...parts.keys()].join(', ')}`);
  process.exit(1);
}

console.log(projects.map(name => `--project=${name}`).join(' '));
