import { describe, expect, it } from 'vitest';

import { placementOf, pluginText } from './projectPlugins';

import type { ProjectPlugin } from './projectPlugins';

const quoted = (words: string): string => `'${words}'`;

const rating: ProjectPlugin = {
  name: 'Rating',
  attributes: 'RatingAttributes',
  declaration: {
    type: 'rating',
    triggers: { onRate: { action: 'onRate' } },
    callbacks: {},
    content: { attributes: { value: 4, label: 'Rate it' }, definition: { label: 'Rating' } }
  }
};

const FROM = quoted('../plugins/Rating/declaration.ts');

// An element of the project's own is said as one the SDK ships: how it is written, and what it takes, fires, answers.
describe('an element of the project’s own', () => {
  it('is written on a page from its declaration, with every attribute at its default', () => {
    expect(placementOf(rating, 'about-rating')).toEqual([
      `import ratingDeclaration from ${FROM};`,
      `import type { RatingAttributes } from ${FROM};`,
      'const rating = defineElement<RatingAttributes>(ratingDeclaration);',
      `rating({ id: ${quoted('about-rating')}, value: 4, label: ${quoted('Rate it')} })`
    ]);
  });

  it('is written untyped when its declaration exports no attributes type', () => {
    expect(placementOf({ ...rating, attributes: undefined })).toEqual([
      `import ratingDeclaration from ${FROM};`,
      'const rating = defineElement(ratingDeclaration);',
      `rating({ id: ${quoted('rating')}, value: 4, label: ${quoted('Rate it')} })`
    ]);
  });

  it('is explained by what it takes, fires and answers', () => {
    expect(pluginText(rating).split('\n')).toEqual([
      'rating — an element of this project, in src/plugins/Rating/',
      'Written, in src/space/:',
      `  import ratingDeclaration from ${FROM};`,
      `  import type { RatingAttributes } from ${FROM};`,
      '  const rating = defineElement<RatingAttributes>(ratingDeclaration);',
      `  rating({ id: ${quoted('rating')}, value: 4, label: ${quoted('Rate it')} })`,
      'Attributes:',
      '  value = 4',
      '  label = "Rate it"',
      'Fires: onRate',
      'Answers: only what every element answers (setState, toggleState)'
    ]);
  });
});
