import type { Space } from '../helpers';
import type { Schema, Style } from '@plitzi/sdk-shared';

/**
 * A space as large as a busy one, deterministic so a measurement compares across commits: `pages` pages of
 * `elementsPerPage` containers in a balanced tree, over `definitions` classes. What the benchmark (`mcp.bench.ts`) times
 * and the answers' budget (`budgets.test.ts`) measures.
 */
const BRANCH = 4; // children per node → a balanced tree of depth ~log4(elementsPerPage)

export const largeSpace = (pages: number, elementsPerPage: number, definitions: number): Space => {
  const flat: Record<string, unknown> = {};
  const pageIds: string[] = [];

  for (let pi = 0; pi < pages; pi++) {
    const pageId = `home-${pi}`;
    pageIds.push(pageId);
    const nodes: { id: string; items: string[] }[] = [{ id: pageId, items: [] }];

    for (let n = 1; n <= elementsPerPage; n++) {
      const id = `el-${pi}-${n}`;
      const parent = nodes[Math.floor((n - 1) / BRANCH)];
      parent.items.push(id);
      const node = { id, items: [] as string[] };
      nodes.push(node);
      flat[id] = {
        id,
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
    pageFolders: [],
    components: {}
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

  return { schema, style, connectors: [], actions: [] };
};
