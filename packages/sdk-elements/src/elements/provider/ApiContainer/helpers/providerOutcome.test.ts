import { describe, expect, it } from 'vitest';

import providerOutcome from './providerOutcome';

import type { ProviderOutcomeParams } from './providerOutcome';

const browser = (over: Partial<ProviderOutcomeParams> = {}): ProviderOutcomeParams => ({
  serverMode: false,
  isSuccess: false,
  isError: false,
  rscResolved: false,
  rscPending: false,
  elementData: null,
  ...over
});

const server = (over: Partial<ProviderOutcomeParams> = {}): ProviderOutcomeParams =>
  browser({ serverMode: true, rscResolved: true, ...over });

describe('providerOutcome', () => {
  it('answers a browser provider from its request', () => {
    expect(providerOutcome(browser({ isSuccess: true }))).toBe('success');
    expect(providerOutcome(browser({ isError: true }))).toBe('error');
    expect(providerOutcome(browser())).toBeUndefined();
  });

  // The case that never fired: a server provider has no request, so its request's status was always "nothing yet".
  it('answers a server provider from its slice of the payload', () => {
    expect(providerOutcome(server({ elementData: { records: [] } }))).toBe('success');
  });

  it('calls a payload that arrived without this provider an error', () => {
    expect(providerOutcome(server({ elementData: null }))).toBe('error');
  });

  it('waits while no payload has arrived, as in the builder', () => {
    expect(providerOutcome(server({ rscResolved: false, elementData: { records: [] } }))).toBeUndefined();
  });

  // After a navigation the payload in the store is the previous page's: this provider's answer is on its way.
  it('waits while the payload is for another page', () => {
    expect(providerOutcome(server({ rscPending: true, elementData: null }))).toBeUndefined();
  });

  it('ignores the browser request of a server provider', () => {
    expect(providerOutcome(server({ isError: true, elementData: { ok: true } }))).toBe('success');
  });
});
