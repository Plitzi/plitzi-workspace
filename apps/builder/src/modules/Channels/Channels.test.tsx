import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBridge, EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import Channels from './Channels';
import { checkChannels, declarationOf, draftOf, NEW_CHANNEL } from './helpers';

import type { ChannelDeclarations } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));

const eventBridge = new EventBridge();
const emit = vi.spyOn(eventBridge, 'emit').mockResolvedValue([]);

const renderWith = (channels: ChannelDeclarations) => {
  // Mocked with the one value this page reads; the hook's type is the whole store's, which a test has none of.
  vi.mocked(useBuilderStore).mockReturnValue([[channels]] as unknown as ReturnType<typeof useBuilderStore>);

  return render(
    <EventBridgeContext value={{ eventBridge }}>
      <Channels />
    </EventBridgeContext>
  );
};

const field = (container: HTMLElement, name: string): HTMLInputElement | HTMLSelectElement => {
  const found = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  if (!found) {
    throw new Error(`No field named ${name}`);
  }

  return found;
};

beforeEach(() => {
  emit.mockClear();
});

describe('a channel, drafted', () => {
  it('writes only what differs from the defaults, and reads back what it wrote', () => {
    const declaration = declarationOf({ ...NEW_CHANNEL, publish: 'server', retain: true, messagesPerSecond: '10' });

    expect(declaration).toEqual({ access: { mode: 'public' }, publish: 'server', retain: true, messagesPerSecond: 10 });
    expect(declarationOf(draftOf(declaration))).toEqual(declaration);
  });

  it('refuses what the server would, with every problem by its pattern', () => {
    const checked = checkChannels({
      'board:{id}': { ...NEW_CHANNEL, retain: true },
      'bad pattern': NEW_CHANNEL,
      staff: { ...NEW_CHANNEL, mode: 'role' }
    });

    expect(checked.ok).toBe(false);
    expect(checked.ok ? {} : Object.keys(checked.problems).sort()).toEqual(['bad pattern', 'board:{id}', 'staff']);
  });
});

describe('Settings → Realtime', () => {
  it('adds a channel, and saves the space’s channels', () => {
    const { container, getByText } = renderWith({});

    fireEvent.change(field(container, 'newChannel'), { target: { value: 'tables' } });
    fireEvent.click(getByText('Add channel'));

    expect(emit).toHaveBeenCalledWith(
      'main',
      'schemaUpdateSettings',
      { tables: { access: { mode: 'public' } } },
      'channels'
    );
  });

  it('says what is wrong and saves nothing while a channel would be refused', () => {
    const { container, getByRole } = renderWith({ tables: { access: { mode: 'public' } } });

    fireEvent.click(field(container, 'tables-retain'));

    expect(emit).not.toHaveBeenCalled();
    expect(getByRole('alert').textContent).toContain('publish: "server"');

    fireEvent.change(field(container, 'tables-publish'), { target: { value: 'server' } });

    expect(emit).toHaveBeenCalledWith(
      'main',
      'schemaUpdateSettings',
      { tables: { access: { mode: 'public' }, publish: 'server', retain: true } },
      'channels'
    );
  });

  it('refuses a channel the space already has', () => {
    const { container, getByText } = renderWith({ tables: { access: { mode: 'public' } } });

    fireEvent.change(field(container, 'newChannel'), { target: { value: 'tables' } });
    fireEvent.click(getByText('Add channel'));

    expect(emit).not.toHaveBeenCalled();
    expect(getByText('The space already has the channel "tables".')).toBeTruthy();
  });
});
