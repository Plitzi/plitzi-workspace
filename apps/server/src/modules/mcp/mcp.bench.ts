import { bench, describe } from 'vitest';

import {
  dataSourcesUri,
  defUri,
  defsUri,
  findElementByRef,
  findPageByRef,
  globalsUri,
  interactionsUri,
  invalidateIndex,
  pageUri,
  resolveRef,
  styleVarsUri,
  typesUri
} from './helpers';
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

// Delete distinct leaf elements (index ≥ PER_PAGE/2 have no children in a branch-4 tree), so no op targets a node
// another already removed. deleteElement detaches via the parentId splice (O(items)), not a flat scan.
const LEAF_BASE = Math.floor(PER_PAGE / 2);
const deleteOps = (n: number): Operation[] =>
  Array.from({ length: n }, (_, i): Operation => ({
    type: 'deleteElement',
    pageRef: pageRefOf(i % PAGES),
    ref: elementRefOf(i % PAGES, LEAF_BASE + Math.floor(i / PAGES))
  }));

// Reparent a leaf to sit after the first element (a shallow node), staying within the page and never a cycle.
const moveOps = (n: number): Operation[] =>
  Array.from({ length: n }, (_, i): Operation => ({
    type: 'moveElement',
    pageRef: pageRefOf(i % PAGES),
    ref: elementRefOf(i % PAGES, LEAF_BASE + (i % (PER_PAGE - LEAF_BASE))),
    toParentRef: elementRefOf(i % PAGES, 1),
    position: 'after'
  }));

// New reusable style classes — a pure style batch (no schema mutation), so its changedResources hashes definitions.
const defOps = (n: number): Operation[] =>
  Array.from({ length: n }, (_, i): Operation => ({
    type: 'upsertDefinition',
    ref: `bench-def-${i}`,
    desktop: { color: '#111', 'font-size': `${12 + (i % 8)}px` }
  }));

// Every op targets a page that does not exist, so validation reports an error per op (exercises the validValues
// recomputation on the failure path).
const invalidOps = (n: number): Operation[] =>
  Array.from({ length: n }, (_, i): Operation => ({
    type: 'patchElement',
    pageRef: `no-such-page-${i}`,
    ref: `no-such-el-${i}`,
    props: { title: 'x' }
  }));

const patch250 = patchOps(250);
const patch1000 = patchOps(1000);
const create250 = createOps(250);
const mixed1000 = mixedOps(1000);
const delete250 = deleteOps(250);
const move250 = moveOps(250);
const def1000 = defOps(1000);
const invalid250 = invalidOps(250);

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

  bench('filter by type', () => {
    search({ query: 'box', filters: { type: 'container' } }, space, 'main');
  });

  bench('filter by pageRef (one page)', () => {
    search({ query: 'box', filters: { pageRef: pageRefOf(0) } }, space, 'main');
  });

  bench('no matches (full scan, empty result)', () => {
    search({ query: 'zzz-no-such-token' }, space, 'main');
  });
});

describe('apply — deletes & moves (parentId splice, O(items) per op)', () => {
  bench('apply: 250 deletes (dryRun)', async () => {
    await apply({ dryRun: true, operations: delete250 }, space);
  });

  bench('apply: 250 moves (dryRun)', async () => {
    await apply({ dryRun: true, operations: move250 }, space);
  });
});

describe('style ops & reads', () => {
  bench('validateOperations: 1000 upsertDefinition', () => {
    validateOperations(space, def1000);
  });

  bench('apply: 1000 upsertDefinition (dryRun)', async () => {
    await apply({ dryRun: true, operations: def1000 }, space);
  });

  bench('read: definitions list', () => {
    readResource(space, 'main', defsUri('main'));
  });

  bench('read: one definition', () => {
    readResource(space, 'main', defUri('main', 'box-0'));
  });

  bench('read: global-styles list', () => {
    readResource(space, 'main', globalsUri('main'));
  });

  bench('read: style-variables', () => {
    readResource(space, 'main', styleVarsUri('main'));
  });
});

describe('catalog reads (whole-space scans)', () => {
  bench('types registry', () => {
    invalidateIndex(space.schema);
    readResource(space, 'main', typesUri);
  });

  bench('interactions catalog', () => {
    invalidateIndex(space.schema);
    readResource(space, 'main', interactionsUri('main'));
  });

  bench('data-sources catalog', () => {
    invalidateIndex(space.schema);
    readResource(space, 'main', dataSourcesUri('main'));
  });
});

describe('validation — error path', () => {
  bench('validateOperations: 250 invalid (unknown page/ref)', () => {
    validateOperations(space, invalid250);
  });
});

// --- Scaling fixture: 60 pages × 200 elements (~12000), 4× the primary scale. ---
const bigSpace = buildSpace(60, 200, 400);
const bigPatch1000 = Array.from({ length: 1000 }, (_, i): Operation => {
  const pi = i % 60;
  const el = ((i * 7) % 200) + 1;

  return { type: 'patchElement', pageRef: `home-${pi}`, ref: `el-${pi}-${el}`, props: { title: `Big ${i}` } };
});

// 250 deletes on the 12k space (distinct leaves across its 60 pages) — surfaces any O(batch × flat) in delete.
const bigDelete250 = Array.from({ length: 250 }, (_, i): Operation => ({
  type: 'deleteElement',
  pageRef: `home-${i % 60}`,
  ref: `el-${i % 60}-${100 + Math.floor(i / 60)}`
}));

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
    readResource(bigSpace, 'main', pageUri('main', 'home-59'));
  });

  bench('apply: 250 deletes (dryRun)', async () => {
    await apply({ dryRun: true, operations: bigDelete250 }, bigSpace);
  });

  bench('types registry (cold)', () => {
    invalidateIndex(bigSpace.schema);
    readResource(bigSpace, 'main', typesUri);
  });

  bench('interactions catalog (cold)', () => {
    invalidateIndex(bigSpace.schema);
    readResource(bigSpace, 'main', interactionsUri('main'));
  });
});

// --- Single mega-page fixture: one page with 2000 elements, to stress a deep/wide single tree. ---
const megaSpace = buildSpace(1, 2000, 100);

describe('single mega-page (one page, 2000 elements)', () => {
  bench('page skeleton read (cold)', () => {
    invalidateIndex(megaSpace.schema);
    readResource(megaSpace, 'main', pageUri('main', 'home-0'));
  });

  bench('page styles read (cold)', () => {
    invalidateIndex(megaSpace.schema);
    readResource(megaSpace, 'main', `${pageUri('main', 'home-0')}/styles`);
  });

  bench('search: common term (matches all 2000)', () => {
    search({ query: 'box' }, megaSpace, 'main');
  });
});
