// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PluginsViewer from './PluginsViewer';

/**
 * The two registers as the viewer reads them — an element's `origin` and `version`, a bundle's manifest and settings —
 * and nothing else of what a registered plugin carries.
 */
vi.mock('@plitzi/sdk-shared/elements', async () => {
  const { createContext } = await import('react');

  return {
    ComponentContext: createContext({
      components: {
        current: {
          container: { origin: 'local' },
          text: {},
          'booking-calendar': { origin: 'local-custom' },
          'price-table': { origin: 'remote', version: '1.0.0' }
        }
      }
    })
  };
});

vi.mock('@plitzi/sdk-shared/plugins/react', async () => {
  const { createContext } = await import('react');

  return {
    PluginsContext: createContext({
      plugins: {
        'price-table': { manifest: { version: '1.2.0', author: 'Ana' }, settings: { currency: 'EUR' } },
        'map-embed': { manifest: { version: '' }, settings: {} }
      }
    })
  };
});

const listed = () =>
  screen.getAllByText(/^(booking-calendar|price-table|map-embed|container|text)$/).map(n => n.textContent);

describe('PluginsViewer', () => {
  it('lists the plugins of both registers and none of the SDK’s own elements', () => {
    render(<PluginsViewer />);

    expect(listed()).toEqual(['booking-calendar', 'price-table', 'map-embed']);
    expect(screen.getByText('Select a plugin')).not.toBeNull();
  });

  it('reads a version off the manifest first, and says where one with none comes from', () => {
    render(<PluginsViewer />);

    expect(screen.getByText('1.2.0')).not.toBeNull();
    expect(screen.queryByText('1.0.0')).toBeNull();
    expect(screen.getByText('Shipped with this space')).not.toBeNull();
    expect(screen.getByText('Installed')).not.toBeNull();
  });

  it('shows a plugin’s author and settings once it is picked', () => {
    render(<PluginsViewer />);
    fireEvent.click(screen.getByText('price-table'));

    expect(screen.queryByText('Select a plugin')).toBeNull();
    expect(screen.getByText('Ana')).not.toBeNull();
    expect(screen.getByText(/currency/)).not.toBeNull();
  });

  it('says a plugin with nothing set has no settings', () => {
    render(<PluginsViewer />);
    fireEvent.click(screen.getByText('booking-calendar'));

    expect(screen.getByText('No settings')).not.toBeNull();
    expect(screen.getByText(/A file this deployment hands the server/)).not.toBeNull();
  });
});
