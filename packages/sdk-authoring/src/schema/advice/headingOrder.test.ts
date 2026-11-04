import { describe, expect, it } from 'vitest';

import { authorSpace, container, heading, markdown } from '../../index';

import type { PageSpec, SpaceSpec } from '../../index';

/** The `heading-level-skipped` suggestions of a space, each with the element it is about first. */
const offered = (spec: SpaceSpec) =>
  authorSpace(spec).suggestions.filter(suggestion => suggestion.code === 'heading-level-skipped');

const page = (id: string, body: PageSpec['body'], more: Partial<PageSpec> = {}): PageSpec => ({
  id,
  name: id,
  slug: id === 'home' ? '' : id,
  body,
  ...more
});

describe('heading-level-skipped, a suggestion', () => {
  it('offers the heading that skips a level, and none that follows its level', () => {
    const found = offered({
      name: 'Plans',
      permanentUrl: 'plans',
      pages: [
        page('home', [
          heading('Plans', { id: 'title' }),
          heading('Terms', { id: 'fine-print', subType: 'h3' }),
          heading('FAQ', { id: 'faq', subType: 'h2' })
        ])
      ]
    });

    expect(found.map(suggestion => suggestion.elementIds)).toEqual([['fine-print', 'title']]);
  });

  // A page is drawn inside its shell: the shell's h1 and the page's first heading are one outline, as a browser reads it.
  it('reads a page inside its layout, and offers a skip in the layout once for all its pages', () => {
    const found = offered({
      name: 'Shell',
      permanentUrl: 'shell',
      layouts: [
        {
          id: 'app',
          body: [
            heading('Analytics', { id: 'app-title' }),
            container({ id: 'app-main' }),
            heading('Help', { id: 'app-help', subType: 'h4' })
          ]
        }
      ],
      pages: [
        page('home', [heading('Visits', { id: 'visits', subType: 'h3' })], { layout: { id: 'app', slot: 'app-main' } }),
        page('sources', [heading('Referrers', { id: 'referrers', subType: 'h2' })], {
          layout: { id: 'app', slot: 'app-main' }
        })
      ]
    });

    expect(found.map(suggestion => suggestion.elementIds[0]).sort()).toEqual(['app-help', 'visits']);
    expect(found.find(suggestion => suggestion.elementIds[0] === 'visits')?.elementIds).toEqual([
      'visits',
      'app-title'
    ]);
  });

  // What starts hidden is not in the outline the page arrives with: the levels around it skip one while it is away.
  it('offers a skip only a heading hidden until its data shows it fills', () => {
    const found = offered({
      name: 'Dashboard',
      permanentUrl: 'dashboard',
      pages: [
        page('home', [
          heading('Welcome', { id: 'welcome' }),
          container({
            id: 'steps',
            visible: false,
            children: [heading('Get started', { id: 'steps-title', subType: 'h2' })]
          }),
          heading('Traffic', { id: 'traffic', subType: 'h3' })
        ])
      ]
    });

    expect(found.map(suggestion => suggestion.elementIds[0])).toEqual(['traffic']);
    expect(found[0].message).toContain('whenever "steps" is hidden');
  });

  it('reads the headings a markdown text draws', () => {
    const found = offered({
      name: 'Notes',
      permanentUrl: 'notes',
      pages: [
        page('home', [
          heading('Notes', { id: 'notes' }),
          markdown({ id: 'body', content: '### Deep first\n\n## Then up' })
        ])
      ]
    });

    expect(found.map(suggestion => suggestion.elementIds[0])).toEqual(['body']);
    expect(found[0].message).toContain('"Deep first"');
  });

  it('is no warning: the page renders as written', () => {
    const { warnings } = authorSpace({
      name: 'Plans',
      permanentUrl: 'plans',
      pages: [page('home', [heading('Plans', { id: 'title' }), heading('Terms', { id: 'fine-print', subType: 'h3' })])]
    });

    expect(warnings.filter(issue => issue.code === 'heading-level-skipped')).toEqual([]);
  });
});
