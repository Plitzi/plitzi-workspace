import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { pluginDeclarationOf, pluginTypesOf } from './declaration';

import type { DeclaredPlugin } from './declaration';
import type { ComponentDefinition } from '../types';

const plugin = (statics: Partial<DeclaredPlugin>): DeclaredPlugin => Object.assign(() => null, statics);

describe('a plugin declaration', () => {
  const tabs = plugin({
    content: {
      definition: { type: 'tabs', label: 'Tabs' },
      market: { icon: createElement('svg') },
      validate: () => true
    } as unknown as ComponentDefinition,
    version: '1.2.0',
    initialItems: ['tab'],
    plugins: { tab: plugin({ plugins: { tabLabel: plugin({}) } }) }
  });

  it('keeps what a page uses, and drops what only code or the builder could hold', () => {
    const declaration = pluginDeclarationOf(tabs);

    expect(declaration).toEqual({
      content: { definition: { type: 'tabs', label: 'Tabs' }, market: {} },
      version: '1.2.0',
      initialItems: ['tab'],
      plugins: { tab: { plugins: { tabLabel: {} } } }
    });
    expect(JSON.parse(JSON.stringify(declaration))).toEqual(declaration);
  });

  it('names every type it renders, its sub-plugins at any depth', () => {
    expect(pluginTypesOf('tabs', pluginDeclarationOf(tabs))).toEqual(['tabs', 'tab', 'tabLabel']);
  });
});
