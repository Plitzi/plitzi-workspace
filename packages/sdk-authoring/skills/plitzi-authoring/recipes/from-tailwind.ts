/**
 * A design written in Tailwind classes, kept as classes the builder edits: `tw()` turns them into rules when the space
 * is written. The space's colours stay tokens with both themes — `createTw({ colors: tokens(variables) })` — and
 * Tailwind's own palette is there for the rest.
 */
import { container, createTw, heading, link, styles, text, tokens } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const variables = {
  color: {
    surface: { light: '#ffffff', dark: '#0f172a', default: '#ffffff' },
    ink: { light: '#0f172a', dark: '#e2e8f0', default: '#0f172a' },
    accent: { light: '#0891b2', dark: '#22d3ee', default: '#0891b2' }
  }
} satisfies SpaceSpec['variables'];

const tw = createTw({ colors: tokens(variables) });

const grid = styles('feature-grid', tw('grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'));
// The card's title moves with the card's hover: an ancestor named by its class.
const card = styles(
  'feature-card',
  tw('rounded-xl border border-ink/10 bg-surface p-6 transition-shadow hover:shadow-lg')
);
const title = styles('feature-title', tw('text-lg font-semibold text-ink group-hover/feature-card:text-accent'));
const cta = styles(
  'feature-cta',
  tw('inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:scale-105')
);

export const recipe: SpaceSpec = {
  name: 'Features',
  permanentUrl: 'features',
  variables,
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        container({
          class: grid,
          children: ['Fast', 'Typed', 'Yours'].map(name =>
            container({ class: card, children: [heading(name, { subType: 'h3', class: title }), text('…')] })
          )
        }),
        link({ href: '/start', class: cta, content: 'Get started' })
      ]
    }
  ]
};
