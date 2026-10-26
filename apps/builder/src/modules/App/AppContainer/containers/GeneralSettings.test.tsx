import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBridge, EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import GeneralSettings from './GeneralSettings';

import type { Element } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));

const eventBridge = new EventBridge();
const emit = vi.spyOn(eventBridge, 'emit').mockResolvedValue([]);

const page = (id: string, label: string, attributes: Record<string, unknown> = {}): Element => ({
  id,
  attributes,
  definition: { rootId: id, label, type: 'page', items: [], styleSelectors: { base: '' } }
});

const store: Record<string, unknown> = {
  'schema.settings': { customCss: '' },
  'style.mode': 'desktop-first',
  'schema.flat': {
    home: page('home', 'Home'),
    staff: page('staff', 'Staff', { access: { permissions: ['adminManage'] } }),
    noAccess: page('noAccess', 'No access')
  },
  'schema.pages': ['home', 'staff', 'noAccess'],
  'schema.settings.customCss': ''
};

beforeEach(() => {
  emit.mockClear();
  // Each read as the panel asks for it, by its paths: the panel's own, and the notifications' beneath it.
  vi.mocked(useBuilderStore).mockImplementation(((paths: string[]) => [
    paths.map(path => store[path])
  ]) as unknown as typeof useBuilderStore);
});

// A space spoke of a page withheld in Plitzi's words only, and the builder had no place to say otherwise.
describe('GeneralSettings — the page shown instead of one withheld', () => {
  it('offers every page a visitor may see, and writes the one chosen — or none, for Plitzi’s words', () => {
    const { container } = render(
      <EventBridgeContext value={{ eventBridge }}>
        <GeneralSettings />
      </EventBridgeContext>
    );
    const select = container.querySelector<HTMLSelectElement>('select[name="withheldPage"]');
    if (!select) {
      throw new Error('No withheldPage field');
    }

    expect([...select.options].map(option => option.value)).toEqual(['', 'home', 'noAccess']);
    fireEvent.change(select, { target: { value: 'noAccess' } });
    expect(emit).toHaveBeenCalledWith('main', 'schemaUpdateSettings', 'noAccess', 'withheldPage');
    fireEvent.change(select, { target: { value: '' } });
    expect(emit).toHaveBeenCalledWith('main', 'schemaUpdateSettings', undefined, 'withheldPage');
  });
});
