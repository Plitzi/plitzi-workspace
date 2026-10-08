import { describe, expect, it } from 'vitest';

import { container, heading, paragraph, scope } from '../elements';
import { pageFamily } from './pageFamily';
import { authorSpace } from './space';

import type { PageFamilyEntry } from './pageFamily';
import type { SpaceSpec } from './types';

type Course = PageFamilyEntry & { lead: string };

const COURSES: readonly Course[] = [
  { id: 'starters', title: 'Starters', slug: 'starters', description: 'To begin.', lead: 'Small plates.' },
  { id: 'mains', title: 'Mains', slug: 'mains', lead: 'From the fire.' }
];

const menu = (entries: readonly Course[]): SpaceSpec => ({
  name: 'Family',
  permanentUrl: 'family',
  pages: [
    { id: 'home', name: 'Home', slug: '', body: [heading({ content: 'Home' })] },
    ...pageFamily<Course>(
      {
        folder: 'menu',
        seoTitle: course => `${course.title} — Menu`,
        body: (course, ref) => [
          container({
            id: 'head',
            children: [
              heading({ id: 'title', content: course.title }),
              paragraph({ id: 'lead', content: course.lead, bind: { className: `${ref('title')}.attributes.content` } })
            ]
          })
        ]
      },
      entries
    )
  ],
  pageFolders: [{ id: 'menu', name: 'Menu', slug: 'menu' }]
});

describe('pageFamily', () => {
  it('writes one page per entry, titled and filed as the family says', () => {
    const pages = pageFamily<Course>(
      { folder: 'menu', seoTitle: course => `${course.title} — Menu`, body: () => [] },
      COURSES
    );

    expect(pages.map(page => [page.id, page.name, page.slug, page.seoTitle, page.seoDescription, page.folder])).toEqual(
      [
        ['starters', 'Starters', 'starters', 'Starters — Menu', 'To begin.', 'menu'],
        ['mains', 'Mains', 'mains', 'Mains — Menu', undefined, 'menu']
      ]
    );
  });

  /** A folder is part of its pages' address: never declared for the author, but the refusal says how. */
  it('names the field a folder nobody declared is declared in', () => {
    const { pageFolders: _declared, ...undeclared } = menu(COURSES);

    expect(() => authorSpace(undeclared)).toThrow(
      'Page "Starters" is in folder "menu", which this space does not declare. Declare it on the space: `pageFolders: [{ id: \'menu\', name: \'…\' }]`.'
    );
  });

  it('gives every page ids of its own, and `ref` their full names', () => {
    const { schema } = authorSpace(menu(COURSES));

    expect(schema.flat['starters-title']).toBeDefined();
    expect(schema.flat['mains-title']).toBeDefined();
    expect(JSON.stringify(schema.flat['mains-lead'])).toContain('mains-title');
  });

  /** A family's body is written once: its pages carrying it are no copies, while the same pages written by hand are. */
  it('is not offered a component for the body its pages share', () => {
    const block = (course: Course) => [
      container({
        id: 'card',
        children: [
          heading({ id: 'name', content: course.title }),
          paragraph({ id: 'lede', content: course.lead }),
          container({
            id: 'meta',
            children: [paragraph({ id: 'one', content: '1' }), paragraph({ id: 'two', content: '2' })]
          }),
          paragraph({ id: 'note', content: course.title })
        ]
      })
    ];
    const entries: Course[] = [...COURSES, { id: 'desserts', title: 'Desserts', slug: 'desserts', lead: 'Sweet.' }];
    const space = (pages: SpaceSpec['pages']): SpaceSpec => ({
      name: 'Family',
      permanentUrl: 'family',
      pages: [{ id: 'home', name: 'Home', slug: '', body: [heading({ content: 'Home' })] }, ...pages]
    });
    const codes = (spec: SpaceSpec) => authorSpace(spec).suggestions.map(suggestion => suggestion.code);

    expect(codes(space(pageFamily<Course>({ body: block }, entries)))).not.toContain('repeated-shape');
    expect(
      codes(
        space(
          entries.map(entry => ({
            id: entry.id,
            name: entry.title,
            slug: entry.slug,
            body: scope(entry.id, () => block(entry))
          }))
        )
      )
    ).toContain('repeated-shape');
  });

  it('refuses two entries of one id, or of one slug, as it refuses any two pages', () => {
    expect(() => authorSpace(menu([...COURSES, { ...COURSES[0], slug: 'again' }]))).toThrow(/\[id-taken\]/);
    expect(() => authorSpace(menu([...COURSES, { ...COURSES[0], id: 'again' }]))).toThrow(/\[page-route-taken\]/);
  });
});
