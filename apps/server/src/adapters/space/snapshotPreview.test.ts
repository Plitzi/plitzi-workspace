import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { parsePreviewLabel, PREVIEW_KEY_LENGTH, previewLabel, snapshotPreview } from './snapshotPreview';

import type { PreviewAddress } from './snapshotPreview';
import type { SSRRequest } from '@plitzi/sdk-kernel/types';

const request = (hostname: string): SSRRequest => ({ hostname, query: {}, headers: {} }) as SSRRequest;

const keyOf = ({ spaceId, environment, revision }: PreviewAddress): string =>
  createHmac('sha256', 'secret')
    .update(`${String(spaceId)}:${environment}:${String(revision)}`)
    .digest('hex')
    .slice(0, PREVIEW_KEY_LENGTH);

const ACME: PreviewAddress = { spaceId: 4242, environment: 'production', revision: 12 };

describe('a snapshot’s preview address', () => {
  it('names the snapshot, the space and its key after the space’s name', () => {
    const label = previewLabel('acme', ACME, keyOf(ACME));

    expect(label).toBe(`acme--r12-production-${(4242).toString(36)}-${keyOf(ACME)}`);
    expect(parsePreviewLabel(label)).toEqual({ ...ACME, key: keyOf(ACME) });
  });

  it('cuts a long name to fit one DNS label, and drops one that would read as punycode', () => {
    const long = previewLabel('a'.repeat(63), ACME, keyOf(ACME));

    expect(long.length).toBeLessThanOrEqual(63);
    expect(parsePreviewLabel(long)).toMatchObject(ACME);

    // `xn-` is cut to `xn`, and `xn--…` opens an internationalised label.
    expect(previewLabel('xn-', ACME, keyOf(ACME))).toBe(previewLabel('', ACME, keyOf(ACME)));
  });

  it('is not one for a label of another shape', () => {
    expect(parsePreviewLabel('acme')).toBeUndefined();
    expect(parsePreviewLabel('acme--r12-main-39o-abcdefabcdef')).toBeUndefined();
  });
});

describe('snapshotPreview', () => {
  const find = vi.fn((spaceId: number) => Promise.resolve(spaceId === 4242 ? { spaceId } : undefined));
  const resolver = snapshotPreview({ suffix: 'plitzi.app', keyOf, find });

  it('serves the snapshot its address names, never for search', async () => {
    const host = `${previewLabel('acme', ACME, keyOf(ACME))}.plitzi.app`;

    expect(await resolver(request(host))).toEqual({ ...ACME, noindex: true });
  });

  it('answers a wrong key as a space that does not exist, without looking the space up', async () => {
    find.mockClear();
    const host = `${previewLabel('acme', ACME, 'a'.repeat(PREVIEW_KEY_LENGTH))}.plitzi.app`;

    expect(await resolver(request(host))).toEqual({ refuse: { code: 404, message: 'Space not found' } });
    expect(find).not.toHaveBeenCalled();
  });

  it('answers 404 for a space the deployment does not serve', async () => {
    const gone = { ...ACME, spaceId: 7 };
    const host = `${previewLabel('gone', gone, keyOf(gone))}.plitzi.app`;

    expect(await resolver(request(host))).toEqual({ refuse: { code: 404, message: 'Space not found' } });
  });

  it('is behind every Site password its space’s addresses ask for', async () => {
    const credentials = [
      { provider: 'ssr', data: { user: 'ana', pass: 'secret' } },
      { provider: 'ssr', data: { user: 'bea', pass: 'other' } }
    ];
    const guarded = snapshotPreview({
      suffix: 'plitzi.app',
      keyOf,
      find: spaceId => Promise.resolve({ spaceId, credentials })
    });
    const host = `${previewLabel('acme', ACME, keyOf(ACME))}.plitzi.app`;

    expect(await guarded(request(host))).toEqual({ ...ACME, noindex: true, credentials });
  });

  it('leaves every other sub-domain to the resolvers after it', async () => {
    expect(await resolver(request('acme.plitzi.app'))).toBeUndefined();
    expect(await resolver(request(`deep.${previewLabel('acme', ACME, keyOf(ACME))}.plitzi.app`))).toBeUndefined();
    expect(await resolver(request('example.com'))).toBeUndefined();
  });
});
