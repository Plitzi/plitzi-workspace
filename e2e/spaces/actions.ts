import {
  apiContainer,
  authorSpace,
  button,
  defineAction,
  named,
  onClick,
  paragraph,
  runServerAction,
  setState
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';
import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * A page whose server elements are fed by ACTIONS rather than by connectors.
 *
 * That combination is the point: a space wired this way configures no connectors at all, which for a while meant
 * its `runtime: 'server'` elements resolved to nothing with no configuration missing anywhere. The second provider
 * names a connector this deployment cannot read, because "one producer is absent" must cost that element and
 * nothing else.
 */

export const ACTION_IDS = {
  page: 'action-page',
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

/** A paragraph showing one path of a provider's answer — named by the provider's id, which is its source. */
const shows = (id: string, source: string) => paragraph('', { id, bind: { content: source } });

/**
 * The click path: run the action from the browser and put what the step answered on the page.
 *
 * `{{run.status}}` is the assertion surface. A run that completed, one the server refused and one that never
 * reached a server at all all land here as a status — which is the whole contract being checked: the flow gets a
 * RESULT it can bind, whatever happened to the request.
 */
const runFlow = [
  onClick(),
  named('run', runServerAction({ actionId: 'e2e-feed', input: {}, mode: 'await' })),
  named('show', setState({ key: 'runStatus', type: 'text', value: '{{run.status}}' }))
];

/**
 * @param debugMode Whether the space switched the dev tools on for its own published site — the setting an owner
 *   toggles in the builder. It is what authorizes a PUBLISHED page to be told what its flows did; a deployment in
 *   `devMode` authorizes that on its own, and a space that asked for neither is told nothing.
 */
export const actionSpace = (debugMode = false): AuthoredSpace =>
  authorSpace({
    name: 'actions',
    permanentUrl: 'actions',
    settings: debugMode ? { debugMode: true } : {},
    rsc: { enabled: true },
    pages: [
      {
        id: ACTION_IDS.page,
        name: 'Actions',
        slug: '',
        isDefault: true,
        body: [
          apiContainer({
            id: ACTION_IDS.provider,
            action: 'e2e-feed',
            subType: 'section',
            runtime: 'server',
            children: [
              shows(ACTION_IDS.title, `${ACTION_IDS.provider}.title`),
              shows(ACTION_IDS.who, `${ACTION_IDS.provider}.who`)
            ]
          }),
          apiContainer({
            id: ACTION_IDS.orphan,
            connector: 'not-configured-here',
            subType: 'section',
            runtime: 'server',
            children: [shows(ACTION_IDS.orphanText, `${ACTION_IDS.orphan}.title`)]
          }),
          /** Fed by an action whose own outbound call cannot resolve — the server is up, the internet is not. */
          apiContainer({
            id: ACTION_IDS.offline,
            action: 'e2e-unreachable',
            subType: 'section',
            runtime: 'server',
            children: [shows(ACTION_IDS.offlineText, `${ACTION_IDS.offline}.errorMessage`)]
          }),
          button({ id: ACTION_IDS.button, content: 'Run it', flows: [runFlow] }),
          shows(ACTION_IDS.status, 'state.runStatus')
        ]
      },
      /**
       * A page of its own, so only the spec about it pays for it.
       *
       * Its action takes longer than the deployment's per-element budget — the PAGE's ceiling, which wins over
       * whatever the action itself is allowed — and nothing else on the site should be slower for that.
       */
      {
        id: ACTION_IDS.slowPage,
        name: 'Slow',
        slug: 'slow',
        body: [
          apiContainer({
            id: ACTION_IDS.slow,
            action: 'e2e-slow',
            subType: 'section',
            runtime: 'server',
            children: [shows(ACTION_IDS.slowText, `${ACTION_IDS.slow}.errorMessage`)]
          })
        ]
      }
    ]
  });

/**
 * The action behind the provider: a way in, a step that takes long enough to overlap another render, and a
 * contract.
 *
 * The delay is load-bearing. Single-flight refuses a second run holding the same key, and a flow that finishes
 * inside a microtask would let concurrent renders miss each other — which is the failure this fixture exists to
 * catch reappearing.
 */
export const FEED_ACTION: ActionEntry = defineAction({
  id: 'e2e-feed',
  name: 'Feed',
  trigger: [
    {
      id: 'start',
      type: 'render',
      access: 'public',
      input: { who: { type: 'text', defaultValue: ACTION_OUTPUT.who } }
    },
    /** The second way in, for the button: a call is not a render, and each way in states its own rule. Both head
     *  the same chain — one action, two doors. */
    { id: 'called', type: 'call', access: 'public', input: { who: { type: 'text', defaultValue: ACTION_OUTPUT.who } } }
  ],
  steps: [{ id: 'hold', task: 'flow.delay', params: { milliseconds: '250' } }],
  /** `runId` rides along so a spec can see WHICH run answered: two responses carrying the same one were served by
   *  one run of the flow, which is the whole of "a page being read by many is read once". */
  output: `{"title": "${ACTION_OUTPUT.title}", "who": "{{input.who}}", "run": "{{runId}}"}`
});

/**
 * The action whose own call cannot go anywhere: the server is up, the internet is not.
 *
 * `.invalid` is reserved by RFC 6761 and never resolves — for anybody, on any machine, connected or not — so this
 * is the outage reproduced rather than simulated, and it costs no network to run.
 */
export const UNREACHABLE_ACTION: ActionEntry = defineAction({
  id: 'e2e-unreachable',
  name: 'Unreachable feed',
  trigger: { type: 'render', access: 'public' },
  steps: [{ id: 'fetch', task: 'http.request', params: { url: 'https://offline.invalid/feed', method: 'GET' } }],
  output: '{"title": "{{ fetch.data.title }}"}'
});

/** Slower than the page will wait for, so what ends it is the deployment's per-element budget and not its own. */
export const SLOW_ACTION: ActionEntry = defineAction({
  id: 'e2e-slow',
  name: 'Slow feed',
  trigger: { type: 'render', access: 'public' },
  steps: [{ id: 'hold', task: 'flow.delay', params: { milliseconds: '2000' } }],
  output: '{"title": "too late"}'
});

/** The SMTP credential the action server holds for its space — pointed at the suite's mail sink. */
export const MAIL_CREDENTIAL = 'e2e-smtp';

/** Who that credential sends as: the sender is the space's server, never a parameter a flow renders. */
export const MAIL_FROM = { name: 'E2E Actions', address: 'actions@e2e.test' };

/** A visitor names the recipient and a name; the subject and the body are rendered from what they typed. */
const mailAction = (id: string, name: string, credential: string): ActionEntry =>
  defineAction({
    id,
    name,
    trigger: {
      type: 'call',
      access: 'public',
      input: { to: { type: 'text', defaultValue: '' }, name: { type: 'text', defaultValue: '' } }
    },
    steps: [
      {
        id: 'send',
        task: 'email.send',
        // In the params rather than as the step's `credential`: the unconfigured case is an EMPTY one, written out.
        params: {
          credential,
          to: '{{ input.to }}',
          subject: 'Hello {{ input.name }}',
          text: 'Sent by a flow for {{ input.name }}.'
        }
      }
    ],
    output: '{"sent": true}'
  });

/** Sends one message through the space's own SMTP server. */
export const MAIL_ACTION = mailAction('e2e-mail', 'Mail', MAIL_CREDENTIAL);

/** A counter per slot the two actions below share, as a booking's seats are. */
const slotInput = { slot: { type: 'text' as const, defaultValue: '' } };

/**
 * A seat taken, a confirmation that cannot leave, and the seat given back.
 *
 * The undo a failed run jumps to, through the tasks a real booking uses: the confirmation names no SMTP server, so the
 * run fails after the seat is already taken, and what follows On Failure is the only thing that can return it.
 */
export const HELD_SEAT_ACTION: ActionEntry = defineAction({
  id: 'e2e-hold-seat',
  name: 'Hold a seat',
  trigger: { type: 'call', access: 'public', input: slotInput },
  steps: [
    { id: 'take', task: 'kv.increment', params: { key: 'seats:{{ input.slot }}', amount: '1' } },
    {
      id: 'confirm',
      task: 'email.send',
      params: { credential: '', to: 'guest@e2e.test', subject: 'Your seat', text: 'Held for you.' }
    }
  ],
  output: '{"held": true}',
  onFailure: [
    {
      id: 'giveBack',
      task: 'kv.increment',
      params: { key: 'seats:{{ input.slot }}', amount: '-1' },
      when: { combinator: 'and', rules: [{ field: 'take.value', operator: '!=', value: '' }] }
    }
  ]
});

/** How many seats a slot has taken, read back by a separate run. */
export const SEATS_ACTION: ActionEntry = defineAction({
  id: 'e2e-seats',
  name: 'Seats',
  trigger: { type: 'call', access: 'public', input: slotInput },
  steps: [{ id: 'count', task: 'kv.get', params: { key: 'seats:{{ input.slot }}' } }],
  output: '{"taken": "{{ count.value }}"}'
});

/** The same step naming no SMTP server at all — what a space that never configured one has. */
export const UNCONFIGURED_MAIL_ACTION = mailAction('e2e-mail-unconfigured', 'Mail, no server', '');
