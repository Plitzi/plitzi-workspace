import type { BuiltinGlobalCallback } from '@plitzi/sdk-shared/authoring/builder';

/**
 * The step that tells the page's cached requests the data behind them changed.
 *
 * A browser request made by an api container is served from memory until its cache time runs out, so a flow that
 * changed something the page reads — through a route of its own, a third-party form, anything the page cannot see
 * — says so here. The providers on screen ask again at once; the ones on a tab nobody is looking at ask when they
 * are shown.
 */
export const queriesCallbacks: Record<string, BuiltinGlobalCallback> = {
  invalidateQueries: {
    source: 'queries',
    title: 'Invalidate Queries',
    strictParams: true,
    params: {
      url: {
        type: 'text',
        description:
          'Only the requests whose URL starts with this — `/api/orders` covers `/api/orders?page=2`. Empty ' +
          'invalidates every cached request on the page.',
        default: '',
        label: 'URL prefix'
      }
    },
    preview: {}
  }
};
