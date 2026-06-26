import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { PlitziServiceContext } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import Text from '../elements/basic/Text/Text';

import type { ComponentContextValue, Element, PlitziServiceContextValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

vi.mock('@plitzi/sdk-event-bridge/hooks/useEventBridge', () => ({ default: () => undefined }));

// PluginRemote pulls the remote loader → Component registry → package index, a circular chain that breaks module
// init order under vitest. Local elements never use it, so stub it to keep the pipeline graph acyclic for the test.
vi.mock('./PluginRemote', () => ({ default: () => null }));

const InteractionsContext = createContext({
  interactionsManager: { interactionTrigger: () => undefined },
  useInteractions: () => ({})
});
const PluginsContext = createContext({ plugins: {} });

const serviceValue = {
  settings: { previewMode: true, debugMode: false },
  root: { baseElementId: 'root' },
  contexts: { InteractionsContext, PluginsContext, BuilderContext: undefined }
} as unknown as PlitziServiceContextValue;

const element: Element = {
  id: 'el1',
  attributes: { content: 'Hello World' },
  definition: { rootId: 'root', label: 'My Text', type: 'text', styleSelectors: { base: 'el1-base' } }
};

const renderTree = (children: ReactNode) =>
  render(
    <StoreProvider value={{ schema: { flat: { el1: element } }, runtime: { sources: {} } }}>
      <PlitziServiceContext value={serviceValue}>
        <ComponentContext value={{ components: { current: {} } } as unknown as ComponentContextValue}>
          {children}
        </ComponentContext>
      </PlitziServiceContext>
    </StoreProvider>
  );

describe('Element pipeline (golden)', () => {
  it('renders a Text element through withElement + RootElement', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(container.innerHTML).toMatchSnapshot();
  });

  it('resolves the content attribute into the rendered text', () => {
    const { getByText } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(getByText('Hello World')).toBeTruthy();
  });

  it('applies the element base style selector class to the root node', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(container.querySelector('.plitzi-component__text')).not.toBeNull();
    expect(container.querySelector('.el1-base')).not.toBeNull();
  });
});
