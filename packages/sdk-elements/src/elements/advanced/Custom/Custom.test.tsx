import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import { Custom } from './Custom';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

import type { ComponentContextValue, ComponentDefinition } from '@plitzi/sdk-shared';

/** A plugin the space installed: `sequencer` its main element, `jamDisc` another it packs. */
const installed = vi.hoisted(() => ({
  sequencer: {
    subPlugins: ['jamDisc'],
    assets: [{ id: 'main', type: 'script', isMain: true, params: { src: 'https://cdn/sequencer.mjs' } }]
  }
}));

vi.mock('../../../Element/PluginRemote', () => ({
  default: ({ url, type }: { url: string; type?: string }) => <span data-remote={url} data-type={type} />
}));

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {
      PluginsContext: createContext({
        plugins: installed as unknown as Record<string, ComponentDefinition>,
        registerCustomAssets: () => undefined,
        unregisterCustomAssets: () => undefined
      })
    }
  })
}));

const renderCustom = (renderType?: string) =>
  render(
    <ComponentContext value={{ components: { current: {} } } as ComponentContextValue}>
      <ElementContext value={skipHocEntry()}>
        <Custom renderType={renderType} />
      </ElementContext>
    </ComponentContext>
  );

describe('Custom Tests', () => {
  it('Render Component', () => {
    const { baseElement } = renderCustom();

    expect(baseElement).toBeTruthy();
  });

  it('loads a type the page has not registered from the installed plugin that packs it', () => {
    const { container } = renderCustom('jamDisc');
    const remote = container.querySelector('[data-remote]');

    expect(remote?.getAttribute('data-remote')).toBe('https://cdn/sequencer.mjs');
    expect(remote?.getAttribute('data-type')).toBe('jamDisc');
    expect(container.textContent).not.toContain('Not Found');
  });

  it('still says a type no installed plugin declares is not found', () => {
    const { container } = renderCustom('ghost');

    expect(container.querySelector('[data-remote]')).toBeNull();
    expect(container.textContent).toContain('Custom Component ghost Not Found');
  });
});
