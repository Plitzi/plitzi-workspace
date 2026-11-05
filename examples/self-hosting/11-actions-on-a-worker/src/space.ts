import {
  authorSpace,
  button,
  container,
  heading,
  named,
  onClick,
  paragraph,
  runServerAction,
  setState,
  text
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace, PageSpec } from '@plitzi/sdk-authoring';

/**
 * One page and one button: it runs `press` and shows how many presses there have been. Nothing on it knows where the
 * action runs — the page server tells it where to call (`/_action`, or the worker's own origin), and the call is the
 * worker's.
 */
const page: PageSpec = {
  name: 'Presses',
  slug: '',
  class: 'pressPage',
  body: [
    heading({ content: 'Presses', subType: 'h1' }),
    paragraph({
      content: 'This page comes from one server and its button runs on another: a worker that serves no page.',
      class: 'pressLede'
    }),
    container({
      class: 'pressCard',
      children: [
        text({ content: 'No presses yet', class: 'pressCount', visible: '!state.presses' }),
        text({
          id: 'press-count',
          content: '',
          class: 'pressCount',
          visible: 'state.presses',
          bind: [
            {
              to: 'content',
              source: 'state.presses',
              transformers: [{ action: 'twigTemplate', params: { template: 'Presses so far: {{ source }}' } }]
            }
          ]
        }),
        button({
          id: 'press',
          subType: 'button',
          content: 'Press',
          class: 'pressButton',
          flows: [
            [
              onClick(),
              named('pressed', runServerAction({ actionId: 'press', mode: 'await', invalidateQueries: 'none' })),
              setState({ key: 'presses', type: 'number', value: '{{pressed.output.presses}}' })
            ]
          ]
        })
      ]
    })
  ]
};

/** Readable in either scheme: every colour is a `light-dark()` pair, and the page says it speaks both. */
export const offlineData: AuthoredSpace = authorSpace({
  name: 'Presses',
  permanentUrl: 'presses',
  classes: {
    pressPage: {
      desktop: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '16px',
        'min-height': '100vh',
        padding: '48px 16px',
        'font-family': 'system-ui, sans-serif',
        'color-scheme': 'light dark',
        'background-color': 'light-dark(#ffffff, #0b0b0f)',
        color: 'light-dark(#111827, #e5e7eb)'
      }
    },
    pressLede: { desktop: { 'max-width': '480px', 'text-align': 'center', color: 'light-dark(#4b5563, #9ca3af)' } },
    pressCard: {
      desktop: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '12px',
        padding: '24px',
        'border-radius': '12px',
        border: '1px solid light-dark(#e5e7eb, #27272a)'
      }
    },
    pressCount: { desktop: { 'font-size': '28px', 'font-weight': '600' } },
    pressButton: {
      desktop: {
        padding: '8px 16px',
        'border-radius': '6px',
        border: '0px solid transparent',
        'background-color': '#5c3df5',
        color: '#ffffff',
        'font-size': '14px',
        cursor: 'pointer'
      }
    }
  },
  pages: [page]
});
