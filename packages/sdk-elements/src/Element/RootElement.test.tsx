import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { ElementContext } from './ElementContext';
import RootElement from './RootElement';

import type { ElementContextValue } from './ElementContext';
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
      { id: 'el1', rootId: 'root', plitziJsxSkipHOC: true },
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
  });
});
