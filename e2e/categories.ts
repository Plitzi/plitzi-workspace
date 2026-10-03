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
 *  promise rather than a piece of software — run only when asked for (`yarn e2e --project=examples`), never as part
 *  of the workspace's own checks. */

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
  /** Left out of every run that does not name it with `--project`, CI's included. */
  onRequest?: boolean;
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
  'server-actions-no-server',
  'server-actions-schedules',
  'runtime'
];

export const categories: Category[] = [
  {
    name: 'sdk',
    app: '@plitzi/plitzi-sdk',
    what: 'The SDK rendering in a browser',
    targets: ['harness'],
    subcategories: [
      { name: 'rendering', what: 'Every element type, the space stylesheet, schemas handed over at runtime' },
      { name: 'viewports', what: 'The same space from a phone to a wide desktop' },
      { name: 'theme', what: 'Light and dark as a page and as an embedded surface — the colours, not just the class' }
    ]
  },
  {
    name: 'desktop',
    app: '@plitzi/plitzi-desktop',
    what: 'The desktop window, its renderer driven in a browser',
    targets: ['desktop'],
    subcategories: [{ name: 'theme', what: 'The window’s theme, and the spaces it embeds keeping out of it' }]
  },
  {
    name: 'server',
    app: '@plitzi/sdk-server',
    what: 'The page server: what it renders, and who it renders it for',
    targets: [
      'server',
      'auth-server',
      'action-server',
      'published-server',
      'devtools-server',
      'flags-server',
      'flags-no-debug-server',
      'mail-sink',
      'workers-server',
      'plugin-server',
      'from-space-server'
    ],
    subcategories: [
      { name: 'ssr', what: 'What arrives before a script runs, and what happens after' },
      { name: 'rsc', what: 'Per-element server data: the three runtimes, the slices, the partial refresh' },
      {
        name: 'actions',
        what: 'Flows run on the server: inside the render, from a click, and out through the space’s own SMTP server'
      },
      { name: 'preview', what: 'Draft renders that are never saved, and the one-shot token' },
      { name: 'auth', what: 'A visitor becoming a member and back: guest/member pages, sessions, bindings' },
      { name: 'workers', what: 'One port served by several processes: the load spread, every page the same' },
      {
        name: 'flags',
        what: 'Feature flags: gated elements and pages, every layer that decides one, and a tester forcing one'
      },
      { name: 'plugins', what: 'A plugin package from the CLI, published and loaded by a page from its manifest' },
      {
        name: 'fromSpace',
        what: 'A space taken out of Plitzi with plitzi create --from, served whole by the project the CLI wrote'
      }
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
    subcategories: [],
    onRequest: true
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

/** The categories this run can see: every one but those run only on request, and those too when `--project` names
 *  them. A category left out is not a Playwright project at all, so its specs cannot run without their servers. */
export const visibleCategories = (): Category[] => {
  const requested = requestedCategories();

  return categories.filter(category => !category.onRequest || requested.includes(category.name));
};

/** Every target the selected categories need: the ones `--project` names, or every visible one. */
export const targetsForRun = (): string[] => {
  const requested = requestedCategories();

  if (requested.length) {
    return unique(categories.filter(category => requested.includes(category.name)));
  }

  return unique(visibleCategories());
};

const unique = (selected: Category[]): string[] => [...new Set(selected.flatMap(category => category.targets))];
