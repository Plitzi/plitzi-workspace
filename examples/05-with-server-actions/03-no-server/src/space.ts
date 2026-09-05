import { sampleSpace } from '@plitzi/example-space/space';
import {
  apiContainer,
  authorSpace,
  button,
  heading,
  image,
  list,
  named,
  onClick,
  paragraph,
  runServerAction,
  setState
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace, PageSpec } from '@plitzi/sdk-authoring';

/**
 * The cat page from `02-render`, wired for a browser with no server behind it.
 *
 * The elements are the same ones — a `runtime: 'server'` provider naming an action, and a step that runs another —
 * because that is the point: the schema does not change when the deployment does. What changes is that nothing
 * here can reach a server, and the SDK is expected to know it rather than find out per click.
 *
 * Authored from the same surface as every server-side example, in a bundle that never loads Node: writing a space
 * is data, and data has no tier.
 */

/**
 * The flow that cannot run, and the step that says so.
 *
 * `runServerAction` returns `{ status: 'skipped' }` when this render has no action endpoint — no request is
 * issued at all — and the flow carries on to the next step. That is why the third step can put the status on the
 * page: a skipped run is a RESULT, not an exception, so an author can bind it like any other.
 */
const refreshFlow = [
  onClick(),
  named('refresh', runServerAction({ actionId: 'cat-gallery', input: '{"limit":4}', mode: 'await' })),
  setState({ key: 'runStatus', type: 'text', value: '{{refresh.status}}' })
];

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

const offlinePage: PageSpec = {
  name: 'No server',
  slug: '',
  accessLevel: 'public',
  class: 'catsPage',
  body: [
    heading({ content: 'The same page, with nobody to ask', subType: 'h1', variant: 'lg' }),
    paragraph({
      content:
        'Rendered in the browser from a JSON file. Open the network tab: no request is made for the cats, and none is made when you press the button.'
    }),

    /**
     * The same provider as `02-render`, and this is where `mockData` earns its place.
     *
     * A `runtime: 'server'` element resolves from the RSC payload — which only a server produces. With none, the
     * SDK does not request one: it renders the mock the author left, so the section keeps its shape in the
     * builder, in a static export and here. A payload that ARRIVED without this element's key is the other case
     * entirely, and it reports itself as an error rather than quietly showing mock data in production.
     */
    apiContainer({
      id: 'cats',
      runtime: 'server',
      action: 'cat-gallery',
      subType: 'section',
      mockData: MOCK,
      class: 'catsProvider',
      children: [
        list({
          id: 'catList',
          source: 'controlled',
          class: 'catsGrid',
          bind: { items: 'cats.records' },
          children: [
            image({
              src: '',
              alt: 'A cat',
              class: 'catPhoto',
              bind: { src: 'catList.item.url', alt: 'catList.item.id' }
            })
          ]
        })
      ]
    }),

    button({
      id: 'refreshButton',
      subType: 'button',
      content: 'Fetch new cats',
      class: 'catsButton',
      flows: [refreshFlow]
    }),

    /** What the step reported, straight onto the page — `skipped`, every time, with no request behind it. */
    paragraph({
      content: '',
      class: 'catsCount',
      bind: [
        {
          to: 'content',
          source: 'state.runStatus',
          transformers: [{ action: 'twigTemplate', params: { template: 'The step reported: {{source}}' } }]
        }
      ]
    })
  ]
};

/** The sample space with this one page in front of it — the same substitution every example makes. */
export const offlineData: AuthoredSpace = authorSpace({
  ...sampleSpace,
  name: 'No server example',
  permanentUrl: 'no-server-example',
  classes: {
    ...sampleSpace.classes,
    catsPage: {
      desktop: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '12px',
        'min-height': '100vh',
        padding: '24px',
        'font-family': 'system-ui, sans-serif',
        'background-color': 'var(--background-inner)',
        color: 'var(--foreground)'
      }
    },
    catsProvider: {
      desktop: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '12px',
        width: '100%',
        'max-width': '900px'
      }
    },
    catsCount: { desktop: { 'font-size': '14px', opacity: '0.7', 'min-height': '20px' } },
    catsGrid: {
      desktop: {
        display: 'grid',
        'grid-template-columns': 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '12px',
        width: '100%',
        'list-style': 'none',
        padding: '0px',
        margin: '0px'
      }
    },
    catPhoto: {
      desktop: {
        width: '100%',
        height: '180px',
        'object-fit': 'cover',
        'border-radius': '10px',
        'background-color': '#e2e8f0'
      }
    },
    catsButton: {
      desktop: {
        padding: '8px 16px',
        'border-radius': '6px',
        border: '0px solid transparent',
        'background-color': '#5c3df5',
        color: '#ffffff',
        'font-size': '14px',
        cursor: 'pointer'
      }
    }
  },
  pages: [offlinePage]
});
