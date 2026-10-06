import type { Tone } from './theme.ts';

/**
 * What the page says, as data: the docs it points to, the three ways to change it and the guides to read on. Each band
 * is one of these lists mapped through one function of `index.ts` — add an entry and a card appears, styled like the
 * rest.
 */

/** Where the documentation lives. Every link on the page starts here, so moving the docs is one line. */
export const DOCS = 'https://plitzi.com/docs';

export type Path = { id: string; title: string; body: string; path: string; icon: string; tone: Tone };

/**
 * The three ways to change this page — the builder, code, an agent — as data: the band is this list, mapped. They
 * are the same space either way, so any one of them can be put down and another picked up.
 */
export const PATHS: (Path & { command?: string })[] = [
  {
    id: 'path-builder',
    title: 'In the builder',
    body: 'Select anything on this page and change it: drag elements in, style them, wire them to data, and publish.',
    path: 'elements',
    icon: 'fas fa-pen-ruler',
    tone: 'violet'
  },
  {
    id: 'path-code',
    title: 'In code',
    body: 'The same space as TypeScript, in a project of your own — served by your server, or pushed back here.',
    path: 'cli',
    icon: 'fas fa-code',
    tone: 'cyan',
    command: 'npx @plitzi/cli create my-site'
  },
  {
    id: 'path-agent',
    title: 'With an agent',
    body: 'Connect Claude or any MCP client. It reads and edits this space under the same rules as you do.',
    path: 'agents',
    icon: 'fas fa-robot',
    tone: 'blue'
  }
];

/** Where to read on, as data: the grid below is this list, mapped. Each one is a page of the docs. */
export const GUIDES: Path[] = [
  {
    id: 'concepts',
    title: 'Core concepts',
    body: 'Spaces, pages, elements, and who owns what.',
    path: 'concepts',
    icon: 'fas fa-shapes',
    tone: 'violet'
  },
  {
    id: 'authoring',
    title: 'A space in code',
    body: 'One declaration in, two documents out.',
    path: 'authoring',
    icon: 'fas fa-code',
    tone: 'cyan'
  },
  {
    id: 'styling',
    title: 'Styling and themes',
    body: 'Classes, states, breakpoints, light and dark.',
    path: 'styling',
    icon: 'fas fa-palette',
    tone: 'rose'
  },
  {
    id: 'data',
    title: 'Data and bindings',
    body: 'Fetch from an API, show it anywhere.',
    path: 'data',
    icon: 'fas fa-database',
    tone: 'emerald'
  },
  {
    id: 'interactions',
    title: 'Interactions and flows',
    body: 'Clicks and forms wired to steps, no code.',
    path: 'interactions',
    icon: 'fas fa-bolt',
    tone: 'amber'
  },
  {
    id: 'quickstart',
    title: 'Quickstart',
    body: 'From a new space to a published site.',
    path: 'quickstart',
    icon: 'fas fa-flag-checkered',
    tone: 'blue'
  }
];
