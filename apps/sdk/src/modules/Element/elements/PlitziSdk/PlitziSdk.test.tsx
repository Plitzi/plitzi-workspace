import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { ElementContext } from '@plitzi/sdk-elements/Element/ElementContext';

import { PlitziSdk } from './PlitziSdk';

import type { ElementContextValue } from '@plitzi/sdk-elements/Element/ElementContext';

vi.mock('@modules/Element', () => ({ default: {} }));

vi.mock('@plitzi/sdk-elements/Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: 'root' },
    contexts: { NetworkContext: createContext({}) }
  })
}));

describe('PlitziSdk', () => {
  it('should render successfully', () => {
    const value = {
      id: 'sdk',
      rootId: 'root',
      attributes: {},
      definition: { label: 'Button' },
      elementState: {},
      setElementState: () => true
    } as ElementContextValue;
    const { baseElement } = render(
      <ElementContext value={value}>
        <PlitziSdk />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
