import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { SchemaContext } from '@plitzi/sdk-shared/schema/react';
import { withNotificationsCss } from '@plitzi/sdk-shared/style';

import StyleAdvanceEditor from './StyleAdvanceEditor';

import type { AutoComplete } from '@plitzi/plitzi-ui/CodeMirror';

vi.mock('@plitzi/plitzi-ui/CodeMirror', () => ({
  default: ({
    value,
    autoComplete = [],
    onChange
  }: {
    value: string;
    autoComplete?: AutoComplete[];
    onChange?: (value: string) => void;
  }) =>
    createElement('textarea', {
      'aria-label': 'Custom CSS',
      'data-tokens': autoComplete.map(token => (typeof token === 'string' ? token : token.value)).join(','),
      value,
      onChange: (event: { target: { value: string } }) => onChange?.(event.target.value)
    })
}));

const network = vi.hoisted(() => ({ query: vi.fn<(url: string, params: unknown) => Promise<unknown>>() }));

vi.mock('@plitzi/sdk-shared/hooks', async () => ({
  ...(await vi.importActual<object>('@plitzi/sdk-shared/hooks')),
  useNetwork: () => ({ networkQuery: network.query, networkLoading: false })
}));

const NOTIFICATIONS = { background: '#111' };

const editor = (customCss: string) => {
  const schemaUpdateSettings = vi.fn();
  render(
    <StoreProvider
      value={{
        schema: { settings: { customCss } },
        style: { variables: { color: { brand: '#05f' }, spacing: { gap: '8px' } } }
      }}
    >
      <SchemaContext value={{ schemaUpdateSettings }}>
        <StyleAdvanceEditor />
      </SchemaContext>
    </StoreProvider>
  );

  return { schemaUpdateSettings, field: screen.getByLabelText<HTMLTextAreaElement>('Custom CSS') };
};

beforeEach(() => {
  vi.useFakeTimers();
  network.query.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StyleAdvanceEditor', () => {
  it('shows the space’s own CSS without the notifications’ rule written after it', () => {
    const { field } = editor(withNotificationsCss('.hero{color:red}', NOTIFICATIONS));

    expect(field.value).toBe('.hero{color:red}');
  });

  it('offers the style’s variables as tokens to complete', () => {
    const { field } = editor('');

    expect(field.dataset.tokens).toBe('brand,gap');
  });

  it('saves an edit once the typing stops, the notifications’ rule kept after it', () => {
    const { field, schemaUpdateSettings } = editor(withNotificationsCss('.hero{color:red}', NOTIFICATIONS));
    fireEvent.change(field, { target: { value: '.hero{color:blue}' } });

    expect(schemaUpdateSettings).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(schemaUpdateSettings).toHaveBeenCalledWith(
      withNotificationsCss('.hero{color:blue}', NOTIFICATIONS),
      'customCss'
    );
  });

  it('formats the CSS through the server and saves what changed', async () => {
    network.query.mockResolvedValue({ data: '.hero {\n  color: red;\n}\n' });
    const { field, schemaUpdateSettings } = editor('.hero{color:red}');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Format/ }));
      await Promise.resolve();
    });

    expect(network.query).toHaveBeenCalledWith(
      '/utils/prettier-parser',
      { data: '.hero{color:red}', parser: 'css' },
      'post'
    );
    expect(field.value).toBe('.hero {\n  color: red;\n}\n');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(schemaUpdateSettings).toHaveBeenCalledWith('.hero {\n  color: red;\n}\n', 'customCss');
  });

  it('keeps the CSS as it is when the server answers nothing', async () => {
    network.query.mockResolvedValue(undefined);
    const { field, schemaUpdateSettings } = editor('.hero{color:red}');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Format/ }));
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(field.value).toBe('.hero{color:red}');
    expect(schemaUpdateSettings).not.toHaveBeenCalled();
  });
});
