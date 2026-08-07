import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import useRenderSettings, { DEFAULT_RENDER_SETTINGS, useRenderOverride } from './renderSettings';

import type { RenderSettings } from '../types';
import type { ReactNode } from 'react';

const Probe = () => <span data-testid="settings">{JSON.stringify(useRenderSettings())}</span>;

const renderWith = (value: object, children: ReactNode = <Probe />) => {
  const { getByTestId } = render(<StoreProvider value={value}>{children}</StoreProvider>);

  return JSON.parse(getByTestId('settings').textContent) as Required<RenderSettings>;
};

describe('useRenderSettings', () => {
  it('falls back to the shared floor when nothing seeded the slice', () => {
    expect(renderWith({})).toEqual(DEFAULT_RENDER_SETTINGS);
  });

  it('fills in only what the surface left out', () => {
    const seen = renderWith({ render: { previewMode: false, renderMode: 'raw' } });

    expect(seen).toEqual({ ...DEFAULT_RENDER_SETTINGS, previewMode: false, renderMode: 'raw' });
  });

  it('is shadowed — not merged — by a nested scope that seeds the slice', () => {
    const seen = renderWith(
      { render: { previewMode: false, debugMode: true, renderMode: 'raw' } },
      <StoreProvider value={{ render: { previewMode: true } }}>
        <Probe />
      </StoreProvider>
    );

    // A scope owning `render` cuts the whole slice off from the parent: what the override left out is gone, not
    // inherited. This is why an override has to be built with `useRenderOverride`.
    expect(seen).toEqual({ ...DEFAULT_RENDER_SETTINGS, previewMode: true });
  });

  it('useRenderOverride carries the surrounding settings across the scope', () => {
    const overrides = { previewMode: true };
    const Override = () => <StoreProvider value={useRenderOverride(overrides)}>{<Probe />}</StoreProvider>;

    const seen = renderWith({ render: { previewMode: false, debugMode: true, renderMode: 'raw' } }, <Override />);

    // The builder's preview pane: preview whatever the editor's toggle says, everything else still the editor's.
    expect(seen).toEqual({ ...DEFAULT_RENDER_SETTINGS, previewMode: true, debugMode: true, renderMode: 'raw' });
  });
});
