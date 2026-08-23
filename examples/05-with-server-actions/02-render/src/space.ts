import { sampleSpace } from '@plitzi/example-space/space';
import { apiContainer, authorSpace, heading, image, list, paragraph } from '@plitzi/sdk-server/authoring';

import type { AuthoredSpace, PageSpec } from '@plitzi/sdk-server/authoring';

/**
 * A page whose content is fetched while it renders.
 *
 * Three elements do all of it, and none of them names a URL: a PROVIDER that says which action feeds it, a LIST
 * that repeats over what came back, and an IMAGE bound to one field of one record. The page is a layout with
 * bindings — the request, the host and the shape of the response stay on the server.
 */

const catsPage: PageSpec = {
  name: 'Cats',
  slug: '',
  accessLevel: 'public',
  class: 'catsPage',
  body: [
    heading({ content: 'Cats, fetched on the server', subType: 'h1', variant: 'lg' }),
    paragraph({
      content:
        'The pictures below were fetched while this page was being rendered. View the source: they are in the HTML.'
    }),

    /**
     * The provider. `runtime: 'server'` is what makes it one, and `action` is what it asks.
     *
     * It is the same element a connector-backed section uses — the attribute decides which producer resolves it.
     * The action's output lands here as this element's data slice, and everything under it can address it as a
     * source: `records` is the list, and `count`, `isEmpty` and `hasError` come with it.
     */
    apiContainer({
      idRef: 'cats',
      runtime: 'server',
      action: 'cat-gallery',
      subType: 'section',
      class: 'catsProvider',
      children: [
        /** A binding plus a transformer: the number is the data, the sentence around it is presentation. */
        paragraph({
          content: '',
          class: 'catsCount',
          bind: [
            {
              to: 'content',
              source: 'cats.count',
              transformers: [{ action: 'twigTemplate', params: { template: '{{source}} cats came back.' } }]
            }
          ]
        }),

        /**
         * What the page says when the fetch did not work.
         *
         * A failed slice is not a failed page — each server element resolves on its own — so the provider
         * publishes `hasError` and `errorMessage`, and this is an ordinary binding rather than a code path.
         */
        paragraph({ content: '', class: 'catsError', bind: { content: 'cats.errorMessage' } }),

        /**
         * The repeater. `source: 'controlled'` renders its children once per item, and `items` is bound to the
         * records the provider published — so what repeats is decided by the data, not by the schema.
         */
        list({
          idRef: 'catList',
          source: 'controlled',
          class: 'catsGrid',
          bind: { items: 'cats.records' },
          children: [
            /**
             * One row's worth of template. Inside the list, `catList.item` is THIS record — the list
             * publishes a scope per row, so the same element renders eight times against eight different values.
             */
            image({
              src: '',
              alt: 'A cat',
              loadMode: 'lazy',
              class: 'catPhoto',
              bind: { src: 'catList.item.url', alt: 'catList.item.id' }
            })
          ]
        })
      ]
    })
  ]
};

/**
 * The sample space with this one page in front of it.
 *
 * It REPLACES the sample page rather than joining it: both would sit at `/`, and which one won would come down to
 * sort order. The palette stays, so the page inherits the space's own colours — `--foreground` without
 * `--background-inner` is what makes a page unreadable in dark mode.
 */
export const offlineData = (): AuthoredSpace =>
  authorSpace({
    ...sampleSpace,
    name: 'Server render example',
    permanentUrl: 'server-render-example',
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
      catsCount: { desktop: { 'font-size': '14px', opacity: '0.7' } },
      catsError: { desktop: { 'font-size': '14px', color: '#b91c1c' } },
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
      }
    },
    pages: [catsPage]
  });
