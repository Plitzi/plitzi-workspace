import { bench, describe } from 'vitest';

import { findElementByRef, findPageByRef, invalidateIndex, pageUri, resolveRef } from './helpers';
import { readResource, resourceVersion } from './resources';
import { apply, search, validateOperations } from './tools';

import type { Space } from './helpers';
import type { Operation } from './tools';
import type { Schema, Style } from '@plitzi/sdk-shared';

// Hot-path benchmark for the MCP on realistically large spaces. It exercises what a busy, stateless server repeats
// most — reads (both warm within a request and cold on a fresh one), the ref scanners, batch validation and full
// applies (patch-only vs structural vs conflict-checked) — so an optimization pass has before/after numbers.
//
// Run with: yarn bench. Fixtures are deterministic, so runs compare across commits. It does NOT run under
// `vitest run`. WARM vs COLD: a read bench that reuses the same space measures the per-request memo hot (a second
// read of the same element); a COLD bench calls invalidateIndex first, measuring a fresh request (index + detail
// memo rebuilt from scratch) — the honest single-read cost.

const BRANCH = 4; // children per node → a balanced tree of depth ~log4(elementsPerPage)

const buildSpace = (pages: number, elementsPerPage: number, definitions: number): Space => {
  const flat: Record<string, unknown> = {};
  const pageIds: string[] = [];

  for (let pi = 0; pi < pages; pi++) {
    const pageId = `p${pi}`;
    pageIds.push(pageId);
    const nodes: { id: string; items: string[] }[] = [{ id: pageId, items: [] }];

    for (let n = 1; n <= elementsPerPage; n++) {
      const id = `e${pi}_${n}`;
      const parent = nodes[Math.floor((n - 1) / BRANCH)];
      parent.items.push(id);
      const node = { id, items: [] as string[] };
      nodes.push(node);
      flat[id] = {
        id,
        idRef: `el-${pi}-${n}`,
        attributes: { subType: 'div', title: `Box ${n}` },
        definition: {
          rootId: pageId,
          parentId: parent.id,
          label: `Container ${n}`,
          type: 'container',
          items: node.items,
          styleSelectors: { base: `box-${n % definitions}` }
        }
      };
    }

    flat[pageId] = {
      id: pageId,
      idRef: `home-${pi}`,
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
    pages: pageIds,
    pageFolders: []
  } as unknown as Schema;

  const desktop: Record<string, unknown> = {};
  for (let d = 0; d < definitions; d++) {
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

// --- Primary fixture: 30 pages × 100 elements (~3000), the baseline scale. ---
const PAGES = 30;
const PER_PAGE = 100;
const DEFS = 200;
const space = buildSpace(PAGES, PER_PAGE, DEFS);

const pageRefOf = (pi: number): string => `home-${pi}`;
const elementRefOf = (pi: number, n: number): string => `el-${pi}-${n}`;

const LAST_PAGE = PAGES - 1;
const pageUriStr = pageUri('main', pageRefOf(LAST_PAGE));
const elementUriStr = `plitzi://schema/main/elements/${elementRefOf(LAST_PAGE, PER_PAGE)}`;

// --- Operation generators (valid against the primary fixture, so apply/dryRun exercises the success path). ---

// Patch existing elements spread across pages — pure prop patches, so NO index invalidation (best case).
const patchOps = (n: number): Operation[] =>
  Array.from({ length: n }, (_, i): Operation => {
    const pi = i % PAGES;
    const el = ((i * 7) % PER_PAGE) + 1;

    return {
      type: 'patchElement',
      pageRef: pageRefOf(pi),
      ref: elementRefOf(pi, el),
      props: { title: `Patched ${i}` }
    };
  });

// Create brand-new elements under page roots — structural ops that keep the ref index in step incrementally.
const createOps = (n: number): Operation[] =>
  Array.from({ length: n }, (_, i): Operation => ({
    type: 'upsertElement',
    pageRef: pageRefOf(i % PAGES),
    element: { ref: `bench-new-${i}`, type: 'container', props: { title: `New ${i}` } }
  }));

// A realistic mix: mostly patches, a fifth creates. Interleaves invalidating and non-invalidating ops.
const mixedOps = (n: number): Operation[] =>
  Array.from({ length: n }, (_, i): Operation => {
    if (i % 5 === 0) {
      return {
        type: 'upsertElement',
        pageRef: pageRefOf(i % PAGES),
        element: { ref: `bench-mix-${i}`, type: 'container', props: { title: `Mix ${i}` } }
      };
    }

    const pi = i % PAGES;
    const el = ((i * 7) % PER_PAGE) + 1;

    return { type: 'patchElement', pageRef: pageRefOf(pi), ref: elementRefOf(pi, el), props: { title: `Mix ${i}` } };
  });

const patch250 = patchOps(250);
const patch1000 = patchOps(1000);
const create250 = createOps(250);
const mixed1000 = mixedOps(1000);

// Optimistic-concurrency guard for a patch batch: the current version of every page it touches (no conflict), so
// apply runs the full detectConflicts pass (a resourceVersion per URI) on top of the write.
const expectedVersionsFor = (ops: Operation[]): Record<string, string> => {
  const expected: Record<string, string> = {};
  for (const op of ops) {
    if ('pageRef' in op && typeof op.pageRef === 'string') {
      const uri = pageUri('main', op.pageRef);
      const version = resourceVersion(space, 'main', uri);
      if (version) {
        expected[uri] = version;
      }
    }
  }

  return expected;
};

const expected1000 = expectedVersionsFor(patch1000);

describe('reads — warm (memo hot within a request)', () => {
  bench('page skeleton (100-node tree)', () => {
    readResource(space, 'main', pageUriStr);
  });

  bench('element detail (deep element)', () => {
    readResource(space, 'main', elementUriStr);
  });
});

describe('reads — cold (fresh request: index + memo rebuilt)', () => {
  bench('page skeleton (100-node tree)', () => {
    invalidateIndex(space.schema);
    readResource(space, 'main', pageUriStr);
  });

  bench('element detail (deep element)', () => {
    invalidateIndex(space.schema);
    readResource(space, 'main', elementUriStr);
  });

  bench('primer (cold-start bundle)', () => {
    invalidateIndex(space.schema);
    readResource(space, 'main', 'plitzi://primer/main');
  });

  bench('page styles (every class a page uses)', () => {
    invalidateIndex(space.schema);
    readResource(space, 'main', `${pageUriStr}/styles`);
  });
});

describe('ref scanners (O(1) via SpaceIndex)', () => {
  bench('findPageByRef: last page', () => {
    findPageByRef(space.schema, pageRefOf(LAST_PAGE));
  });

  bench('findElementByRef: deepest element', () => {
    findElementByRef(space.schema, elementRefOf(LAST_PAGE, PER_PAGE));
  });

  bench('resolveRef: deep element within its page', () => {
    const page = findPageByRef(space.schema, pageRefOf(LAST_PAGE));
    if (page) {
      resolveRef(space.schema, page, elementRefOf(LAST_PAGE, PER_PAGE));
    }
  });
});

describe('validation', () => {
  bench('validateOperations: 250 patches', () => {
    validateOperations(space, patch250);
  });

  bench('validateOperations: 1000 patches', () => {
    validateOperations(space, patch1000);
  });

  bench('validateOperations: 250 creates', () => {
    validateOperations(space, create250);
  });
});

describe('apply — patch-only (no index invalidation)', () => {
  bench('apply: 250 patches (dryRun)', async () => {
    await apply({ dryRun: true, operations: patch250 }, space);
  });

  bench('apply: 1000 patches (dryRun)', async () => {
    await apply({ dryRun: true, operations: patch1000 }, space);
  });
});

describe('apply — structural & guarded', () => {
  bench('apply: 250 creates (incremental index, dryRun)', async () => {
    await apply({ dryRun: true, operations: create250 }, space);
  });

  bench('apply: 1000 mixed patch/create (dryRun)', async () => {
    await apply({ dryRun: true, operations: mixed1000 }, space);
  });

  bench('apply: 1000 patches + expectedResourceVersions (dryRun)', async () => {
    await apply({ dryRun: true, operations: patch1000, expectedResourceVersions: expected1000 }, space);
  });
});

describe('search', () => {
  bench('common term (matches every element)', () => {
    search({ query: 'box' }, space, 'main');
  });

  bench('common term with include:detail', () => {
    search({ query: 'box', include: 'detail' }, space, 'main');
  });

  bench('deep pagination (offset 2000)', () => {
    search({ query: 'box', offset: 2000 }, space, 'main');
  });
});

// --- Scaling fixture: 60 pages × 200 elements (~12000), 4× the primary scale. ---
const bigSpace = buildSpace(60, 200, 400);
const bigPatch1000 = Array.from({ length: 1000 }, (_, i): Operation => {
  const pi = i % 60;
  const el = ((i * 7) % 200) + 1;

  return { type: 'patchElement', pageRef: `home-${pi}`, ref: `el-${pi}-${el}`, props: { title: `Big ${i}` } };
});

describe('scaling — 12k-element space', () => {
  bench('validateOperations: 1000 patches', () => {
    validateOperations(bigSpace, bigPatch1000);
  });

  bench('apply: 1000 patches (dryRun)', async () => {
    await apply({ dryRun: true, operations: bigPatch1000 }, bigSpace);
  });

  bench('search: common term (matches all 12k)', () => {
    search({ query: 'box' }, bigSpace, 'main');
  });

  bench('page skeleton read (cold)', () => {
    invalidateIndex(bigSpace.schema);
    readResource(bigSpace, 'main', 'plitzi://schema/main/pages/home-59');
  });
});
