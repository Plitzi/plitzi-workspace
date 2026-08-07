import { describe, expect, it, vi } from 'vitest';

import { resolveRscEndpoint, resolveServices } from './resolve';

import type { SSRAdapters, SSRServerConfig } from '@plitzi/sdk-shared';

const config = (overrides: Partial<SSRServerConfig> = {}, adapters: Partial<SSRAdapters> = {}): SSRServerConfig => ({
  adapters: { getOfflineData: vi.fn(), getSpaceDeployment: vi.fn(), ...adapters },
  ...overrides
});

describe('resolveServices', () => {
  it('turns RSC on when a getRscData adapter is provided and off when it is not', () => {
    expect(resolveServices(config({}, { getRscData: vi.fn() })).rsc).toBe(true);
    expect(resolveServices(config()).rsc).toBe(false);
  });
});

describe('resolveRscEndpoint', () => {
  it('publishes the configured path when the endpoint is mounted', () => {
    expect(resolveRscEndpoint(config({}, { getRscData: vi.fn() }))).toBe('/_rsc');
    expect(resolveRscEndpoint(config({ rsc: { path: '/_data' } }, { getRscData: vi.fn() }))).toBe('/_data');
  });

  it('publishes nothing without an adapter, with rsc disabled, or with the service switched off', () => {
    expect(resolveRscEndpoint(config())).toBeUndefined();
    expect(resolveRscEndpoint(config({ rsc: { enabled: false } }, { getRscData: vi.fn() }))).toBeUndefined();
    expect(resolveRscEndpoint(config({ services: { rsc: false } }, { getRscData: vi.fn() }))).toBeUndefined();
  });
});
