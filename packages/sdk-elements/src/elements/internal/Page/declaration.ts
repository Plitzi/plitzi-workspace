/** Static declaration for Page: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';
import { OG_TYPES } from '@plitzi/sdk-shared/schema';

import type { PageProps } from './Page';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type PageAttributes = AuthorableAttributes<PageProps>;

/**
 * How the document holding a page moves under a finger or a wheel, when the page says so — see
 * `PageProps.documentScroll`. Read by the authoring surface to refuse anything else.
 */
export const DOCUMENT_SCROLLS = ['locked', 'noBounce'] as const;

export type DocumentScroll = (typeof DOCUMENT_SCROLLS)[number];

/** Whether a value is one of the page's `documentScroll` settings: `locked` or `noBounce`. */
export const isDocumentScroll = (value: unknown): value is DocumentScroll =>
  DOCUMENT_SCROLLS.some(documentScroll => documentScroll === value);

const declaration = elementDeclaration<PageAttributes>()({
  type: 'page',
  serverTemplates: ['seoPageTitle', 'seoPageDescription', 'seoImage', 'seoImageAlt', 'notFound'],
  attributeValues: {
    documentScroll: DOCUMENT_SCROLLS,
    seoType: OG_TYPES
  },
  triggers: {
    onPageLoad: {
      action: 'onPageLoad',
      title: 'On Page Load',
      type: 'trigger',
      params: {},
      preview: { pageId: '', routeParams: '', queryParams: '' }
    }
  },
  content: {
    attributes: {
      enabled: true,
      name: 'Page',
      slug: '',
      folder: '',
      layout: '',
      layoutContainer: '',
      seoEnabled: false,
      seoPageTitle: 'Title',
      seoPageDescription: 'Description'
    },
    definition: {
      label: 'Page',
      description:
        'The root of a routable screen. Managed through the page ops (upsertPage/deletePage), not added as a child ' +
        'element.',
      items: []
    },
    builder: {
      canDelete: false,
      canDragDrop: false,
      canMove: false
    },
    market: {
      category: 'internal',
      icon: 'fas fa-file'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'flex',
            'flex-direction': 'column',
            'min-height': '100%',
            'min-width': '100%',
            'font-family': 'Arial',
            // The SDK's floor in either scheme, and no background: the browser's canvas already follows the scheme.
            color: 'light-dark(#333, oklch(0.92 0.004 286.32))',
            'font-size': '14px',
            'font-weight': 400,
            'line-height': '16px',
            'text-align': 'left'
          }
        }
      }
    }
  }
});

export default declaration;
