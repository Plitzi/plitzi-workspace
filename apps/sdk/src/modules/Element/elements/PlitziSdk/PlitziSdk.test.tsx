import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { createEntityStore } from '@plitzi/nexus/entities';
import { ElementStoreContext } from '@plitzi/sdk-elements/Element/ElementStore';

import { PlitziSdk } from './PlitziSdk';

import type { ElementStoreEntry } from '@plitzi/sdk-elements/Element/ElementStore';

vi.mock('@modules/Element', () => ({ default: {} }));

vi.mock('@plitzi/sdk-elements/Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: { NetworkContext: createContext({}) }
  })
}));

describe('PlitziSdk', () => {
  it('should render successfully', () => {
    const store = createEntityStore<ElementStoreEntry>([
      {
        id: 'sdk',
        rootId: 'root',
        attributes: {},
        definition: { label: 'Button' },
        elementState: {},
        setElementState: () => true
      } as ElementStoreEntry
    ]);
    const { baseElement } = render(
      <ElementStoreContext value={store}>
        <PlitziSdk id="sdk" />
      </ElementStoreContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
