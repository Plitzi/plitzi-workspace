import { render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useFocusInteractions from './useFocusInteractions';

import type { RefObject } from 'react';

// A composer sent with its Send key could not give its field the focus back: no step moved focus, only Enter kept it.
describe("an element's focus step", () => {
  const focusOf = (node: HTMLElement | null) => {
    const nodeRef: RefObject<HTMLElement | null> = { current: node };
    const { result } = renderHook(() => useFocusInteractions({ label: 'Compose', nodeRef }));

    const registered = result.current.focus.callback;
    if (!registered) {
      throw new Error('nothing is registered for focus');
    }

    return () => registered({});
  };

  it('focuses the first field inside a wrapper, or the element itself when it takes focus', () => {
    const { container } = render(
      <div>
        <div id="wrapper">
          <span>label</span>
          <input id="field" />
        </div>
        <button id="send">Send</button>
      </div>
    );
    focusOf(container.querySelector('#wrapper'))();
    expect(document.activeElement?.id).toBe('field');

    focusOf(container.querySelector('#send'))();
    expect(document.activeElement?.id).toBe('send');
  });

  it('does nothing where there is no node', () => {
    expect(() => focusOf(null)()).not.toThrow();
  });
});
