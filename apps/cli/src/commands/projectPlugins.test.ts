import { describe, expect, it } from 'vitest';

import { placementOf, pluginText } from './projectPlugins';

import type { PluginDeclarationData } from '@plitzi/sdk-authoring';

const quoted = (words: string): string => `'${words}'`;

const rating: PluginDeclarationData = {
  type: 'rating',
  triggers: { onRate: { action: 'onRate' } },
  callbacks: {},
  content: { attributes: { value: 4, label: 'Rate it' }, definition: { label: 'Rating' } }
};

// An element of the project's own is said as one the SDK ships: how it is written, and what it takes, fires, answers.
describe('an element of the project’s own', () => {
  it('is written on a page as the custom element that hosts it, with every attribute at its default', () => {
    expect(placementOf(rating, 'about-rating')).toBe(
      `custom({ id: ${quoted('about-rating')}, renderType: ${quoted('rating')}, value: 4, label: ${quoted('Rate it')} })`
    );
  });

  it('is explained by what it takes, fires and answers', () => {
    expect(pluginText(rating).split('\n')).toEqual([
      'rating — an element of this project, in src/plugins/',
      `Written: custom({ id: ${quoted('rating')}, renderType: ${quoted('rating')}, value: 4, label: ${quoted('Rate it')} })`,
      'Attributes:',
      '  value = 4',
      '  label = "Rate it"',
      'Fires: onRate',
      'Answers: only what every element answers (setState, toggleState)'
    ]);
  });
});
