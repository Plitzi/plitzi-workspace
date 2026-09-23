import type { Element, ElementInteraction, OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * A space that keeps its state across reloads — except one key it declares transient.
 *
 * Two buttons write two keys and two texts show them: `favourite` is what a person expects back after a reload,
 * `draft` is what must start fresh every visit. The spec reloads the browser in between, which is the only place the
 * difference exists.
 */

const PAGE_ID = 'kept-page';

export const KEPT_IDS = {
  page: PAGE_ID,
  keep: 'kept-keep',
  draft: 'kept-draft',
  keptText: 'kept-text',
  draftText: 'kept-draft-text'
};

export const KEPT_KEYS = { kept: 'favourite', transient: 'draft' };

const element = (
  id: string,
  type: string,
  attributes: Record<string, unknown>,
  extra: Partial<Element['definition']> = {}
): Element => ({
  id,
  attributes,
  definition: {
    label: type,
    type,
    rootId: PAGE_ID,
    parentId: PAGE_ID,
    styleSelectors: { base: id },
    initialState: { visibility: true },
    ...extra
  }
});

const node = (flowId: string, id: string, overrides: Partial<ElementInteraction>): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId,
  enabled: true,
  ...overrides
});

/** A button that writes one state key. */
const writes = (buttonId: string, key: string, value: string): Record<string, ElementInteraction> => ({
  trigger: node(buttonId, 'trigger', { type: 'trigger', action: 'onClick', elementId: buttonId, afterNode: 'step' }),
  step: node(buttonId, 'step', {
    type: 'globalCallback',
    action: 'setState',
    elementId: 'state',
    beforeNode: 'trigger',
    params: { key, type: 'text', value }
  })
});

/** A text showing one state key, or `none` before anything was written. */
const shows = (id: string, key: string): Element =>
  element(
    id,
    'text',
    { content: 'none' },
    { bindings: { attributes: [{ id: `b-${id}`, source: `state.${key}`, to: 'content' }] } }
  );

export const keptStateSpace = (): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'kept', permanentUrl: '' },
      variables: [],
      settings: { customCss: '', keepState: true, stateStorage: 'localStorage', transientState: [KEPT_KEYS.transient] },
      pages: [PAGE_ID],
      pageFolders: {},
      flat: {
        [PAGE_ID]: element(
          PAGE_ID,
          'page',
          { slug: '', default: true, name: 'Kept' },
          {
            parentId: undefined,
            items: [KEPT_IDS.keep, KEPT_IDS.draft, KEPT_IDS.keptText, KEPT_IDS.draftText]
          }
        ),
        [KEPT_IDS.keep]: element(
          KEPT_IDS.keep,
          'button',
          { subType: 'button', content: 'Save favourite' },
          { interactions: writes(KEPT_IDS.keep, KEPT_KEYS.kept, 'saved') }
        ),
        [KEPT_IDS.draft]: element(
          KEPT_IDS.draft,
          'button',
          { subType: 'button', content: 'Type a draft' },
          { interactions: writes(KEPT_IDS.draft, KEPT_KEYS.transient, 'typed') }
        ),
        [KEPT_IDS.keptText]: shows(KEPT_IDS.keptText, KEPT_KEYS.kept),
        [KEPT_IDS.draftText]: shows(KEPT_IDS.draftText, KEPT_KEYS.transient)
      }
    },
    style: { cache: '' }
  }) as unknown as OfflineDataRaw;
