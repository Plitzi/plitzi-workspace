import { fireEvent, render, waitFor } from '@testing-library/react';
import { createContext, useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import ElementContext from './ElementContext';
import RootElement from './RootElement';

import type { ElementContextValue } from './ElementContext';
import type { ElementDefinition } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

type ServiceContext = {
  settings: { previewMode?: boolean; debugMode?: boolean };
  root: { baseElementId: string };
  contexts: Record<string, unknown>;
};

let serviceContext: ServiceContext;

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({ default: () => serviceContext }));

const interactionsManager = { interactionTrigger: vi.fn() };
const useInteractions = vi.fn();
const InteractionsContext = createContext({ interactionsManager, useInteractions });

const fullContext = (overrides: Partial<ElementContextValue> = {}): ElementContextValue => ({
  id: 'el1',
  rootId: 'root',
  visible: true,
  traceId: 'el1',
  className: 'ctxClass',
  attributes: {},
  definition: { rootId: 'root', label: 'Lbl', type: 'text', styleSelectors: { base: 'baseCls' } },
  plitziElementLayout: undefined,
  style: { color: 'red' },
  elementState: {},
  setElementState: vi.fn(),
  ...overrides
});

const renderRoot = (
  contextValue: ElementContextValue | ElementContextValue<'skipHOC'>,
  rootProps: Record<string, unknown> = {},
  children: ReactNode = 'child'
) => {
  return render(
    <StoreProvider value={{ runtime: { sources: {} } }}>
      <ElementContext value={contextValue as ElementContextValue}>
        <RootElement {...rootProps}>{children}</RootElement>
      </ElementContext>
    </StoreProvider>
  );
};

