import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Dropdown, withOpen } from './Dropdown';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { ElementContextValue } from '../../../Element/ElementContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    utils: { getWindow: () => undefined }
  })
}));

/** What the dropdown hands its root: the callbacks a step reaches it by. */
const handed: { callbacks?: Record<string, InteractionCallback> } = {};
vi.mock('../../../Element/RootElement', () => ({
  default: ({
    interactionCallbacks,
    children
  }: {
    interactionCallbacks?: Record<string, InteractionCallback>;
    children?: unknown;
  }) => {
    handed.callbacks = interactionCallbacks;

    return <div>{children as never}</div>;
  }
}));

// encore-4: a pick closed its menu only by `updateElement` on `openPopup`, found by reading the store.
describe('a dropdown opened and closed by a step', () => {
  it('answers openDropdown, closeDropdown and toggleDropdown by its open state', () => {
    let written = 0;
    const entry: ElementContextValue = elementEntry('people', {
      setElementState: () => {
        written += 1;

        return true;
      }
    });
    render(
      <ElementContext value={entry}>
        <Dropdown openPopup />
      </ElementContext>
    );

    const callbacks = handed.callbacks ?? {};
    expect(Object.keys(callbacks)).toEqual(['openDropdown', 'closeDropdown', 'toggleDropdown']);
    void callbacks.closeDropdown.callback?.({});
    void callbacks.toggleDropdown.callback?.({});
    void callbacks.openDropdown.callback?.({});

    expect(written).toBe(3);
    expect(withOpen(false)({ hovered: true })).toEqual({ hovered: true, openPopup: false });
    expect(withOpen(true)({})).toEqual({ openPopup: true });
  });
});
