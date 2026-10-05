import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { createHotPlugins } from './hotPlugins';

import type { ComponentPluginFC } from '@plitzi/sdk-shared';

const declaration = { triggers: { onPick: { action: 'onPick' } }, content: { attributes: { label: '' } } };

/** A plugin as `index.ts` makes one: its component with its declaration assigned onto it. */
const plugin = (text: string, own: Record<string, unknown> = declaration) =>
  Object.assign(({ label }: { label?: string }) => <p>{`${text} ${label ?? ''}`}</p>, own) as ComponentPluginFC<{
    label?: string;
  }>;

describe('createHotPlugins', () => {
  it('registers a proxy carrying the plugin’s declaration, and renders the plugin through it', () => {
    const original = plugin('v1');
    const { plugins } = createHotPlugins({ card: { component: original } });
    const Card = plugins.card.component;

    expect(Card).not.toBe(original);
    expect({ ...Card }).toMatchObject(declaration);
    expect(render(<Card label="a" />).container.textContent).toBe('v1 a');
  });

  it('swaps the plugin where it is drawn, and leaves what is around it as it was', () => {
    const { plugins, replace } = createHotPlugins({ card: { component: plugin('v1') } });
    const Card = plugins.card.component;
    let bump: () => void = () => undefined;
    const Page = () => {
      const [count, setCount] = useState(0);
      bump = () => setCount(value => value + 1);

      return (
        <div>
          <span>{count}</span>
          <Card label="a" />
        </div>
      );
    };
    const { container } = render(<Page />);
    act(() => bump());

    let swapped = false;
    act(() => {
      swapped = replace('card', plugin('v2'));
    });

    expect(swapped).toBe(true);
    expect(container.textContent).toBe('1v2 a');
  });

  it('will not swap a plugin whose declaration changed, nor one the page never registered', () => {
    const { replace } = createHotPlugins({ card: { component: plugin('v1') } });

    expect(replace('card', plugin('v2', { ...declaration, triggers: { onDrop: { action: 'onDrop' } } }))).toBe(false);
    expect(replace('map', plugin('v2'))).toBe(false);
  });
});
