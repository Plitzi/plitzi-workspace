import { describe, expect, it } from 'vitest';

import { GLOBAL_SOURCES, resolveSource } from './index';

import type { SourceIndex } from './index';

const index: SourceIndex = new Map([
  ['posts', 'apiContainer'],
  // A form publishes under `apiContainer`, not under `form`. That is the whole reason this resolution exists.
  ['signup', 'apiContainer'],
  ['postList', 'list']
]);

const resolve = (source: string): string => resolveSource(source, index, 'Element "text"');

describe('resolveSource', () => {
  it('fills in the prefix the element publishes under', () => {
    expect(resolve('posts.title')).toBe('apiContainer_posts.title');
    expect(resolve('postList.item.name')).toBe('list_postList.item.name');
  });

  it('fills it in for an element whose source name is not its own type', () => {
    expect(resolve('signup.values')).toBe('apiContainer_signup.values');
  });

  it('resolves a bare idRef with no field', () => {
    expect(resolve('posts')).toBe('apiContainer_posts');
  });

  it('leaves the globals as they are', () => {
    for (const global of GLOBAL_SOURCES) {
      expect(resolve(`${global}.something`)).toBe(`${global}.something`);
    }
  });

  it('leaves a source already written in full alone', () => {
    expect(resolve('apiContainer_posts.title')).toBe('apiContainer_posts.title');
  });

  /**
   * The trap this closes. `form_signup` names an element that exists, spelled the way its own type reads, and
   * resolves to nothing — a form registers as `apiContainer_signup`. Before the catalog reached here it was
   * accepted, and the element bound to it simply rendered its placeholder forever.
   */
  it('refuses a prefix that is not what the element publishes', () => {
    expect(() => resolve('form_signup.values')).toThrow(/publishes its source as "apiContainer_signup"/);
  });

  it('refuses a name nothing answers to, and suggests the one meant', () => {
    expect(() => resolve('psots.title')).toThrow(/nothing in this space answers to "psots".*did you mean "posts"/);
    expect(() => resolve('apiContainer_psots.title')).toThrow(/no element answers to the idRef "psots"/);
  });
});
