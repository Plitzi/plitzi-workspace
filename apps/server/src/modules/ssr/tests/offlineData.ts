import type { OfflineDataRaw, Schema, Style } from '@plitzi/sdk-shared';

/** A space of one empty page at `/` — what a test's page server renders when the page is not what it tests. */
export const oneEmptyPage: Schema = {
  flat: {
    home: {
      id: 'home',
      attributes: { slug: '', folder: '', default: true },
      definition: { type: 'page', label: 'home', rootId: 'root', items: [], styleSelectors: { base: '' } }
    }
  },
  pages: ['home'],
  pageFolders: [],
  components: {},
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' }
};

const noStyle: Style = {
  platform: { desktop: {}, tablet: {}, mobile: {} },
  theme: { default: 'light', schemes: [] },
  variables: {},
  cache: ''
};

/** The documents a page server is started with: `schema`, unstyled. */
export const offlineDataOf = (schema: Schema = oneEmptyPage): OfflineDataRaw => ({ schema, style: noStyle });
