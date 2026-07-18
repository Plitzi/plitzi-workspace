import { bench, describe } from 'vitest';

import { findElementByRef, findPageByRef, resolveRef } from './helpers';
import { readResource } from './resources';
import { apply, search, validateOperations } from './tools';

import type { Space } from './helpers';
import type { Operation } from './tools';
import type { Schema, Style } from '@plitzi/sdk-shared';

// Baseline hot-path benchmark for the MCP on a realistically large space. It measures the operations a busy server
// repeats the most — page/element reads, the ref scanners, batch validation and a full apply — so a later
// optimization pass (per-request index, write-path dedupe) has a before/after number to prove against.
//
// Run with: yarn bench   (vitest bench). The fixture is deterministic, so runs are comparable across commits.

const PAGES = 30;
const ELEMENTS_PER_PAGE = 100; // ~3000 elements total across the space
const BRANCH = 4; // children per node → a balanced tree of depth ~log4(100) ≈ 4
const DEFINITIONS = 200;
const BATCH = 250;

// The largest realistic addressing cost is the LAST thing scanned, so the benches target the final page/element.
const LAST_PAGE = PAGES - 1;
const pageRefOf = (pi: number): string => `home-${pi}`;
const elementRefOf = (pi: number, n: number): string => `el-${pi}-${n}`;

const buildSpace = (): Space => {
  const flat: Record<string, unknown> = {};
  const pages: string[] = [];

  for (let pi = 0; pi < PAGES; pi++) {
    const pageId = `p${pi}`;
    pages.push(pageId);
    // nodes[0] is the page itself; every element's parent is nodes[floor((i-1)/BRANCH)] → a balanced tree.
    const nodes: { id: string; items: string[] }[] = [{ id: pageId, items: [] }];

    for (let n = 1; n <= ELEMENTS_PER_PAGE; n++) {
      const id = `e${pi}_${n}`;
      const parent = nodes[Math.floor((n - 1) / BRANCH)];
      parent.items.push(id);
      const node = { id, items: [] as string[] };
      nodes.push(node);
      flat[id] = {
        id,
        idRef: elementRefOf(pi, n),
        attributes: { subType: 'div', title: `Box ${n}` },
        definition: {
          rootId: pageId,
          parentId: parent.id,
          label: `Container ${n}`,
          type: 'container',
          items: node.items,
          styleSelectors: { base: `box-${n % DEFINITIONS}` }
        }
      };
    }

    flat[pageId] = {
      id: pageId,
      idRef: pageRefOf(pi),
      attributes: { slug: `/p${pi}`, name: `Page ${pi}`, default: pi === 0 },
      definition: {
        rootId: pageId,
        label: `Page ${pi}`,
        type: 'page',
        items: nodes[0].items,
        styleSelectors: { base: 'page-x' }
      }
    };
  }

  const schema = {
    flat,
    definition: { name: 'Bench', permanentUrl: '' },
    variables: [{ name: 'apiUrl', category: 'general', type: 'text', value: 'https://api', subValues: [] }],
    settings: { customCss: '' },
    pages,
    pageFolders: []
  } as unknown as Schema;

  const desktop: Record<string, unknown> = {};
  for (let d = 0; d < DEFINITIONS; d++) {
    desktop[`box-${d}`] = {
      name: `box-${d}`,
      type: 'class',
      attributes: { base: { default: { display: 'flex', 'font-size': `${12 + (d % 8)}px` } } },
      cache: ''
    };
  }

  const style = {
    platform: { desktop, tablet: {}, mobile: {} },
    theme: { default: 'system', schemes: ['light', 'dark'] },
    variables: { color: { foreground: { light: '#000', dark: '#fff', default: '#000' } } },
    cache: ''
  } as unknown as Style;

  return { schema, style };
};

const space = buildSpace();

// A full-batch patch: BATCH elements spread across pages, each a valid prop patch on an existing element. Exercises
// findPageByRef + resolveRef per op in validation, plus the whole dispatch/clone/integrity path in apply.
const batchOps = (): Operation[] => {
  const ops: Operation[] = [];
  for (let i = 0; i < BATCH; i++) {
    const pi = i % PAGES;
    const n = ((i * 7) % ELEMENTS_PER_PAGE) + 1;
    ops.push({
      type: 'patchElement',
      pageRef: pageRefOf(pi),
      ref: elementRefOf(pi, n),
      props: { title: `Patched ${i}` }
    });
  }

  return ops;
};

const ops = batchOps();
const pageUri = `plitzi://schema/main/pages/${pageRefOf(LAST_PAGE)}`;
const elementUri = `plitzi://schema/main/elements/${elementRefOf(LAST_PAGE, ELEMENTS_PER_PAGE)}`;

describe('mcp hot paths (baseline)', () => {
  bench('readResource: page skeleton (100-node tree, per-node stateVersion)', () => {
    readResource(space, 'main', pageUri);
  });

  bench('readResource: element detail (deep element)', () => {
    readResource(space, 'main', elementUri);
  });

  bench('findPageByRef: last page', () => {
    findPageByRef(space.schema, pageRefOf(LAST_PAGE));
  });

  bench('findElementByRef: deepest element (worst-case scan)', () => {
    findElementByRef(space.schema, elementRefOf(LAST_PAGE, ELEMENTS_PER_PAGE));
  });

  bench('resolveRef: deep element within its page', () => {
    const page = findPageByRef(space.schema, pageRefOf(LAST_PAGE));
    if (page) {
      resolveRef(space.schema, page, elementRefOf(LAST_PAGE, ELEMENTS_PER_PAGE));
    }
  });

  bench('validateOperations: batch of 250 patches', () => {
    validateOperations(space, ops);
  });

  bench('search: common term across the space', () => {
    search({ query: 'box' }, space, 'main');
  });
});

describe('mcp apply (baseline)', () => {
  bench('apply: batch of 250 patches (dryRun)', async () => {
    await apply({ dryRun: true, operations: ops }, space);
  });
});
