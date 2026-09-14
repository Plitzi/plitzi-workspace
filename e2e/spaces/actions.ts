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
const SLOW_PAGE_ID = 'action-slow-page';

export const ACTION_IDS = {
  page: PAGE_ID,
  provider: 'action-provider',
  title: 'action-title',
  who: 'action-who',
  orphan: 'action-orphan',
  orphanText: 'action-orphan-text',
  slowPage: 'action-slow-page',
  slow: 'action-slow',
  slowText: 'action-slow-text',
  offline: 'action-offline',
  offlineText: 'action-offline-text',
  button: 'action-button',
  status: 'action-status'
};

/** What the flow answers, so a spec asserts on a string it can point at rather than on a fixture's prose. */
export const ACTION_OUTPUT = { title: 'resolved by an action', who: 'everyone' };

/** What the provider element publishes when its slice never arrived. The page binds it; a spec reads it back. */
export const PROVIDER_ERROR = 'The data provider could not be reached';

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

/** A provider publishes its source under `<type>_<id>`, so a binding names the element by its id. Spelled out
 *  rather than derived: a name that stopped matching resolves to nothing, and that is what the specs must see. */
const providerSource = (providerId: string, path: string) => `apiContainer_${providerId}.${path}`;

const bound = (id: string, source: string, parentId: string, rootId = PAGE_ID): Element =>
  element(
    id,
    'paragraph',
    { content: '' },
    { parentId, rootId, bindings: { attributes: [{ id: `b-${id}`, source, to: 'content' }] } }
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
  trigger: node('trigger', { type: 'trigger', action: 'onClick', elementId: ACTION_IDS.button, afterNode: 'run' }),
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
      pages: [PAGE_ID, SLOW_PAGE_ID],
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
          { runtime: 'server', items: [ACTION_IDS.title, ACTION_IDS.who] }
        ),
        [ACTION_IDS.title]: bound(ACTION_IDS.title, providerSource(ACTION_IDS.provider, 'title'), ACTION_IDS.provider),
        [ACTION_IDS.who]: bound(ACTION_IDS.who, providerSource(ACTION_IDS.provider, 'who'), ACTION_IDS.provider),
        [ACTION_IDS.orphan]: element(
          ACTION_IDS.orphan,
          'apiContainer',
          { connector: 'not-configured-here', subType: 'section' },
          { runtime: 'server', items: [ACTION_IDS.orphanText] }
        ),
        [ACTION_IDS.orphanText]: bound(
          ACTION_IDS.orphanText,
          providerSource(ACTION_IDS.orphan, 'title'),
          ACTION_IDS.orphan
        ),
        /** Fed by an action whose own outbound call cannot resolve — the server is up, the internet is not. */
        /**
         * A page of its own, so only the spec about it pays for it.
         *
         * Its action takes longer than the deployment's per-element budget — the PAGE's ceiling, which wins over
         * whatever the action itself is allowed — and nothing else on the site should be slower for that.
         */
        [SLOW_PAGE_ID]: element(
          SLOW_PAGE_ID,
          'page',
          { slug: 'slow', default: false, name: 'Slow' },
          { parentId: undefined, rootId: SLOW_PAGE_ID, items: [ACTION_IDS.slow] }
        ),
        [ACTION_IDS.slow]: element(
          ACTION_IDS.slow,
          'apiContainer',
          { action: 'e2e-slow', subType: 'section' },
          {
            rootId: SLOW_PAGE_ID,
            parentId: SLOW_PAGE_ID,
            runtime: 'server',
            items: [ACTION_IDS.slowText]
          }
        ),
        [ACTION_IDS.slowText]: bound(
          ACTION_IDS.slowText,
          providerSource(ACTION_IDS.slow, 'errorMessage'),
          ACTION_IDS.slow,
          SLOW_PAGE_ID
        ),
        [ACTION_IDS.offline]: element(
          ACTION_IDS.offline,
          'apiContainer',
          { action: 'e2e-unreachable', subType: 'section' },
          { runtime: 'server', items: [ACTION_IDS.offlineText] }
        ),
        [ACTION_IDS.offlineText]: bound(
          ACTION_IDS.offlineText,
          providerSource(ACTION_IDS.offline, 'errorMessage'),
          ACTION_IDS.offline
        ),
        [ACTION_IDS.button]: element(
          ACTION_IDS.button,
          'button',
          { subType: 'button', content: 'Run it' },
          { interactions: runFlow }
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
      /** `runId` rides along so a spec can see WHICH run answered: two responses carrying the same one were
       *  served by one run of the flow, which is the whole of "a page being read by many is read once". */
      answer: node('answer', {
        action: 'flow.output',
        params: { values: `{"title": "${ACTION_OUTPUT.title}", "who": "{{input.who}}", "run": "{{runId}}"}` },
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

/** Slower than the page will wait for, so what ends it is the deployment's per-element budget and not its own. */
export const SLOW_ACTION = {
  id: 'e2e-slow',
  document: {
    name: 'Slow feed',
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'render',
        params: { access: 'public' },
        afterNode: 'hold'
      }),
      hold: node('hold', { action: 'flow.delay', params: { milliseconds: '2000' }, afterNode: 'answer' }),
      answer: node('answer', {
        action: 'flow.output',
        params: { values: '{"title": "too late"}' },
        beforeNode: 'hold'
      })
    }
  }
};

