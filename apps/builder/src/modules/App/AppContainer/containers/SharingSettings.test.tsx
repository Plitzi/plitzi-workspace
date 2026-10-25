import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBridge, EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import SharingSettings from './SharingSettings';

import type { Schema } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));

const eventBridge = new EventBridge();
const emit = vi.spyOn(eventBridge, 'emit').mockResolvedValue([]);

const fieldOf = (container: HTMLElement, name: string): HTMLInputElement | HTMLTextAreaElement => {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
  if (!field) {
    throw new Error(`No field ${name}`);
  }

  return field;
};

const renderWith = (settings: Partial<Schema['settings']>) => {
  // The store's tuple of one read, as the panel asks for it: the space's settings.
  vi.mocked(useBuilderStore).mockReturnValue([[{ customCss: '', ...settings }]] as unknown as ReturnType<
    typeof useBuilderStore
  >);

  return render(
    <EventBridgeContext value={{ eventBridge }}>
      <SharingSettings />
    </EventBridgeContext>
  );
};

beforeEach(() => {
  emit.mockClear();
});

// A link to a space pasted in a chat showed no picture and Plitzi's icon: the builder had no place to say otherwise.
describe('SharingSettings', () => {
  it('reads the space’s identity and writes each change back, an emptied field left out', () => {
    const { container } = renderWith({ siteName: 'Acme', favicon: '/favicon.svg' });

    expect(fieldOf(container, 'siteName').value).toBe('Acme');
    fireEvent.change(fieldOf(container, 'shareImage'), { target: { value: '/og.png' } });
    expect(emit).toHaveBeenCalledWith('main', 'schemaUpdateSettings', '/og.png', 'shareImage');
    fireEvent.change(fieldOf(container, 'favicon'), { target: { value: '' } });
    expect(emit).toHaveBeenCalledWith('main', 'schemaUpdateSettings', undefined, 'favicon');
  });

  it('writes one colour, or one a scheme once the dark one is said', () => {
    const { container } = renderWith({ themeColor: '#fbf7f0' });

    fireEvent.change(fieldOf(container, 'themeColorDark'), { target: { value: '#0b0a10' } });
    expect(emit).toHaveBeenCalledWith(
      'main',
      'schemaUpdateSettings',
      { light: '#fbf7f0', dark: '#0b0a10' },
      'themeColor'
    );
  });

  it('says what a head cannot read as it is typed, as authoring would refuse it', () => {
    const { container, getByText } = renderWith({});

    fireEvent.change(fieldOf(container, 'language'), { target: { value: 'English' } });
    expect(getByText('language "English" is no language tag: `en`, `es`, `es-MX`.')).toBeTruthy();
  });

  it('edits the robots.txt crawlers read', () => {
    const { container } = renderWith({});

    fireEvent.change(fieldOf(container, 'robotsTxt'), { target: { value: 'User-agent: *\nDisallow: /admin' } });
    expect(emit).toHaveBeenCalledWith('main', 'schemaUpdateSettings', 'User-agent: *\nDisallow: /admin', 'robotsTxt');
  });
});
