import { writeInvalidationParams } from '../sources/QueriesSource/writeParams';

import type { BuiltinActionSpec } from '@plitzi/sdk-shared/authoring/builder';

const isRead = (params: Record<string, unknown>) => {
  const method = typeof params.method === 'string' ? params.method.toLowerCase() : 'get';

  return method === 'get' || method === 'head';
};

const isCachedRead = (params: Record<string, unknown>) =>
  isRead(params) && (params.cache === true || params.cache === 'true');

/**
 * The webhook step, as the editor and anything authoring one offline read it.
 *
 * A read may be served from the page's query cache — the same one api containers use, under the same key, so a
 * flow reading a URL a container already loaded does not ask again. A write says what it refreshes once it
 * succeeded, which by default is every cached request to the site it wrote to.
 */
export const webHookSpec: BuiltinActionSpec = {
  title: 'Webhook',
  type: 'utility',
  strictParams: true,
  params: {
    url: { type: 'text', description: 'The URL to call.', default: '', label: 'Url' },
    method: {
      type: 'select',
      description: 'HTTP method.',
      default: 'get',
      options: ['get', 'post', 'put', 'delete', 'patch', 'head'],
      canBind: false
    },
    body: { type: 'textarea', description: 'Request body.', default: '' },
    authorizationToken: { type: 'text', description: 'Value sent as the Authorization header.', default: '' },
    credentials: {
      type: 'select',
      description: 'fetch credentials mode.',
      default: 'same-origin',
      options: ['include', 'omit', 'same-origin'],
      optionLabels: { 'same-origin': 'Same Origin' }
    },
    cache: {
      type: 'boolean',
      description:
        'Serve a GET from the page’s query cache while it is fresh, and keep the answer there — shared with any api ' +
        'container asking the same thing.',
      default: false,
      label: 'Cache response',
      when: isRead
    },
    staleTime: {
      type: 'number',
      description: 'With `cache`: seconds the answer is served without asking again.',
      default: 30,
      label: 'Fresh for (s)',
      when: isCachedRead
    },
    ...writeInvalidationParams(['origin', 'all', 'elements', 'none'], params => !isRead(params))
  },
  preview: { response: { status: '', data: '' } }
};
