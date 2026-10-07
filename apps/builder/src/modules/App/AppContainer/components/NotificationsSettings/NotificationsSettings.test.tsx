import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EventBridge from '@plitzi/sdk-event-bridge/EventBridge';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { withNotificationsCss } from '@plitzi/sdk-shared/style/notifications';

import NotificationsSettings from './NotificationsSettings';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));

const OWN = '@keyframes spin { to { transform: rotate(360deg); } }';
const eventBridge = new EventBridge();
const emit = vi.spyOn(eventBridge, 'emit').mockResolvedValue([]);

/** The field of one notifications setting, by the name it carries. */
const fieldOf = (container: HTMLElement, field: string): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>(`input[name="notifications-${field}"]`);
  if (!input) {
    throw new Error(`No field for ${field}`);
  }

  return input;
};

const renderWith = (customCss: string) => {
  vi.mocked(useBuilderStore).mockReturnValue([[customCss]] as unknown as ReturnType<typeof useBuilderStore>);

  return render(
    <EventBridgeContext value={{ eventBridge }}>
      <NotificationsSettings />
    </EventBridgeContext>
  );
};

beforeEach(() => {
  emit.mockClear();
});

describe('NotificationsSettings', () => {
  it('reads what the custom CSS says of the toasts, and writes a change back beside the own CSS of the space', () => {
    const { container } = renderWith(withNotificationsCss(OWN, { radius: '12px' }));

    expect(fieldOf(container, 'radius').value).toBe('12px');

    fireEvent.change(fieldOf(container, 'background'), { target: { value: 'var(--card)' } });

    expect(emit).toHaveBeenCalledWith(
      'main',
      'schemaUpdateSettings',
      withNotificationsCss(OWN, { radius: '12px', background: 'var(--card)' }),
      'customCss'
    );
  });

  it('edits the parts inside the toast as fields too, keeping the ones it was not asked to change', () => {
    const { container } = renderWith(withNotificationsCss(OWN, { iconSize: '18px', closeColor: 'var(--muted)' }));

    expect(fieldOf(container, 'iconSize').value).toBe('18px');
    expect(fieldOf(container, 'closeColor').value).toBe('var(--muted)');

    fireEvent.change(fieldOf(container, 'progressHeight'), { target: { value: '2px' } });

    expect(emit).toHaveBeenCalledWith(
      'main',
      'schemaUpdateSettings',
      withNotificationsCss(OWN, { iconSize: '18px', closeColor: 'var(--muted)', progressHeight: '2px' }),
      'customCss'
    );
  });

  it('says what is wrong with a value that is not one CSS value, and keeps it out of the space', () => {
    const { container, getByText } = renderWith(OWN);

    fireEvent.change(fieldOf(container, 'border'), { target: { value: '1px solid red; } body {' } });

    expect(getByText(/not one CSS value/)).toBeTruthy();
    expect(emit).not.toHaveBeenCalled();
  });
});
