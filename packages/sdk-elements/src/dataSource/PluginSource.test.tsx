import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider, createStoreHook } from '@plitzi/nexus/react';

import PluginSource from './PluginSource';

vi.mock('../Element/hooks/useElement', () => ({ default: () => ({ id: 'deck', definition: { label: 'Deck' } }) }));

const declaration = { type: 'player', sourceType: 'player' };

const Reader = () => {
  const { useStore } = createStoreHook<{ runtime?: { sources?: { player_deck?: { track?: string } } } }>();
  const [track = 'nothing'] = useStore('runtime.sources.player_deck.track');

  return <span>{track}</span>;
};

describe('PluginSource', () => {
  it('publishes its data to what is inside it, under `<sourceType>_<id>`', () => {
    render(
      <StoreProvider value={{ runtime: { sources: {} } }}>
        <PluginSource declaration={declaration} data={{ track: 'Blue in Green', playing: true }}>
          <Reader />
        </PluginSource>
      </StoreProvider>
    );

    expect(screen.getByText('Blue in Green')).toBeTruthy();
  });

  it('reaches nothing outside it', () => {
    render(
      <StoreProvider value={{ runtime: { sources: {} } }}>
        <PluginSource declaration={declaration} data={{ track: 'Blue in Green' }} />
        <Reader />
      </StoreProvider>
    );

    expect(screen.getByText('nothing')).toBeTruthy();
  });
});
