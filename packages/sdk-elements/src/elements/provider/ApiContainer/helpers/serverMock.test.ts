import { describe, expect, it } from 'vitest';

import { serverMock } from './serverMock';

describe('serverMock', () => {
  it('puts a query provider’s mock under `data`, as the server and a browser request answer it', () => {
    expect(serverMock('{"plans":[1]}', true)).toEqual({ status: 200, data: { plans: [1] } });
    expect(serverMock({ plans: [1] }, true)).toEqual({ status: 200, data: { plans: [1] } });
  });

  it('keeps a connector’s or an action’s mock as its own slice', () => {
    expect(serverMock('{"records":[1]}', false)).toEqual({ records: [1] });
  });

  it('renders nothing from mock data that is not JSON', () => {
    expect(serverMock('{plans', true)).toEqual({});
  });
});
