import { readOfflineData } from '@plitzi/example-space';

import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * The page that calls the action: a form, a button, and somewhere to put the answer.
 *
 * The whole point is what the page does NOT contain. It names an action and hands it two values — never a URL,
 * never a credential, never the systems on the other side — and the server decides what that name may reach from
 * the space's own documents. A page can only ever run what the space already declared.
 */

const el = (
  id: string,
  definition: Partial<Element['definition']> & { idRef?: string },
  attributes: Record<string, unknown> = {}
): Element => {
  const { idRef, ...rest } = definition;

  return {
    id,
    // Interactions are wired by `idRef`, never by the opaque id — an element without one is not registered at all.
    ...(idRef ? { idRef } : {}),
    attributes,
    definition: { rootId: 'quote-page', styleSelectors: { base: '' }, ...rest }
  } as Element;
};

const step = (
  id: string,
  type: 'trigger' | 'globalCallback',
  action: string,
  elementId: string,
  params: Record<string, unknown> = {},
  links: { beforeNode?: string; afterNode?: string } = {}
) => ({
  id,
  flowId: 'quote-flow',
  type,
  action,
  elementId,
  params,
  title: action,
  preview: {},
  enabled: true,
  beforeNode: links.beforeNode ?? '',
  afterNode: links.afterNode ?? ''
});

/**
 * Submitting the form runs the action and shows what came back.
 *
 * Three steps, and the middle one is the whole feature. `runServerAction` is a GLOBAL callback, so it names the
 * module that registered it (`actions`) rather than an element, exactly as auth's `login` names `auth`.
 *
 * `mode: 'await'` is what makes the next step able to read the result: the run's answer lands in the flow scope
 * under this node's id, so `{{quote-run.output.*}}` is whatever the action's output step named. `detached` would
 * carry on immediately and there would be nothing there to read.
 */
const quoteFlow = {
  'quote-trigger': step('quote-trigger', 'trigger', 'onSubmit', 'quote-form', {}, { afterNode: 'quote-run' }),
  'quote-run': step(
    'quote-run',
    'globalCallback',
    'runServerAction',
    'actions',
    {
      actionId: 'shipping-quote',
      input: '{"city":"{{quote-trigger.values.city}}","weightKg":"{{quote-trigger.values.weight}}"}',
      mode: 'await'
    },
    { beforeNode: 'quote-trigger', afterNode: 'quote-show' }
  ),
  'quote-show': step(
    'quote-show',
    'globalCallback',
    'setState',
    'state',
    { key: 'quote', type: 'text', value: '{{quote-run.output.summary}}' },
    { beforeNode: 'quote-run' }
  )
};

const quotePage: Record<string, Element> = {
  'quote-page': el(
    'quote-page',
    {
      label: 'Shipping quote',
      type: 'page',
      styleSelectors: { base: 'action-page' },
      items: ['quote-title', 'quote-intro', 'quote-form', 'quote-result']
    },
    { slug: '', default: true, name: 'Shipping quote', accessLevel: 'public' }
  ),

  'quote-title': el(
    'quote-title',
    {
      label: 'Heading',
      type: 'heading',
      parentId: 'quote-page',
      initialState: { visibility: true, styleVariant: { heading: { base: 'lg' } } }
    },
    { subType: 'h1', content: 'Shipping quote' }
  ),

  'quote-intro': el(
    'quote-intro',
    { label: 'Intro', type: 'paragraph', parentId: 'quote-page' },
    {
      content:
        'The price is worked out on the server. This page sends a city and a weight, and gets back a line of text.'
    }
  ),

  'quote-form': el(
    'quote-form',
    {
      label: 'Quote form',
      type: 'form',
      idRef: 'quote-form',
      parentId: 'quote-page',
      styleSelectors: { base: 'action-form' },
      items: ['quote-city', 'quote-weight', 'quote-submit'],
      interactions: quoteFlow
    },
    // Without this the browser submits the form itself and the page navigates away; the interaction is what runs.
    { managedByInteractions: true, method: 'post' }
  ),

  'quote-city': el(
    'quote-city',
    {
      label: 'City',
      type: 'formControl',
      parentId: 'quote-form',
      styleSelectors: { base: '', label: '', input: 'action-input', error: '' }
    },
    { subType: 'text', name: 'city', label: 'Destination city', defaultValue: 'Berlin', required: true }
  ),

  'quote-weight': el(
    'quote-weight',
    {
      label: 'Weight',
      type: 'formControl',
      parentId: 'quote-form',
      styleSelectors: { base: '', label: '', input: 'action-input', error: '' }
    },
    { subType: 'number', name: 'weight', label: 'Weight (kg)', defaultValue: '2', required: true }
  ),

  'quote-submit': el(
    'quote-submit',
    { label: 'Get a quote', type: 'button', parentId: 'quote-form', styleSelectors: { base: 'action-button' } },
    { subType: 'submit', content: 'Get a quote' }
  ),

  /**
   * Where the answer lands. `setState` writes `runtime.state.quote`, and a binding addresses it through the
   * `state` source the SDK publishes — so nothing here knows an action was involved.
   */
  'quote-result': el(
    'quote-result',
    {
      label: 'Result',
      type: 'paragraph',
      parentId: 'quote-page',
      styleSelectors: { base: 'action-result' },
      bindings: { attributes: [{ id: 'b-quote', source: 'state.quote', to: 'content', enabled: true }] }
    },
    { content: '' }
  )
};

/**
 * The sample space defines `--foreground` and `--background-inner` and flips both per colour scheme. Using one
 * without the other is what makes a page unreadable in dark mode: near-white text on the browser's white default.
 */
const CSS = `
.action-page{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:100vh;padding:24px;font-family:system-ui,sans-serif;background:var(--background-inner,#fff);color:var(--foreground,#17171c);}
.action-form{display:flex;flex-direction:column;gap:12px;min-width:280px;}
.action-form label{color:var(--foreground,#17171c);}
.action-input{width:100%;padding:8px 10px;border:1px solid #94a3b8;border-radius:6px;font-size:14px;background:var(--background-inner,#fff);color:var(--foreground,#17171c);}
.action-button{padding:8px 16px;border-radius:6px;border:0;background:#5c3df5;color:#fff;font-size:14px;cursor:pointer;}
.action-result{min-height:20px;font-size:16px;font-weight:600;}
`;

/**
 * The sample space with this one page in front of it.
 *
 * It REPLACES the sample page rather than joining it: both would sit at `/`, and which one won would come down to
 * sort order. The style stays, so the page inherits the space's own colours.
 */
export const offlineData = (): OfflineDataRaw => {
  const data = readOfflineData() as OfflineDataRaw;

  return {
    ...data,
    schema: {
      ...data.schema,
      flat: { ...data.schema.flat, ...quotePage },
      pages: ['quote-page']
    },
    style: { ...data.style, cache: `${data.style.cache ?? ''}${CSS}` }
  };
};
