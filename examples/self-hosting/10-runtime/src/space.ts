import {
  apiContainer,
  authorSpace,
  button,
  container,
  heading,
  link,
  onClick,
  paragraph,
  reloadApi,
  runServerAction,
  text
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace, PageSpec } from '@plitzi/sdk-authoring';

/**
 * One page, and all it knows of the runtime is the actions' names: the count is built into the HTML by `visits` (a
 * render action), and the button runs `visit`, then asks `visits` again.
 */
const page: PageSpec = {
  name: 'Pulse',
  slug: '',
  class: 'pulsePage',
  body: [
    heading({ content: 'Pulse', subType: 'h1' }),
    paragraph({
      content: 'A space whose server code is its own runtime — its tasks, a route and a stream, in one module.'
    }),
    apiContainer({
      id: 'visits',
      runtime: 'server',
      action: 'visits',
      subType: 'section',
      class: 'pulseCard',
      children: [
        paragraph({
          id: 'visits-count',
          content: '',
          class: 'pulseCount',
          bind: [
            {
              to: 'content',
              source: 'visits.visits',
              transformers: [{ action: 'twigTemplate', params: { template: '{{ source }} visits so far' } }]
            }
          ]
        }),
        button({
          id: 'count-me',
          subType: 'button',
          content: 'Count me',
          class: 'pulseButton',
          flows: [[onClick(), runServerAction({ actionId: 'visit', invalidateQueries: 'none' }), reloadApi('visits')]]
        })
      ]
    }),
    container({
      class: 'pulseLinks',
      children: [
        link({ mode: 'external', href: '/fn/visits', label: 'The count, as JSON', children: [text('/fn/visits')] }),
        text(' · '),
        link({ mode: 'external', href: '/pulse', label: 'Who is listening, live', children: [text('/pulse')] })
      ]
    })
  ]
};

/** Readable in either scheme: every colour is a `light-dark()` pair, and the page says it speaks both. */
export const offlineData: AuthoredSpace = authorSpace({
  name: 'Pulse',
  permanentUrl: 'pulse',
  // What lets the count resolve while the page is built; without it the provider renders empty.
  rsc: { enabled: true },
  classes: {
    pulsePage: {
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
    pulseCard: {
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
    pulseCount: { desktop: { 'font-size': '28px', 'font-weight': '600' } },
    pulseButton: {
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
    pulseLinks: { desktop: { 'font-size': '14px', color: 'light-dark(#4b5563, #9ca3af)' } }
  },
  pages: [page]
});