/** The SMTP credential the action server holds for its space — pointed at the suite's mail sink. */
export const MAIL_CREDENTIAL = 'e2e-smtp';

/** Who that credential sends as: the sender is the space's server, never a parameter a flow renders. */
export const MAIL_FROM = { name: 'E2E Actions', address: 'actions@e2e.test' };

/** A visitor names the recipient and a name; the subject and the body are rendered from what they typed. */
const mailDocument = (name: string, credential: string) => ({
  name,
  nodes: {
    start: node('start', {
      type: 'trigger',
      action: 'call',
      params: {
        access: 'public',
        input: '{"to":{"type":"text","defaultValue":""},"name":{"type":"text","defaultValue":""}}'
      },
      afterNode: 'send'
    }),
    send: node('send', {
      action: 'email.send',
      params: {
        credential,
        to: '{{ input.to }}',
        subject: 'Hello {{ input.name }}',
        text: 'Sent by a flow for {{ input.name }}.'
      },
      beforeNode: 'start',
      afterNode: 'answer'
    }),
    answer: node('answer', { action: 'flow.output', params: { values: '{"sent": true}' }, beforeNode: 'send' })
  }
});

/** Sends one message through the space's own SMTP server. */
export const MAIL_ACTION = { id: 'e2e-mail', document: mailDocument('Mail', MAIL_CREDENTIAL) };

/** A counter per slot the two actions below share, as a booking's seats are. */
const slotInput = '{"slot":{"type":"text","defaultValue":""}}';

/**
 * A seat taken, a confirmation that cannot leave, and the seat given back.
 *
 * The undo a failed run jumps to, through the tasks a real booking uses: the confirmation names no SMTP server, so the
 * run fails after the seat is already taken, and what follows On Failure is the only thing that can return it.
 */
export const HELD_SEAT_ACTION = {
  id: 'e2e-hold-seat',
  document: {
    name: 'Hold a seat',
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'call',
        params: { access: 'public', input: slotInput },
        afterNode: 'take'
      }),
      take: node('take', {
        action: 'kv.increment',
        params: { key: 'seats:{{ input.slot }}', amount: '1' },
        beforeNode: 'start',
        afterNode: 'confirm'
      }),
      confirm: node('confirm', {
        action: 'email.send',
        params: { credential: '', to: 'guest@e2e.test', subject: 'Your seat', text: 'Held for you.' },
        beforeNode: 'take',
        afterNode: 'answer'
      }),
      answer: node('answer', {
        action: 'flow.output',
        params: { values: '{"held": true}' },
        beforeNode: 'confirm',
        afterNode: 'undo'
      }),
      undo: node('undo', { action: 'flow.onFailure', beforeNode: 'answer', afterNode: 'giveBack' }),
      giveBack: node('giveBack', {
        action: 'kv.increment',
        params: { key: 'seats:{{ input.slot }}', amount: '-1' },
        when: { combinator: 'and', rules: [{ field: 'take.value', operator: '!=', value: '' }] },
        beforeNode: 'undo'
      })
    }
  }
};

/** How many seats a slot has taken, read back by a separate run. */
export const SEATS_ACTION = {
  id: 'e2e-seats',
  document: {
    name: 'Seats',
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'call',
        params: { access: 'public', input: slotInput },
        afterNode: 'count'
      }),
      count: node('count', {
        action: 'kv.get',
        params: { key: 'seats:{{ input.slot }}' },
        beforeNode: 'start',
        afterNode: 'answer'
      }),
      answer: node('answer', {
        action: 'flow.output',
        params: { values: '{"taken": "{{ count.value }}"}' },
        beforeNode: 'count'
      })
    }
  }
};

/** The same step naming no SMTP server at all — what a space that never configured one has. */
export const UNCONFIGURED_MAIL_ACTION = { id: 'e2e-mail-unconfigured', document: mailDocument('Mail, no server', '') };
