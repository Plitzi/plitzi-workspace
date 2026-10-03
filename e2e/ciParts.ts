import { categories } from './categories';

/** The parts CI runs the suite in, each on a runner of its own (`.github/workflows/ci.yml`), printed as the `--project`
 *  flags for one of them: `node --import tsx ciParts.ts server`.
 *
 *  Two are named and `server` is the rest, so a category added to `categories.ts` runs in CI without anybody adding it
 *  here. `examples` is a part of its own because it holds the one long serial chain. */
const NAMED: Record<string, string[]> = {
  apps: ['sdk', 'desktop', 'builder'],
  examples: ['examples']
};

const named = new Set(Object.values(NAMED).flat());

const parts = new Map<string, string[]>([
  ...Object.entries(NAMED),
  ['server', categories.map(category => category.name).filter(name => !named.has(name))]
]);

const part = process.argv[2] ?? '';
const projects = parts.get(part);
if (!projects) {
  console.error(`No CI part "${part}": ${[...parts.keys()].join(', ')}`);
  process.exit(1);
}

console.log(projects.map(name => `--project=${name}`).join(' '));
