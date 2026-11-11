import type { Operation } from '../tools';

/** A CMS connector as an agent declares one: a list it reads, a create it writes. */
export const strapiConnector: Extract<Operation, { type: 'upsertConnector' }> = {
  type: 'upsertConnector',
  ref: 'strapi-blog',
  name: 'Blog CMS',
  baseUrl: 'https://cms.example.com',
  connection: {
    auth: { in: 'header', name: 'Authorization', value: 'Bearer {{credential.token}}' },
    pagination: 'offset',
    operators: { eq: 'filters[{{field}}][$eq]={{value}}' },
    mediaBaseUrl: 'https://cms.example.com'
  },
  endpoints: {
    read: {
      list: {
        path: '/api/{{resource}}',
        query: { 'pagination[start]': '{{offset}}', 'pagination[limit]': '{{limit}}' },
        itemsPath: 'data',
        totalPath: 'meta.pagination.total',
        idPath: 'documentId'
      }
    },
    write: { create: { method: 'POST', path: '/api/{{resource}}', bodyPath: 'data' } }
  }
};
