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

const renderTree = (children: ReactNode, settings?: Partial<PlitziServiceContextValue['settings']>) =>
  render(
    <StoreProvider value={{ schema: { flat: { el1: element } }, runtime: { sources: {} } }}>
      <PlitziServiceContext value={{ ...serviceValue, settings: { ...serviceValue.settings, ...settings } }}>
        <ComponentContext
          value={
            { components: { current: {} }, componentDefinitions: { current: {} } } as unknown as ComponentContextValue
          }
        >
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

  /**
   * The handle an end-to-end suite addresses this element by.
   *
   * Asserted separately from the golden snapshot because it is a CONTRACT, not an incidental detail of the markup:
   * a spec written against `handles.hero.cta` resolves to this attribute and nothing else, so losing it breaks
   * every suite downstream while the snapshot merely records that the markup changed.
   */
  it('carries the element id as a test handle', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(container.querySelector('[data-plitzi-el="el1"]')).not.toBeNull();
  });

  it('leaves the handle off when the deployment turns test attributes off', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />, {
      testAttributes: false
    });

    expect(container.querySelector('[data-plitzi-el]')).toBeNull();
  });

  it('resolves the content attribute into the rendered text', () => {
    const { getByText } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(getByText('Hello World')).toBeTruthy();
  });

  /**
   * A component's props are all there when its tree renders, so one an instance left out prints nothing. Any other
   * empty token is kept for a later pass that knows more, as it always was.
   */
  it('prints nothing for a prop the instance left out, and keeps a token that is still waiting', () => {
    const templated: Element = { ...element, attributes: { content: '{{ props.blurb }}|{{ redirect }}' } };
    const { container } = render(
      <StoreProvider value={{ schema: { flat: { el1: templated } }, runtime: { sources: { props: { blurb: null } } } }}>
        <PlitziServiceContext value={serviceValue}>
          <ComponentContext
            value={
              { components: { current: {} }, componentDefinitions: { current: {} } } as unknown as ComponentContextValue
            }
          >
            <Text internalProps={{ id: 'el1', rootId: 'root' }} />
          </ComponentContext>
        </PlitziServiceContext>
      </StoreProvider>
    );

    expect(container.querySelector('[data-plitzi-el="el1"]')?.textContent).toBe('|{{ redirect }}');
  });

  it('applies the element base style selector class to the root node', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(container.querySelector('.plitzi-component__text')).not.toBeNull();
    expect(container.querySelector('.el1-base')).not.toBeNull();
  });
});
