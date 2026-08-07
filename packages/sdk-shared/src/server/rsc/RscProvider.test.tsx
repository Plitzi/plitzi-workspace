import { render, waitFor } from '@testing-library/react';
import { use } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import RscContext from './RscContext';
import RscProvider from './RscProvider';

import type { RscProviderProps } from './RscProvider';

const Probe = () => {
  const { enabled } = use(RscContext);

  return <span data-testid="enabled">{String(enabled)}</span>;
};

const renderProvider = (props: Omit<RscProviderProps, 'children'>, rscEnabled: boolean) =>
  render(
    <StoreProvider value={{ schema: { rsc: { enabled: rscEnabled } } }}>
      <RscProvider {...props}>
        <Probe />
      </RscProvider>
    </StoreProvider>
  );

describe('RscProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ serverData: { a: 1 } }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches on mount when the schema asks for RSC and a server published its endpoint', async () => {
    const { getByTestId } = renderProvider({ endpoint: '/_rsc' }, true);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect((fetchMock.mock.calls[0][0] as string).startsWith('/_rsc?location=')).toBe(true);
    expect(getByTestId('enabled').textContent).toBe('true');
  });

  it('stays inert when no server published an endpoint, however the schema is configured', async () => {
    const { getByTestId } = renderProvider({}, true);

    await waitFor(() => expect(getByTestId('enabled').textContent).toBe('false'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch when the schema does not ask for RSC', async () => {
    const { getByTestId } = renderProvider({ endpoint: '/_rsc' }, false);

    await waitFor(() => expect(getByTestId('enabled').textContent).toBe('false'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not re-fetch on mount when the server already handed over its data', async () => {
    renderProvider({ endpoint: '/_rsc', rscData: { serverData: {} } }, true);

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it('refresh is a no-op without an endpoint', async () => {
    let refresh: ((ids?: string[]) => Promise<void>) | undefined;
    const Caller = () => {
      refresh = use(RscContext).refresh;

      return null;
    };

    render(
      <StoreProvider value={{ schema: { rsc: { enabled: true } } }}>
        <RscProvider>
          <Caller />
        </RscProvider>
      </StoreProvider>
    );

    await refresh?.(['a']);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
