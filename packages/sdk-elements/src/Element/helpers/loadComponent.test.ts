import { beforeEach, describe, expect, it, vi } from 'vitest';

import loadComponent from './loadComponent';
import NotFound from '../../elements/internal/NotFound/NotFound';

import type { PlitziModule } from './elementUtils';
import type { ComponentPlugin } from '@plitzi/sdk-shared';

const generatePluginModule = vi.hoisted(() => vi.fn<(url: string) => Promise<PlitziModule | undefined>>());

vi.mock('./elementUtils', () => ({ generatePluginModule }));

const plugin = (type?: string): PlitziModule => {
  const component = Object.assign(() => null, { type }) as unknown as ComponentPlugin;

  return { default: component, version: '1.2.3', initialItems: ['child'] };
};

/** `plitziJsxSkipHOC` so what comes back is the module's own component, not a `withElement` wrapper around it. */
const load = (url: string, register = vi.fn()) => loadComponent(url, register, true, true)();

describe('loadComponent', () => {
  beforeEach(() => {
    generatePluginModule.mockReset();
  });

  /** Nothing about an address says which format it serves, so no file name may decide how it is loaded. */
  it('loads a plugin by its URL alone, whatever the file is called', async () => {
    generatePluginModule.mockResolvedValue(plugin('typed'));

    await load('https://cdn.example.com/plugins/typed');
    await load('https://cdn.example.com/plugins/typed.js');

    expect(generatePluginModule.mock.calls).toEqual([
      ['https://cdn.example.com/plugins/typed'],
      ['https://cdn.example.com/plugins/typed.js']
    ]);
  });

  it('registers what it loaded as a remote component', async () => {
    generatePluginModule.mockResolvedValue(plugin('typed'));
    const register = vi.fn();

    const { default: component } = await load('https://cdn.example.com/plugins/typed.mjs', register);

    expect(register).toHaveBeenCalledWith(component);
    expect({
      type: component.type,
      origin: component.origin,
      version: component.version,
      initialItems: component.initialItems
    }).toEqual({ type: 'typed', origin: 'remote', version: '1.2.3', initialItems: ['child'] });
  });

  it('draws the not-found element for a module that could not be loaded, or names no type', async () => {
    generatePluginModule.mockResolvedValueOnce(undefined);
    expect((await load('https://cdn.example.com/plugins/missing.mjs')).default).toBe(NotFound);

    generatePluginModule.mockResolvedValueOnce(plugin());
    expect((await load('https://cdn.example.com/plugins/untyped.mjs')).default).toBe(NotFound);
  });

  it('fetches a URL once while a load of it is already in flight', async () => {
    generatePluginModule.mockResolvedValue(plugin('typed'));

    await Promise.all([
      load('https://cdn.example.com/plugins/typed.mjs'),
      load('https://cdn.example.com/plugins/typed.mjs')
    ]);

    expect(generatePluginModule).toHaveBeenCalledTimes(1);
  });
});
