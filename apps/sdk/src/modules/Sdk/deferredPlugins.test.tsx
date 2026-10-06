import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { deferredPlugin } from './deferredPlugins';

import type { PluginComponent } from './deferredPlugins';
import type { ComponentDefinition } from '@plitzi/sdk-shared';

const content = { definition: { type: 'tabs', label: 'Tabs' } } as unknown as ComponentDefinition;

const tabs = (): PluginComponent =>
  Object.assign(({ label }: { label?: string }) => <p>{`tabs ${label ?? ''}`}</p>, {
    plugins: { tab: Object.assign(() => <p>tab</p>, {}) }
  });

// The stylesheet a test page cannot fetch: jsdom never fires `load` on a link, so it is fired here.
const stylesheetLoaded = () => {
  const link = document.head.querySelector<HTMLLinkElement>('link[data-plitzi-plugin="tabs"]');
  link?.dispatchEvent(new Event('load'));

  return link;
};

describe('deferredPlugin', () => {
  it('declares what the plugin does before its code is loaded, sub-plugins included', () => {
    const load = vi.fn(() => Promise.resolve({ default: tabs() }));
    const standIn = deferredPlugin('tabs', {
      load,
      declaration: { content, version: '1.0.0', initialItems: ['tab'], plugins: { tab: {} } }
    });

    expect({ ...standIn }).toMatchObject({ content, version: '1.0.0', initialItems: ['tab'] });
    expect(Object.keys(standIn.plugins ?? {})).toEqual(['tab']);
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the code and the stylesheet once, when first drawn, and draws only after both', async () => {
    const load = vi.fn(() => Promise.resolve({ default: tabs() }));
    const standIn = deferredPlugin('tabs', { load, css: '/tabs.css', declaration: { plugins: { tab: {} } } });
    const Tabs = standIn;
    const Tab = standIn.plugins?.tab ?? (() => null);

    render(
      <>
        <Tabs label="a" />
        <Tab />
      </>
    );

    expect(screen.queryByText('tabs a')).toBeNull();
    expect(stylesheetLoaded()?.getAttribute('href')).toBe('/tabs.css');
    expect(await screen.findByText('tabs a')).toBeTruthy();
    expect(await screen.findByText('tab')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    expect(document.head.querySelectorAll('link[data-plitzi-plugin="tabs"]')).toHaveLength(1);
  });
});
