/** The suite, cut the way the monorepo is: **one category per app**, and sub-categories inside it.
 *
 *  A flat list of every feature would be unreadable long before it was complete — this repo has four apps and each
 *  will keep growing surfaces. So the top level answers "which app is this about", and the level below answers
 *  "which part of it". Both are addressable:
 *
 *  ```bash
 *  yarn e2e --project=server                 # the whole page server
 *  yarn e2e --project=server --grep @rsc     # one part of it
 *  yarn e2e tests/server/rsc                 # the same, by path
 *  ```
 *
 *  Two categories are not apps, and say so: `cross` is what needs more than one, and `examples` is the onboarding
 *  promise rather than a piece of software. */

export type Subcategory = {
  /** Directory under `tests/<category>/`, and the tag its specs carry. */
  name: string;
  what: string;
};

export type Category = {
  name: string;
  /** The workspace this category is about, or undefined when it is not about one app. */
  app?: string;
  what: string;
  /** Target ids from `targets.ts` this category needs running. */
  targets: string[];
  subcategories: Subcategory[];
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
  'mysql',
  'server-actions',
  'server-actions-render',
  'server-actions-no-server'
];

export const categories: Category[] = [
  {
    name: 'sdk',
    app: '@plitzi/plitzi-sdk',
    what: 'The SDK rendering in a browser',
    targets: ['harness'],
    subcategories: [
      { name: 'rendering', what: 'Every element type, the space stylesheet, schemas handed over at runtime' },
      { name: 'viewports', what: 'The same space from a phone to a wide desktop' }
    ]
  },
  {
    name: 'server',
    app: '@plitzi/sdk-server',
    what: 'The page server: what it renders, and who it renders it for',
    targets: ['server', 'auth-server'],
    subcategories: [
      { name: 'ssr', what: 'What arrives before a script runs, and what happens after' },
      { name: 'rsc', what: 'Per-element server data: the three runtimes, the slices, the partial refresh' },
      { name: 'preview', what: 'Draft renders that are never saved, and the one-shot token' },
      { name: 'auth', what: 'A visitor becoming a member and back: guest/member pages, sessions, bindings' }
    ]
  },
  {
    name: 'mcp',
    app: '@plitzi/sdk-mcp',
    what: 'The endpoint an agent connects to',
    targets: ['server'],
    subcategories: [{ name: 'endpoint', what: 'The handshake, and not shadowing the pages it sits in front of' }]
  },
  {
    name: 'builder',
    app: '@plitzi/plitzi-builder',
    what: 'The visual builder',
    targets: ['builder'],
    subcategories: [{ name: 'boot', what: 'It mounts and paints its first screen' }]
  },
  {
    name: 'cross',
    what: 'Flows that need more than one app — where most real breakage lives',
    targets: ['harness', 'server', 'auth-server'],
    subcategories: [
      { name: 'parity', what: 'The same space through both render paths, agreeing' },
      { name: 'agent', what: 'An agent edit reaching a page: MCP, preview and the renderer in one line' },
      { name: 'auth', what: 'Access levels decided the same way with a server and without one' }
    ]
  },
  {
    name: 'examples',
    what: 'Every example still does what its own README says',
    targets: EXAMPLE_TARGETS,
    subcategories: []
  }
];

/** Playwright's `--project` flags for this run, read off the command line. The config needs them BEFORE Playwright
 *  parses anything, to decide which servers to boot: running one category should not start every server. */
export const requestedCategories = (): string[] => {
  const names: string[] = [];

  process.argv.forEach((argument, index) => {
    if (argument === '--project') {
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

const isUiMode = (): boolean => process.argv.includes('--ui');

/** Every target the selected categories need.
 *
 *  No selection means the whole suite — except in UI mode, where it means every category but `examples`. Playwright
 *  starts every declared server before it can show anything, and the examples are nine of them: unscoped, the UI
 *  would sit on an empty panel for the better part of a minute with nothing on screen to say why. The surfaces the
 *  suite owns start in seconds, and `yarn e2e:ui --project=examples` brings the rest when they are the subject. */
export const targetsForRun = (): string[] => {
  const requested = requestedCategories();

  if (requested.length) {
    return unique(categories.filter(category => requested.includes(category.name)));
  }

  return unique(isUiMode() ? categories.filter(category => category.name !== 'examples') : categories);
};

const unique = (selected: Category[]): string[] => [...new Set(selected.flatMap(category => category.targets))];
