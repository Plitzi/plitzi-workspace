import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

/**
 * What a server provider renders from in the builder, which has no `/_rsc` to ask: its mock data, in the shape the
 * server answers it with.
 *
 * A provider that only has a `query` is answered as a browser request publishes — `{ status, data }`, the body under
 * `data` — so its mock is that body under `data` too: `<source>.data.<field>` in the browser, on the server and in the
 * builder alike. A connector's or an action's answer is its own slice (`records`, an action's output), and so is its
 * mock. Mock data that is not JSON renders nothing, as an empty answer would.
 */
export const serverMock = (
  mockData: Record<string, unknown> | string,
  queryShaped: boolean
): Record<string, unknown> => {
  let mock: Record<string, unknown>;
  if (typeof mockData !== 'string') {
    mock = mockData;
  } else {
    try {
      mock = JSON.parse(mockData || '{}') as Record<string, unknown>;
    } catch {
      return emptyObject;
    }
  }

  return queryShaped ? { status: 200, data: mock } : mock;
};
