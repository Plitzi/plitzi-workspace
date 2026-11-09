import { render } from '@testing-library/react';
import { createContext, use } from 'react';
import { describe, expect, it } from 'vitest';

import { sharedContext } from './sharedContext';

describe('a context every copy of the runtime agrees on', () => {
  it('is the same context for every copy that asks for it by name', () => {
    expect(sharedContext('test.same', 0)).toBe(sharedContext('test.same', 0));
    expect(sharedContext('test.same', 0)).not.toBe(sharedContext('test.other', 0));
  });

  /** The builder's provider, a plugin's consumer: two copies, one context — the plugin reads the canvas it sits in. */
  it('lets a consumer read a provider another copy rendered', () => {
    const FromBuilder = sharedContext('test.element', 'none');
    const FromPlugin = sharedContext('test.element', 'none');
    const Plugin = () => <span>{use(FromPlugin)}</span>;

    const { container } = render(
      <FromBuilder value="board-1">
        <Plugin />
      </FromBuilder>
    );

    expect(container.textContent).toBe('board-1');
  });

  it('keeps the first default it was made with, as one context has one', () => {
    const first = sharedContext('test.default', 'first');
    sharedContext('test.default', 'second');
    const Reader = () => <span>{use(first)}</span>;

    expect(render(<Reader />).container.textContent).toBe('first');
    // Unlike a context of its own, which a second copy would have made: the very thing this exists to avoid.
    expect(createContext('x')).not.toBe(createContext('x'));
  });
});
