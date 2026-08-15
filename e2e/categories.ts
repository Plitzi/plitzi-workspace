/** The suite, cut into categories you can run on their own.
 *
 *  Each one is a Playwright project, so `yarn e2e --project=rsc` runs that slice — and boots only the servers that
 *  slice needs, because the targets are declared here rather than guessed. The last ones cross surfaces on
 *  purpose: most of what breaks in this repo breaks BETWEEN two things that each work. */

export type Category = {
  name: string;
  /** One line, shown in `yarn e2e:list`. */
  what: string;
  /** Target ids from `targets.ts` this category needs running. */
  targets: string[];
};

const EXAMPLE_TARGETS = [
  'no-build',
  'render',
  'react-component',
  'server-rendered',
  'server-components',
  'mcp-server',
  'ssr-preview',
  'sessions',
  'mysql'
];

export const categories: Category[] = [
  {
    name: 'sdk',
    what: 'The SDK rendering in a browser: every element type, styles, viewports, arbitrary schemas',
    targets: ['harness']
  },
  {
    name: 'ssr',
    what: 'Pages rendered by the server — what arrives before a single script runs, and what happens after',
    targets: ['server']
  },
  {
    name: 'rsc',
    what: 'Per-element server data: the three runtimes, the slices, the partial refresh',
    targets: ['server']
  },
  {
    name: 'preview',
    what: 'Draft renders that are never saved, and the token that serves one exactly once',
    targets: ['server']
  },
  {
    name: 'mcp',
    what: 'The endpoint an agent connects to, mounted beside the pages it edits',
    targets: ['server']
  },
  {
    name: 'builder',
    what: 'The visual builder',
    targets: ['builder']
  },
  {
    name: 'examples',
    what: 'Every example still does what its own README says it does',
    targets: EXAMPLE_TARGETS
  },
  {
    name: 'combined',
    what: 'Flows that cross surfaces: the same space through both render paths, an agent edit reaching a page',
    targets: ['harness', 'server']
  }
];

/** Playwright's `--project` flags for this run, read off the command line. The config needs them BEFORE Playwright
 *  parses anything, to decide which servers to boot: running one category should not start ten servers. */
export const requestedCategories = (): string[] => {
  const names: string[] = [];

  process.argv.forEach((argument, index) => {
    if (argument === '--project' || argument === '-p') {
      const next = process.argv[index + 1];

      if (next && !next.startsWith('-')) {
        names.push(next);
      }

      return;
    }

    if (argument.startsWith('--project=')) {
      names.push(argument.slice('--project='.length));
    }
  });

  return names;
};

/** Every target the selected categories need. No selection means the whole suite, which needs all of them. */
export const targetsForRun = (): string[] => {
  const requested = requestedCategories();
  const active = requested.length ? categories.filter(category => requested.includes(category.name)) : categories;

  return [...new Set(active.flatMap(category => category.targets))];
};
