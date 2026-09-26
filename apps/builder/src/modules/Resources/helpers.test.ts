import { describe, expect, it } from 'vitest';

import { mainPluginOf, pluginUsage } from './helpers';

import type { ComponentDefinition, Schema } from '@plitzi/sdk-shared';

// Only what the lookups read of an installed plugin; the full type describes far more.
const plugin = (type: string, isMain: boolean, subPlugins: string[] = []) =>
  ({ type, isMain, subPlugins }) as unknown as ComponentDefinition;

const element = (id: string, type: string, rootId: string, name?: string): Schema['flat'][string] => ({
  id,
  attributes: name ? { name } : {},
  definition: { label: id, type, rootId, parentId: undefined, items: [], styleSelectors: { base: '' } }
});

const flat: Schema['flat'] = {
  home: element('home', 'page', 'home', 'Home'),
  nav: element('nav', 'navbar', 'home'),
  item: element('item', 'navbarItem', 'home'),
  pricing: element('pricing', 'page', 'pricing', 'Pricing'),
  table: element('table', 'container', 'pricing'),
  footerNav: element('footerNav', 'navbar', 'pricing')
};

describe('Resources helpers', () => {
  it('finds the main plugin a resource installed, not one it ships inside', () => {
    const plugins = { navbar: plugin('navbar', true, ['navbarItem']), navbarItem: plugin('navbarItem', false) };

    expect(mainPluginOf(plugins, 'navbar')?.type).toBe('navbar');
    expect(mainPluginOf(plugins, 'navbarItem')).toBeUndefined();
  });

  // What a removal warns about: the plugin's own elements and those of the plugins it brings, named by page.
  it('counts where a plugin is placed, its sub-plugins included, page by page', () => {
    expect(pluginUsage(flat, plugin('navbar', true, ['navbarItem']))).toEqual([
      { page: 'Home', elements: 2 },
      { page: 'Pricing', elements: 1 }
    ]);
    expect(pluginUsage(flat, plugin('weather', true))).toEqual([]);
  });
});
