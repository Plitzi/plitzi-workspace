import { sampleSpace } from '@plitzi/example-space/space';
import {
  authorSpace,
  button,
  form,
  formControl,
  heading,
  named,
  onSubmit,
  paragraph,
  runServerAction,
  setState
} from '@plitzi/sdk-server/authoring';

import type { AuthoredSpace, PageSpec } from '@plitzi/sdk-server/authoring';

/**
 * The page that calls the action: a form, a button, and somewhere to put the answer.
 *
 * The whole point is what the page does NOT contain. It names an action and hands it two values — never a URL,
 * never a credential, never the systems on the other side — and the server decides what that name may reach from
 * the space's own documents. A page can only ever run what the space already declared.
 */

/**
 * Submitting the form runs the action and shows what came back.
 *
 * Three steps, and the middle one is the whole feature. `runServerAction` is a GLOBAL callback, so it names the
 * module that registered it (`actions`) rather than an element — which is what its builder fills in, along with
 * the mode.
 *
 * `mode: 'await'` is what makes the next step able to read the result: the run's answer lands in the flow scope
 * under this node's id, so `{{quote.output.*}}` is whatever the action's output step named. `detached` would
 * carry on immediately and there would be nothing there to read. Both steps whose results are read are NAMED,
 * because a derived id is unique and unwritable.
 */
const quoteFlow = [
  named('submitted', onSubmit()),
  named(
    'quote',
    runServerAction({
      actionId: 'shipping-quote',
      input: '{"city":"{{submitted.values.city}}","weightKg":"{{submitted.values.weight}}"}',
      mode: 'await'
    })
  ),
  setState({ key: 'quote', type: 'text', value: '{{quote.output.summary}}' })
];

const field = (
  name: string,
  label: string,
  subType: 'text' | 'number',
  defaultValue: string
): PageSpec['body'][0] => formControl({ subType, name, label, defaultValue, required: true, slots: { input: 'actionInput' } });

const quotePage: PageSpec = {
  name: 'Shipping quote',
  slug: '',
  accessLevel: 'public',
  class: 'actionPage',
  body: [
    heading({ content: 'Shipping quote', subType: 'h1', variant: 'lg' }),
    paragraph({
      content:
        'The price is worked out on the server. This page sends a city and a weight, and gets back a line of text.'
    }),
    form({
      idRef: 'quote-form',
      // Without this the browser submits the form itself and the page navigates away; the interaction is what runs.
      managedByInteractions: true,
      method: 'post',
      class: 'actionForm',
      flows: [quoteFlow],
      children: [
        field('city', 'Destination city', 'text', 'Berlin'),
        field('weight', 'Weight (kg)', 'number', '2'),
        button({ subType: 'submit', content: 'Get a quote', class: 'actionButton' })
      ]
    }),
    /**
     * Where the answer lands. `setState` writes `runtime.state.quote`, and a binding addresses it through the
     * `state` source the SDK publishes — so nothing here knows an action was involved.
     */
    paragraph({ content: '', class: 'actionResult', bind: { content: 'state.quote' } })
  ]
};

/**
 * The sample space with this one page in front of it.
 *
 * It REPLACES the sample page rather than joining it: both would sit at `/`, and which one won would come down to
 * sort order. The palette stays, so the page inherits the space's own colours — using `--foreground` without
 * `--background-inner` is what makes a page unreadable in dark mode.
 */
export const offlineData = (): AuthoredSpace =>
  authorSpace({
    ...sampleSpace,
    name: 'Server actions example',
    permanentUrl: 'server-actions-example',
    classes: {
      ...sampleSpace.classes,
      actionPage: {
        desktop: {
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '16px',
          'min-height': '100vh',
          padding: '24px',
          'font-family': 'system-ui, sans-serif',
          'background-color': 'var(--background-inner)',
          color: 'var(--foreground)'
        }
      },
      actionForm: { desktop: { display: 'flex', 'flex-direction': 'column', gap: '12px', 'min-width': '280px' } },
      actionInput: {
        desktop: {
          width: '100%',
          padding: '8px 10px',
          border: '1px solid #94a3b8',
          'border-radius': '6px',
          'font-size': '14px',
          'background-color': 'var(--background-inner)',
          color: 'var(--foreground)'
        }
      },
      actionButton: {
        desktop: {
          padding: '8px 16px',
          'border-radius': '6px',
          border: '0px solid transparent',
          'background-color': '#5c3df5',
          color: '#ffffff',
          'font-size': '14px',
          cursor: 'pointer'
        }
      },
      actionResult: { desktop: { 'min-height': '20px', 'font-size': '16px', 'font-weight': '600' } }
    },
    pages: [quotePage]
  });
