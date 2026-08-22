import { offlineData as sample } from '@plitzi/example-space/browser';

import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * The cat page from `02-render`, wired for a browser with no server behind it.
 *
 * The elements are the same ones — a `runtime: 'server'` provider naming an action, and a step that runs another —
 * because that is the point: the schema does not change when the deployment does. What changes is that nothing
 * here can reach a server, and the SDK is expected to know it rather than find out per click.
 */

const el = (
  id: string,
  definition: Partial<Element['definition']> & { idRef?: string },
  attributes: Record<string, unknown> = {}
): Element => {
  const { idRef, ...rest } = definition;

  return {
    id,
    ...(idRef ? { idRef } : {}),
    attributes,
    definition: { rootId: 'offline-page', styleSelectors: { base: '' }, ...rest }
  } as Element;
};

const step = (
  id: string,
  type: 'trigger' | 'globalCallback',
  action: string,
  elementId: string,
  params: Record<string, unknown> = {},
  links: { beforeNode?: string; afterNode?: string } = {}
) => ({
  id,
  flowId: 'refresh-flow',
  type,
  action,
  elementId,
  params,
  title: action,
  preview: {},
  enabled: true,
  beforeNode: links.beforeNode ?? '',
  afterNode: links.afterNode ?? ''
});

/**
 * The flow that cannot run, and the step that says so.
 *
 * `runServerAction` returns `{ status: 'skipped' }` when this render has no action endpoint — no request is
 * issued at all — and the flow carries on to the next step. That is why the third step can put the status on the
 * page: a skipped run is a RESULT, not an exception, so an author can bind it like any other.
 */
const refreshFlow = {
  'refresh-trigger': step('refresh-trigger', 'trigger', 'onClick', 'refreshButton', {}, { afterNode: 'refresh-run' }),
  'refresh-run': step(
    'refresh-run',
    'globalCallback',
    'runServerAction',
    'actions',
    { actionId: 'cat-gallery', input: '{"limit":4}', mode: 'await' },
    { beforeNode: 'refresh-trigger', afterNode: 'refresh-show' }
  ),
  'refresh-show': step(
    'refresh-show',
    'globalCallback',
    'setState',
    'state',
    { key: 'runStatus', type: 'text', value: '{{refresh-run.status}}' },
    { beforeNode: 'refresh-run' }
  )
};

/** Two records that never came from anywhere. Inline SVG, so the page needs no network of any kind. */
const catSvg = (label: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='48%25' font-size='56' text-anchor='middle'%3E%F0%9F%90%B1%3C/text%3E%3Ctext x='50%25' y='78%25' font-size='16' text-anchor='middle' fill='%2364748b'%3E${label}%3C/text%3E%3C/svg%3E`;

const MOCK = JSON.stringify({
  records: [
    { id: 'mock-1', url: catSvg('mock%20cat%201') },
    { id: 'mock-2', url: catSvg('mock%20cat%202') }
  ],
  count: 2
});

const offlinePage: Record<string, Element> = {
  'offline-page': el(
    'offline-page',
    {
      label: 'No server',
      type: 'page',
      styleSelectors: { base: 'cats-page' },
      items: ['offline-title', 'offline-intro', 'offline-provider', 'offline-refresh', 'offline-status']
    },
    { slug: '', default: true, name: 'No server', accessLevel: 'public' }
  ),

  'offline-title': el(
    'offline-title',
    {
      label: 'Heading',
      type: 'heading',
      parentId: 'offline-page',
      initialState: { visibility: true, styleVariant: { heading: { base: 'lg' } } }
    },
    { subType: 'h1', content: 'The same page, with nobody to ask' }
  ),

  'offline-intro': el(
    'offline-intro',
    { label: 'Intro', type: 'paragraph', parentId: 'offline-page' },
    {
      content:
        'Rendered in the browser from a JSON file. Open the network tab: no request is made for the cats, and none is made when you press the button.'
    }
  ),

  /**
   * The same provider as `02-render`, and this is where `mockData` earns its place.
   *
   * A `runtime: 'server'` element resolves from the RSC payload — which only a server produces. With none, the SDK
   * does not request one: it renders the mock the author left, so the section keeps its shape in the builder, in a
   * static export and here. A payload that ARRIVED without this element's key is the other case entirely, and it
   * reports itself as an error rather than quietly showing mock data in production.
   */
  'offline-provider': el(
    'offline-provider',
    {
      label: 'Cats',
      type: 'apiContainer',
      idRef: 'cats',
      parentId: 'offline-page',
      runtime: 'server',
      styleSelectors: { base: 'cats-provider' },
      items: ['offline-list']
    },
    { action: 'cat-gallery', subType: 'section', mockData: MOCK }
  ),

  'offline-list': el(
    'offline-list',
    {
      label: 'Cat list',
      type: 'list',
      idRef: 'catList',
      parentId: 'offline-provider',
      styleSelectors: { base: 'cats-grid' },
      items: ['offline-image'],
      bindings: { attributes: [{ id: 'b-items', source: 'apiContainer_cats.records', to: 'items' }] }
    },
    { source: 'controlled' }
  ),

  'offline-image': el(
    'offline-image',
    {
      label: 'Cat',
      type: 'image',
      parentId: 'offline-list',
      styleSelectors: { base: 'cat-photo' },
      bindings: {
        attributes: [
          { id: 'b-src', source: 'list_catList.item.url', to: 'src' },
          { id: 'b-alt', source: 'list_catList.item.id', to: 'alt' }
        ]
      }
    },
    { src: '', alt: 'A cat' }
  ),

  'offline-refresh': el(
    'offline-refresh',
    {
      label: 'Refresh',
      type: 'button',
      idRef: 'refreshButton',
      parentId: 'offline-page',
      styleSelectors: { base: 'cats-button' },
      interactions: refreshFlow
    },
    { subType: 'button', content: 'Fetch new cats' }
  ),

  /** What the step reported, straight onto the page — `skipped`, every time, with no request behind it. */
  'offline-status': el(
    'offline-status',
    {
      label: 'Status',
      type: 'paragraph',
      parentId: 'offline-page',
      styleSelectors: { base: 'cats-count' },
      bindings: {
        attributes: [
          {
            id: 'b-status',
            source: 'state.runStatus',
            to: 'content',
            transformers: [{ action: 'twigTemplate', params: { template: 'The step reported: {{source}}' } }]
          }
        ]
      }
    },
    { content: '' }
  )
};

const CSS = `
.cats-page{display:flex;flex-direction:column;align-items:center;gap:12px;min-height:100vh;padding:24px;font-family:system-ui,sans-serif;background:var(--background-inner,#fff);color:var(--foreground,#17171c);}
.cats-provider{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:900px;}
.cats-count{font-size:14px;opacity:.7;min-height:20px;}
.cats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;width:100%;list-style:none;padding:0;margin:0;}
.cat-photo{width:100%;height:180px;object-fit:cover;border-radius:10px;background:#e2e8f0;}
.cats-button{padding:8px 16px;border-radius:6px;border:0;background:#5c3df5;color:#fff;font-size:14px;cursor:pointer;}
`;

/** The sample space with this one page in front of it — the same substitution every example makes. */
export const offlineData: OfflineDataRaw = {
  ...(sample as OfflineDataRaw),
  schema: {
    ...(sample as OfflineDataRaw).schema,
    flat: { ...(sample as OfflineDataRaw).schema.flat, ...offlinePage },
    pages: ['offline-page']
  },
  style: {
    ...(sample as OfflineDataRaw).style,
    cache: `${(sample as OfflineDataRaw).style.cache ?? ''}${CSS}`
  }
};
