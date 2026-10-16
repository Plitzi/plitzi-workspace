import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ElementContext } from '@plitzi/sdk-elements';

import { PlitziSdk } from './PlitziSdk';

import type { ElementContextValue } from '@plitzi/sdk-elements';

vi.mock('@modules/Element', () => ({ default: {} }));

vi.mock('@plitzi/sdk-elements', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-elements')>()),
  withElement: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({
    settings: { previewMode: true },
    root: { baseElementId: 'root' }
  })
}));

vi.mock('@plitzi/sdk-shared/network', async importOriginal => {
  const { createContext } = await import('react');

  return {
    ...(await importOriginal<typeof import('@plitzi/sdk-shared/network')>()),
    NetworkContext: createContext({})
  };
});

describe('PlitziSdk', () => {
  it('should render successfully', () => {
    const value = {
      id: 'sdk',
      rootId: 'root',
      visible: true,
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
