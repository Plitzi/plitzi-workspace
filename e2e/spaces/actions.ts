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
  orphanText: 'action-orphan-text',
  offline: 'action-offline',
  offlineText: 'action-offline-text',
  button: 'action-button',
  status: 'action-status'
};

/** What the flow answers, so a spec asserts on a string it can point at rather than on a fixture's prose. */
export const ACTION_OUTPUT = { title: 'resolved by an action', who: 'everyone' };

/** What the provider element publishes when its slice never arrived. The page binds it; a spec reads it back. */
export const PROVIDER_ERROR = 'The data provider could not be reached';

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
 * The click path: run the action from the browser and put what the step answered on the page.
 *
 * `{{run.status}}` is the assertion surface. A run that completed, one the server refused and one that never
 * reached a server at all all land here as a status — which is the whole contract being checked: the flow gets a
 * RESULT it can bind, whatever happened to the request.
 */
const runFlow: Record<string, ElementInteraction> = {
  trigger: node('trigger', { type: 'trigger', action: 'onClick', elementId: 'runButton', afterNode: 'run' }),
  run: node('run', {
    type: 'globalCallback',
    action: 'runServerAction',
    elementId: 'actions',
    params: { actionId: 'e2e-feed', input: '{}', mode: 'await' },
    beforeNode: 'trigger',
    afterNode: 'show'
  }),
  show: node('show', {
    type: 'globalCallback',
    action: 'setState',
    elementId: 'state',
    params: { key: 'runStatus', type: 'text', value: '{{run.status}}' },
    beforeNode: 'run'
  })
};

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
          {
            parentId: undefined,
            items: [ACTION_IDS.provider, ACTION_IDS.orphan, ACTION_IDS.offline, ACTION_IDS.button, ACTION_IDS.status]
          }
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
        [ACTION_IDS.orphanText]: bound(ACTION_IDS.orphanText, 'apiContainer_orphan.title', ACTION_IDS.orphan),
        /** Fed by an action whose own outbound call cannot resolve — the server is up, the internet is not. */
        [ACTION_IDS.offline]: element(
          ACTION_IDS.offline,
          'apiContainer',
          { action: 'e2e-unreachable', subType: 'section' },
          { idRef: 'offline', runtime: 'server', items: [ACTION_IDS.offlineText] }
        ),
        [ACTION_IDS.offlineText]: bound(
          ACTION_IDS.offlineText,
          'apiContainer_offline.errorMessage',
          ACTION_IDS.offline
        ),
        [ACTION_IDS.button]: element(
          ACTION_IDS.button,
          'button',
          { subType: 'button', content: 'Run it' },
          { idRef: 'runButton', interactions: runFlow }
        ),
        [ACTION_IDS.status]: bound(ACTION_IDS.status, 'state.runStatus', PAGE_ID)
      }
    },
    style: { cache: '' }
  }) as unknown as OfflineDataRaw;

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
      /** The second way in, for the button: a call is not a render, and each way in states its own rule. Both
       *  head the same chain — one action, two doors. */
      called: node('called', {
        type: 'trigger',
        action: 'call',
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

/**
 * The action whose own call cannot go anywhere: the server is up, the internet is not.
 *
 * `.invalid` is reserved by RFC 6761 and never resolves — for anybody, on any machine, connected or not — so this
 * is the outage reproduced rather than simulated, and it costs no network to run.
 */
export const UNREACHABLE_ACTION = {
  id: 'e2e-unreachable',
  document: {
    name: 'Unreachable feed',
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'render',
        params: { access: 'public' },
        afterNode: 'fetch'
      }),
      fetch: node('fetch', {
        action: 'http.request',
        params: { url: 'https://offline.invalid/feed', method: 'GET' },
        beforeNode: 'start',
        afterNode: 'answer'
      }),
      answer: node('answer', {
        action: 'flow.output',
        params: { values: '{"title": "{{ fetch.data.title }}"}' },
        beforeNode: 'fetch'
      })
    }
  }
};
