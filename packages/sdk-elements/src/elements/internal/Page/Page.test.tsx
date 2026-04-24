import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';

import { Page } from './Page';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      InteractionsContext: createContext({
        useInteractions: () => ({}),
        interactionsManager: { interactionTrigger: () => {} }
      }),
      NavigationContext: createContext({})
    }
  })
}));

describe('Page Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={{ id: '', rootId: '', plitziJsxSkipHOC: true }}>
        <Page />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
