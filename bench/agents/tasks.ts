import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { authoredSchema, savedSchema } from './fixtures';

/**
 * What the agents are asked to do: half on a space through the MCP, half on a project through the CLI — one of them
 * after a person moved the file the change is in. Each is checked on the result, never on what the agent says it did.
 */

export type Scenario = 'mcp' | 'cli';

export interface Check {
  ok: boolean;
  why?: string;
}

export interface Task {
  id: string;
  scenario: Scenario;
  prompt: string;
  /** What a person did to the project before the agent arrived. */
  setup?: (dir: string) => Promise<void>;
  check: (dir: string) => Promise<Check>;
}

interface FlatElement {
  id: string;
  type: string;
  rootId: string;
  attributes: Record<string, unknown>;
  base: string;
}

const elementsOf = (schema: unknown): FlatElement[] => {
  const flat = isRecord(schema) && isRecord(schema.flat) ? schema.flat : {};

  return Object.values(flat).flatMap(element => {
    if (!isRecord(element) || !isRecord(element.definition) || !isRecord(element.attributes)) {
      return [];
    }

    const { definition } = element;
    const styles = isRecord(definition.styleSelectors) ? definition.styleSelectors : {};

    return [
      {
        id: String(element.id),
        type: String(definition.type),
        rootId: String(definition.rootId),
        attributes: element.attributes,
        base: typeof styles.base === 'string' ? styles.base : ''
      }
    ];
  });
};

const showing = (elements: readonly FlatElement[], words: string): FlatElement | undefined =>
  elements.find(element => element.attributes.content === words);

/** A page at `slug` holding a heading that says `words`. */
const pageWithHeading = (elements: readonly FlatElement[], slug: string, words: string): Check => {
  const page = elements.find(element => element.type === 'page' && element.attributes.slug === slug);
  if (!page) {
    return { ok: false, why: `no page at /${slug}` };
  }

  const heading = elements.find(
    element => element.rootId === page.id && element.type === 'heading' && element.attributes.content === words
  );

  return heading ? { ok: true } : { ok: false, why: `the page at /${slug} has no heading "${words}"` };
};

const onSaved = (check: (elements: FlatElement[]) => Check) => async (dir: string) =>
  check(elementsOf(await savedSchema(dir)));

const onAuthored = (check: (elements: FlatElement[]) => Check) => async (dir: string) => {
  const authored = await authoredSchema(dir);

  return 'problem' in authored
    ? { ok: false, why: `the space does not author: ${authored.problem}` }
    : check(elementsOf(authored.schema));
};

/** A person moves the home page into a folder of its own, and fixes the imports, before the agent arrives. */
const moveHome = async (dir: string): Promise<void> => {
  const pages = path.join(dir, 'src/space/pages');
  await fs.mkdir(path.join(pages, 'landing'));
  const home = await fs.readFile(path.join(pages, 'home.ts'), 'utf-8');
  // One folder deeper: what it imported from above is a level further up, and its siblings are now above it.
  await fs.writeFile(
    path.join(pages, 'landing/home.ts'),
    home.replace(/from (['"])\.\.\//g, 'from $1../../').replace(/from (['"])\.\//g, 'from $1../')
  );
  await fs.rm(path.join(pages, 'home.ts'));
  for (const file of await fs.readdir(path.join(dir, 'src/space'), { recursive: true })) {
    const at = path.join(dir, 'src/space', file);
    if (at.endsWith('.ts') && !at.endsWith('landing/home.ts')) {
      const text = await fs.readFile(at, 'utf-8');
      if (/(?:pages|\.)\/home\.ts['"]/.test(text)) {
        await fs.writeFile(
          at,
          text
            .replace(/pages\/home\.ts(['"])/g, 'pages/landing/home.ts$1')
            .replace(/\.\/home\.ts(['"])/g, './landing/home.ts$1')
        );
      }
    }
  }

  // A person who moves a file leaves the project working: a setup that breaks it would fail every agent for nothing.
  const authored = await authoredSchema(dir);
  if ('problem' in authored) {
    throw new Error(`Moving the home page broke the project: ${authored.problem}`);
  }
};

export const TASKS: readonly Task[] = [
  {
    id: 'mcp-text',
    scenario: 'mcp',
    prompt:
      'In the Plitzi space you are connected to, the home page’s main heading says "Welcome To Plitzi". Change it to "Welcome, agents" and save the change.',
    check: onSaved(elements =>
      showing(elements, 'Welcome, agents') && !showing(elements, 'Welcome To Plitzi')
        ? { ok: true }
        : { ok: false, why: 'the main heading does not say "Welcome, agents"' }
    )
  },
  {
    id: 'mcp-class',
    scenario: 'mcp',
    prompt:
      'In the Plitzi space you are connected to, the home page has a card titled "Deploy". Make that title wear the same class the main heading ("Welcome To Plitzi") wears, instead of its own, and save it.',
    check: onSaved(elements => {
      const main = showing(elements, 'Welcome To Plitzi');
      const title = showing(elements, 'Deploy');

      return main && title && title.base === main.base
        ? { ok: true }
        : { ok: false, why: `"Deploy" wears "${title?.base ?? '?'}", the main heading "${main?.base ?? '?'}"` };
    })
  },
  {
    id: 'mcp-page',
    scenario: 'mcp',
    prompt:
      'In the Plitzi space you are connected to, add a page "About" at /about with a heading that says "About us", and save it.',
    check: onSaved(elements => pageWithHeading(elements, 'about', 'About us'))
  },
  {
    id: 'cli-text',
    scenario: 'cli',
    prompt:
      'In this Plitzi project, change the home page title "Good things for a good desk" to "Desks worth keeping". Leave `npm run author` with no errors.',
    check: onAuthored(elements =>
      showing(elements, 'Desks worth keeping') && !showing(elements, 'Good things for a good desk')
        ? { ok: true }
        : { ok: false, why: 'the home title does not say "Desks worth keeping"' }
    )
  },
  {
    id: 'cli-moved',
    scenario: 'cli',
    setup: moveHome,
    prompt:
      'In this Plitzi project, the home page’s link "See every product" should say "Browse the shop". Change it, and leave `npm run author` with no errors.',
    check: onAuthored(elements =>
      showing(elements, 'Browse the shop')
        ? { ok: true }
        : { ok: false, why: 'the link does not say "Browse the shop"' }
    )
  },
  {
    id: 'cli-page',
    scenario: 'cli',
    prompt:
      'Add an About page to this Plitzi project at /about, inside the site’s layout like the other pages, with a heading "About us". Leave `npm run author` with no errors.',
    check: onAuthored(elements => pageWithHeading(elements, 'about', 'About us'))
  }
];
