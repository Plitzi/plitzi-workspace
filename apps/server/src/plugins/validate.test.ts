import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertPluginSources, localSourcePath } from './validate';

const thisFile = fileURLToPath(import.meta.url);

describe('assertPluginSources', () => {
  it('passes when every local entry file exists', () => {
    expect(() => assertPluginSources({ ok: { js: thisFile, action: 'compile' } })).not.toThrow();
  });

  it('throws naming the plugin and the missing path', () => {
    expect(() => assertPluginSources({ plitziBuilder: { js: '/nope/client/index.ts', action: 'compile' } })).toThrow(
      /plitziBuilder: \/nope\/client\/index\.ts/u
    );
  });

  it('reports every missing entry at once', () => {
    const run = () =>
      assertPluginSources({
        one: { js: '/nope/one.ts' },
        two: { js: '/nope/two.ts' },
        three: { js: thisFile }
      });

    expect(run).toThrow(/one\.ts/u);
    expect(run).toThrow(/two\.ts/u);
    expect(run).not.toThrow(/three/u);
  });

  it('ignores remote entries and components, which have no local file', () => {
    expect(localSourcePath({ js: 'https://cdn.example.com/plugin.js' })).toBeNull();
    expect(localSourcePath({ component: () => null })).toBeNull();
    expect(() =>
      assertPluginSources({ remote: { js: 'https://cdn.example.com/plugin.js' }, inline: { component: () => null } })
    ).not.toThrow();
  });
});
