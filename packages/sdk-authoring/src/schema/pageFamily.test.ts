import { describe, expect, it } from 'vitest';

import { container, heading, paragraph } from '../elements';
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

  it('gives every page ids of its own, and `ref` their full names', () => {
    const { schema } = authorSpace(menu(COURSES));

    expect(schema.flat['starters-title']).toBeDefined();
    expect(schema.flat['mains-title']).toBeDefined();
    expect(JSON.stringify(schema.flat['mains-lead'])).toContain('mains-title');
  });

  it('refuses two entries of one id, or of one slug, as it refuses any two pages', () => {
    expect(() => authorSpace(menu([...COURSES, { ...COURSES[0], slug: 'again' }]))).toThrow(/\[id-taken\]/);
    expect(() => authorSpace(menu([...COURSES, { ...COURSES[0], id: 'again' }]))).toThrow(/\[page-route-taken\]/);
  });
});
