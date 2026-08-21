import type { Element, ElementInteraction, OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * A page whose server elements are fed by ACTIONS rather than by connectors.
 *
 * That combination is the point: a space wired this way configures no connectors at all, which for a while meant
 * its `runtime: 'server'` elements resolved to nothing with no configuration missing anywhere. The second provider
 * names a connector this deployment cannot read, because "one producer is absent" must cost that element and
 * nothing else.
 */

const PAGE_ID = 'action-page';

export const ACTION_IDS = {
  page: PAGE_ID,
  provider: 'action-provider',
  title: 'action-title',
  who: 'action-who',
  orphan: 'action-orphan',
  orphanText: 'action-orphan-text'
};

/** What the flow answers, so a spec asserts on a string it can point at rather than on a fixture's prose. */
export const ACTION_OUTPUT = { title: 'resolved by an action', who: 'everyone' };

/** `idRef` sits on the ELEMENT, never inside its definition: it is what a source is named after
 *  (`apiContainer_feed`), and an element without one publishes no source at all — so a binding pointed at it
 *  silently resolves to nothing, which looks exactly like a provider that returned nothing. */
const element = (
  id: string,
  type: string,
  attributes: Record<string, unknown>,
  { idRef, ...extra }: Partial<Element['definition']> & { idRef?: string } = {}
): Element => ({
  id,
  ...(idRef ? { idRef } : {}),
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

const bound = (id: string, source: string, parentId: string): Element =>
  element(
    id,
    'paragraph',
    { content: '' },
    { parentId, bindings: { attributes: [{ id: `b-${id}`, source, to: 'content' }] } }
  );

export const actionSpace = (): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'actions', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      rsc: { enabled: true },
      pages: [PAGE_ID],
      pageFolders: {},
      flat: {
        [PAGE_ID]: element(
          PAGE_ID,
          'page',
          { slug: '', default: true, name: 'Actions' },
          // A page has no parent; `minimal.ts` spells the same case out the same way.
          { parentId: undefined, items: [ACTION_IDS.provider, ACTION_IDS.orphan] }
        ),
        [ACTION_IDS.provider]: element(
          ACTION_IDS.provider,
          'apiContainer',
          { action: 'e2e-feed', subType: 'section' },
          { idRef: 'feed', runtime: 'server', items: [ACTION_IDS.title, ACTION_IDS.who] }
        ),
        [ACTION_IDS.title]: bound(ACTION_IDS.title, 'apiContainer_feed.title', ACTION_IDS.provider),
        [ACTION_IDS.who]: bound(ACTION_IDS.who, 'apiContainer_feed.who', ACTION_IDS.provider),
        [ACTION_IDS.orphan]: element(
          ACTION_IDS.orphan,
          'apiContainer',
          { connector: 'not-configured-here', subType: 'section' },
          { idRef: 'orphan', runtime: 'server', items: [ACTION_IDS.orphanText] }
        ),
        [ACTION_IDS.orphanText]: bound(ACTION_IDS.orphanText, 'apiContainer_orphan.title', ACTION_IDS.orphan)
      }
    },
    style: { cache: '' }
  }) as unknown as OfflineDataRaw;

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

/**
 * The action behind the provider: a way in, a step that takes long enough to overlap another render, and a
 * contract.
 *
 * The delay is load-bearing. Single-flight refuses a second run holding the same key, and a flow that finishes
 * inside a microtask would let concurrent renders miss each other — which is the failure this fixture exists to
 * catch reappearing.
 */
export const FEED_ACTION = {
  id: 'e2e-feed',
  document: {
    name: 'Feed',
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'render',
        params: { access: 'public', input: `{"who":{"type":"text","defaultValue":"${ACTION_OUTPUT.who}"}}` },
        afterNode: 'hold'
      }),
      hold: node('hold', { action: 'flow.delay', params: { milliseconds: '250' }, afterNode: 'answer' }),
      answer: node('answer', {
        action: 'flow.output',
        params: { values: `{"title": "${ACTION_OUTPUT.title}", "who": "{{input.who}}"}` },
        beforeNode: 'hold'
      })
    }
  }
};