describe('RootElement', () => {
  beforeEach(() => {
    serviceContext = {
      settings: { previewMode: true, debugMode: false },
      root: { baseElementId: 'root' },
      contexts: {}
    };
    vi.clearAllMocks();
  });

  it('renders a plain tag with children under plitziJsxSkipHOC', () => {
    const { container, getByText } = renderRoot(
      { id: 'el1', rootId: 'root', visible: true, traceId: 'el1', plitziJsxSkipHOC: true },
      { tag: 'section', className: 'cls' }
    );

    const node = container.querySelector('section.cls');

    expect(node).not.toBeNull();
    expect(getByText('child')).toBeTruthy();
    expect(node?.getAttribute('data-id')).toBeNull();
  });

  describe('without InteractionsContext', () => {
    it('omits debug params in preview mode', () => {
      const { container } = renderRoot(fullContext());
      const node = container.querySelector('div');

      expect(node?.getAttribute('data-id')).toBeNull();
      expect(node?.getAttribute('style')).toContain('color: red');
    });

    it('emits debug params when debugMode is on', () => {
      serviceContext.settings.debugMode = true;
      const { container } = renderRoot(fullContext());
      const node = container.querySelector('[data-id="el1"]');

      expect(node).not.toBeNull();
      expect(node?.getAttribute('data-type')).toBe('text');
      expect(node?.getAttribute('data-name')).toBe('Lbl');
      expect(node?.getAttribute('data-root-id')).toBe('root');
    });

    it('emits a server marker for server-runtime elements', () => {
      const { container } = renderRoot(
        fullContext({
          definition: {
            rootId: 'root',
            label: 'Lbl',
            type: 'text',
            runtime: 'server',
            styleSelectors: { base: 'baseCls' }
          }
        })
      );

      expect(container.querySelector('[data-rsc-id="el1"]')).not.toBeNull();
    });

    it('merges the context style with the parsed style prop', () => {
      const { container } = renderRoot(fullContext(), { style: 'background:blue' });
      const style = container.querySelector('div')?.getAttribute('style') ?? '';

      expect(style).toContain('color: red');
      expect(style).toContain('background: blue');
    });
  });

  describe('with InteractionsContext', () => {
    beforeEach(() => {
      serviceContext.contexts.InteractionsContext = InteractionsContext;
    });

    it('wires interactions and merges context + internal class names', () => {
      const { container } = renderRoot(fullContext(), { className: 'rootCls' });
      const node = container.querySelector('div');

      expect(useInteractions).toHaveBeenCalledWith(expect.objectContaining({ id: 'el1', interactions: undefined }));
      expect(node?.className).toContain('ctxClass');
      expect(node?.className).toContain('baseCls');
      expect(node?.className).toContain('rootCls');
    });

    // The global sources register what a flow can call from effects of their own, above every element — and React
    // runs a parent's effect after its children's. Fired inside the commit, a page's `onLoad` reached a manager with
    // no `state.setState` yet on the first load.
    it('fires onLoad only after the sources above it have registered, including when the element is a page', async () => {
      let registered = false;
      const registeredWhenFired: boolean[] = [];
      interactionsManager.interactionTrigger.mockImplementation(() => {
        registeredWhenFired.push(registered);
      });
      const Source = ({ children }: { children: ReactNode }) => {
        useEffect(() => {
          registered = true;
        }, []);

        return children;
      };

      render(
        <StoreProvider value={{ runtime: { sources: {} } }}>
          <Source>
            <ElementContext
              value={fullContext({
                definition: {
                  rootId: 'root',
                  label: 'Home',
                  type: 'page',
                  styleSelectors: { base: 'baseCls' },
                  interactions: {
                    load: {
                      id: 'load',
                      title: 'On Load',
                      type: 'trigger',
                      action: 'onLoad',
                      params: {},
                      preview: {},
                      elementId: 'el1',
                      beforeNode: '',
                      afterNode: '',
                      flowId: 'load',
                      enabled: true
                    }
                  }
                }
              })}
            >
              <RootElement>child</RootElement>
            </ElementContext>
          </Source>
        </StoreProvider>
      );

      await waitFor(() => expect(interactionsManager.interactionTrigger).toHaveBeenCalledWith('el1', 'onLoad', {}));
      expect(registeredWhenFired).toEqual([true]);
    });

    describe('a click inside an element that is clickable too', () => {
      const clickable = (id: string, propagateEvent: boolean): ElementDefinition => ({
        rootId: 'root',
        label: id,
        type: 'container',
        styleSelectors: { base: `${id}Cls` },
        interactions: {
          [`${id}-click`]: {
            id: `${id}-click`,
            title: 'On Click',
            type: 'trigger',
            action: 'onClick',
            params: { propagateEvent },
            preview: {},
            elementId: id,
            beforeNode: '',
            afterNode: '',
            flowId: `${id}-click`,
            enabled: true
          }
        }
      });

      const renderNested = (innerPropagates: boolean, ownClick = vi.fn()) =>
        render(
          <StoreProvider value={{ runtime: { sources: {} } }}>
            <ElementContext value={fullContext({ id: 'card', traceId: 'card', definition: clickable('card', false) })}>
              <RootElement onClick={ownClick}>
                <ElementContext
                  value={fullContext({
                    id: 'button',
                    traceId: 'button',
                    definition: clickable('button', innerPropagates)
                  })}
                >
                  <RootElement>press</RootElement>
                </ElementContext>
              </RootElement>
            </ElementContext>
          </StoreProvider>
        );

      const clicked = () =>
        interactionsManager.interactionTrigger.mock.calls
          .filter(([, action]) => action === 'onClick')
          .map(([id]) => id as string);

      // "Propagate Event", off by default, is what the builder offers on every click trigger. It used to decide only
      // `preventDefault`, so the card's flow ran after the button's on every click — the two opposite actions of a
      // card with a delete button in it, one after the other.
      it('runs only the inner flow when the inner trigger does not propagate', () => {
        const { getByText } = renderNested(false);

        fireEvent.click(getByText('press'));

        expect(clicked()).toEqual(['button']);
      });

      it('runs both when the inner trigger propagates', () => {
        const { getByText } = renderNested(true);

        fireEvent.click(getByText('press'));

        expect(clicked()).toEqual(['button', 'card']);
      });

      // The DOM event is not stopped: a component's own handler — a dropdown opening from a click inside it — still
      // sees the click, and so does anything listening above the space.
      it('leaves the event to the handler the outer element has of its own', () => {
        const ownClick = vi.fn();
        const { getByText } = renderNested(false, ownClick);

        fireEvent.click(getByText('press'));

        expect(ownClick).toHaveBeenCalledTimes(1);
      });
    });
  });
});
