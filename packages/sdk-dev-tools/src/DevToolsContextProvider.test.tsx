// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { use } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { pConsole } from '@plitzi/sdk-shared/devTools';
import { DevToolsContext } from '@plitzi/sdk-shared/devTools/react';

import DevToolsContextProvider from './DevToolsContextProvider';

/**
 * The badge said a warning, and the panel it opened showed none. Opening it moved the panel in the page's
 * layout, React mounted its provider again, and the logs it kept in its own state were gone. It starts from what the
 * page logged since, and a Clear empties that too.
 */

const Count = () => {
  const { logs, clearLogs } = use(DevToolsContext);

  return (
    <button type="button" onClick={clearLogs}>
      {logs.filter(log => log.logType === 'warning').length}
    </button>
  );
};

const panel = () =>
  render(
    <DevToolsContextProvider>
      <Count />
    </DevToolsContextProvider>
  );

afterEach(() => {
  pConsole.clearHistory();
});

describe('the dev tools’ logs', () => {
  it('keeps a warning logged before the panel through the panel mounting again — and a Clear for good', async () => {
    pConsole.warning('network', 'A request failed', { url: '/api', method: 'GET', status: 500 });

    const first = panel();
    expect(first.getByRole('button').textContent).toBe('1');
    first.unmount();

    // Mounted again, as opening it from the badge did: the warning is still there.
    const again = panel();
    expect(again.getByRole('button').textContent).toBe('1');

    await act(async () => {
      again.getByRole('button').click();
      await Promise.resolve();
    });
    expect(again.getByRole('button').textContent).toBe('0');
    again.unmount();

    expect(panel().getByRole('button').textContent).toBe('0');
  });
});
