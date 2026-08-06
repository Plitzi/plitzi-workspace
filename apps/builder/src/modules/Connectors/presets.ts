import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

/**
 * Starting manifests for the CMSs people actually run.
 *
 * These are documents, not adapters: picking one fills the editor in and every field stays editable. A preset that
 * goes stale because a vendor changed a response shape is fixed by editing a row, never by shipping a release —
 * which is the entire reason connectors are declarative.
 */
export type ConnectorPreset = {
  id: string;
  label: string;
  /** What the connector needs from its credential, so the panel can say which keys to fill in. */
  credentialKeys: string[];
  manifest: ConnectorManifestDraft;
};

const blank: ConnectorPreset = {
  id: 'blank',
  label: 'Blank',
  credentialKeys: [],
  manifest: {
    baseUrl: '',
    endpoints: { list: { path: '/{{resource}}', idPath: 'id' } },
    pagination: 'offset',
    operators: { eq: '{{field}}={{value}}' }
  }
};

const strapi: ConnectorPreset = {
  id: 'strapi',
  label: 'Strapi v5',
  credentialKeys: ['token'],
  manifest: {
    baseUrl: 'https://cms.example.com',
    auth: { in: 'header', name: 'Authorization', value: 'Bearer {{credential.token}}' },
    endpoints: {
      list: {
        path: '/api/{{resource}}',
        query: {
          'pagination[start]': '{{offset}}',
          'pagination[limit]': '{{limit}}',
          populate: '*'
        },
        itemsPath: 'data',
        totalPath: 'meta.pagination.total',
        idPath: 'documentId',
        valuesPath: '.'
      },
      write: {
        create: { method: 'POST', path: '/api/{{resource}}', bodyPath: 'data' },
        update: { method: 'PUT', path: '/api/{{resource}}/{{id}}', bodyPath: 'data' },
        delete: { method: 'DELETE', path: '/api/{{resource}}/{{id}}' }
      }
    },
    pagination: 'offset',
    operators: {
      eq: 'filters[{{field}}][$eq]={{value}}',
      ne: 'filters[{{field}}][$ne]={{value}}',
      contains: 'filters[{{field}}][$containsi]={{value}}',
      gt: 'filters[{{field}}][$gt]={{value}}',
      lt: 'filters[{{field}}][$lt]={{value}}'
    },
    media: { baseUrl: 'https://cms.example.com' }
  }
};

const wordpress: ConnectorPreset = {
  id: 'wordpress',
  label: 'WordPress (REST)',
  credentialKeys: [],
  manifest: {
    baseUrl: 'https://blog.example.com',
    endpoints: {
      list: {
        path: '/wp-json/wp/v2/{{resource}}',
        query: { per_page: '{{limit}}', page: '{{page}}' },
        idPath: 'id'
      }
    },
    pagination: 'page',
    operators: { eq: '{{field}}={{value}}', contains: 'search={{value}}' }
  }
};

const directus: ConnectorPreset = {
  id: 'directus',
  label: 'Directus',
  credentialKeys: ['token'],
  manifest: {
    baseUrl: 'https://cms.example.com',
    auth: { in: 'header', name: 'Authorization', value: 'Bearer {{credential.token}}' },
    endpoints: {
      list: {
        path: '/items/{{resource}}',
        query: { offset: '{{offset}}', limit: '{{limit}}', meta: 'filter_count' },
        itemsPath: 'data',
        totalPath: 'meta.filter_count',
        idPath: 'id'
      },
      write: {
        create: { method: 'POST', path: '/items/{{resource}}' },
        update: { method: 'PATCH', path: '/items/{{resource}}/{{id}}' },
        delete: { method: 'DELETE', path: '/items/{{resource}}/{{id}}' }
      }
    },
    pagination: 'offset',
    operators: {
      eq: 'filter[{{field}}][_eq]={{value}}',
      ne: 'filter[{{field}}][_neq]={{value}}',
      contains: 'filter[{{field}}][_contains]={{value}}'
    },
    media: { baseUrl: 'https://cms.example.com/assets' }
  }
};

const contentful: ConnectorPreset = {
  id: 'contentful',
  label: 'Contentful (CDA)',
  credentialKeys: ['token', 'spaceId'],
  manifest: {
    baseUrl: 'https://cdn.contentful.com',
    endpoints: {
      list: {
        path: '/spaces/{{credential.spaceId}}/environments/master/entries',
        query: {
          access_token: '{{credential.token}}',
          content_type: '{{resource}}',
          skip: '{{offset}}',
          limit: '{{limit}}'
        },
        itemsPath: 'items',
        totalPath: 'total',
        idPath: 'sys.id',
        valuesPath: 'fields'
      }
    },
    pagination: 'offset',
    operators: { eq: 'fields.{{field}}={{value}}', contains: 'fields.{{field}}[match]={{value}}' }
  }
};

export const connectorPresets: ConnectorPreset[] = [blank, strapi, wordpress, directus, contentful];

export const emptyManifest: ConnectorManifestDraft = blank.manifest;
