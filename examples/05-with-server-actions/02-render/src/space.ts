import { readOfflineData } from '@plitzi/example-space';

import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * A page whose content is fetched while it renders.
 *
 * Three elements do all of it, and none of them names a URL: a PROVIDER that says which action feeds it, a LIST
 * that repeats over what came back, and an IMAGE bound to one field of one record. The page is a layout with
 * bindings — the request, the host and the shape of the response stay on the server.
 */

const el = (
  id: string,
  definition: Partial<Element['definition']> & { idRef?: string },
  attributes: Record<string, unknown> = {}
): Element => {
  const { idRef, ...rest } = definition;

  return {
    id,
    // Bindings address a source named after the idRef (`apiContainer_cats`), never the opaque id — which is what
    // lets an id change without invalidating every binding pointed at it.
    ...(idRef ? { idRef } : {}),
    attributes,
    definition: { rootId: 'cats-page', styleSelectors: { base: '' }, ...rest }
  } as Element;
};

const catsPage: Record<string, Element> = {
  'cats-page': el(
    'cats-page',
    {
      label: 'Cats',
      type: 'page',
      styleSelectors: { base: 'cats-page' },
      items: ['cats-title', 'cats-intro', 'cats-provider']
    },
    { slug: '', default: true, name: 'Cats', accessLevel: 'public' }
  ),

  'cats-title': el(
    'cats-title',
    {
      label: 'Heading',
      type: 'heading',
      parentId: 'cats-page',
      initialState: { visibility: true, styleVariant: { heading: { base: 'lg' } } }
    },
    { subType: 'h1', content: 'Cats, fetched on the server' }
  ),

  'cats-intro': el(
    'cats-intro',
    { label: 'Intro', type: 'paragraph', parentId: 'cats-page' },
    {
      content:
        'The pictures below were fetched while this page was being rendered. View the source: they are in the HTML.'
    }
  ),

  /**
   * The provider. `runtime: 'server'` is what makes it one, and `action` is what it asks.
   *
   * It is the same element a connector-backed section uses — the attribute decides which producer resolves it. The
   * action's output lands here as this element's data slice, and everything under it can address it as a source:
   * `records` is the list, and `count`, `isEmpty` and `hasError` come with it.
   */
  'cats-provider': el(
    'cats-provider',
    {
      label: 'Cats',
      type: 'apiContainer',
      idRef: 'cats',
      parentId: 'cats-page',
      runtime: 'server',
      styleSelectors: { base: 'cats-provider' },
      items: ['cats-count', 'cats-error', 'cats-list']
    },
    { action: 'cat-gallery', subType: 'section' }
  ),

  /** A binding plus a transformer: the number is the data, the sentence around it is presentation. */
  'cats-count': el(
    'cats-count',
    {
      label: 'Count',
      type: 'paragraph',
      parentId: 'cats-provider',
      styleSelectors: { base: 'cats-count' },
      bindings: {
        attributes: [
          {
            id: 'b-count',
            source: 'apiContainer_cats.count',
            to: 'content',
            transformers: [{ action: 'twigTemplate', params: { template: '{{source}} cats came back.' } }]
          }
        ]
      }
    },
    { content: '' }
  ),

  /**
   * What the page says when the fetch did not work.
   *
   * A failed slice is not a failed page — each server element resolves on its own — so the provider publishes
   * `hasError` and `errorMessage`, and this is an ordinary binding rather than a code path.
   */
  'cats-error': el(
    'cats-error',
    {
      label: 'Error',
      type: 'paragraph',
      parentId: 'cats-provider',
      styleSelectors: { base: 'cats-error' },
      bindings: { attributes: [{ id: 'b-error', source: 'apiContainer_cats.errorMessage', to: 'content' }] }
    },
    { content: '' }
  ),

  /**
   * The repeater. `source: 'controlled'` renders its children once per item, and `items` is bound to the records
   * the provider published — so what repeats is decided by the data, not by the schema.
   */
  'cats-list': el(
    'cats-list',
    {
      label: 'Cat list',
      type: 'list',
      idRef: 'catList',
      parentId: 'cats-provider',
      styleSelectors: { base: 'cats-grid' },
      items: ['cat-image'],
      bindings: { attributes: [{ id: 'b-items', source: 'apiContainer_cats.records', to: 'items' }] }
    },
    { source: 'controlled' }
  ),

  /**
   * One row's worth of template. Inside the list, `list_catList.item` is THIS record — the list publishes a scope
   * per row, so the same element renders eight times against eight different values.
   */
  'cat-image': el(
    'cat-image',
    {
      label: 'Cat',
      type: 'image',
      parentId: 'cats-list',
      styleSelectors: { base: 'cat-photo' },
      bindings: {
        attributes: [
          { id: 'b-src', source: 'list_catList.item.url', to: 'src' },
          { id: 'b-alt', source: 'list_catList.item.id', to: 'alt' }
        ]
      }
    },
    { src: '', alt: 'A cat', loadMode: 'lazy' }
  )
};

/**
 * The sample space defines `--foreground` and `--background-inner` and flips both per colour scheme. Using one
 * without the other is what makes a page unreadable in dark mode: near-white text on the browser's white default.
 */
const CSS = `
.cats-page{display:flex;flex-direction:column;align-items:center;gap:12px;min-height:100vh;padding:24px;font-family:system-ui,sans-serif;background:var(--background-inner,#fff);color:var(--foreground,#17171c);}
.cats-provider{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:900px;}
.cats-count{font-size:14px;opacity:.7;}
.cats-error{font-size:14px;color:#b91c1c;}
.cats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;width:100%;list-style:none;padding:0;margin:0;}
.cat-photo{width:100%;height:180px;object-fit:cover;border-radius:10px;background:#e2e8f0;}
`;

/**
 * The sample space with this one page in front of it.
 *
 * It REPLACES the sample page rather than joining it: both would sit at `/`, and which one won would come down to
 * sort order. The style stays, so the page inherits the space's own colours.
 */
export const offlineData = (): OfflineDataRaw => {
  const data = readOfflineData() as OfflineDataRaw;

  return {
    ...data,
    schema: {
      ...data.schema,
      flat: { ...data.schema.flat, ...catsPage },
      pages: ['cats-page']
    },
    style: { ...data.style, cache: `${data.style.cache ?? ''}${CSS}` }
  };
};
