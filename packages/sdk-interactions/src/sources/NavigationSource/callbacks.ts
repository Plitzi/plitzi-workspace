import type { BuiltinGlobalCallback } from '../../authoring/globalCallbacks';

/**
 * Navigation's one action.
 *
 * `url` is the param whose control depends on the one above it: a page is picked from the space's own pages, and
 * anything else is typed. The list of pages is the editor's to supply — it is a fact about the space being edited,
 * not about the action — so the source adds it to what is declared here.
 */
export const navigationCallbacks = {
  navigate: {
    source: 'navigation',
    title: 'Navigate',
    strictParams: true,
    params: {
      urlType: {
        type: 'select',
        description: 'Target kind: a space page, an internal space path, or an external URL.',
        options: ['page', 'internal', 'external'],
        optionLabels: { page: 'Space Page', internal: 'Inside Space', external: 'Outside Space' }
      },
      url: {
        type: 'text',
        description: 'Destination — a page id when urlType is "page", otherwise a URL/path.',
        when: params => Boolean(params.urlType),
        builderType: params => (params.urlType === 'page' ? 'select' : 'text')
      }
    }
  }
} satisfies Record<string, BuiltinGlobalCallback>;
