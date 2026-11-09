import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { cspReportStage } from './cspReport';

import type { BaseContext } from '@plitzi/sdk-kernel/http';
import type { SSRScriptPolicyReport, SSRSpaceDeployment } from '@plitzi/sdk-kernel/types';

/** A report posted to a host, through the stage alone: what the deployment is handed, and what the browser is told. */
const post = async (
  body: unknown,
  {
    deployment = { spaceId: 42, environment: 'production' },
    record = vi.fn()
  }: { deployment?: SSRSpaceDeployment; record?: (report: SSRScriptPolicyReport) => void } = {}
) => {
  const status = { code: 0 };
  const ctx = {
    raw: Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]),
    req: { path: '/_plitzi/csp-report', method: 'POST', hostname: 'acme.example', ctx: {} },
    res: { setStatus: (code: number) => (status.code = code), setHeader: vi.fn(), send: vi.fn(), end: vi.fn() },
    config: {
      adapters: {
        getSpaceDeployment: () => Promise.resolve(deployment),
        recordScriptPolicyReport: (report: SSRScriptPolicyReport) => {
          record(report);

          return Promise.resolve();
        }
      }
    }
    // Only what the stage reads is given: the rest of a page server's context is no part of what is checked.
  } as unknown as BaseContext;
  await cspReportStage(ctx);

  return { status: status.code, record };
};

const report = (blocked: string, extra: Record<string, string> = {}) => ({
  'csp-report': {
    'document-uri': 'https://acme.example/pricing?ref=mail',
    'blocked-uri': blocked,
    'effective-directive': 'script-src-elem',
    'source-file': 'https://acme.example/',
    'line-number': 12,
    'script-sample': 'alert(1)',
    disposition: 'report',
    ...extra
  }
});

describe('a page’s script policy reports', () => {
  // The space is the one the host serves: a report names no space, and anyone may post one.
  it('hands the deployment each violation for the space its host serves, its page without the query', async () => {
    const { status, record } = await post(report('inline'));

    expect(status).toBe(204);
    expect(record).toHaveBeenCalledWith({
      spaceId: 42,
      environment: 'production',
      page: 'https://acme.example/pricing',
      blocked: 'inline',
      directive: 'script-src-elem',
      source: 'https://acme.example/:12',
      sample: 'alert(1)',
      disposition: 'report'
    });
  });

  // A page reports on every load: the deployment hears of a violation once in a while, not once per visitor.
  it('says the same violation again only after a while', async () => {
    const record = vi.fn();
    await post(report('https://cdn.example/a.js'), { record });
    await post(report('https://cdn.example/a.js'), { record });
    await post(report('https://cdn.example/a.js', { disposition: 'enforce' }), { record });

    expect(record).toHaveBeenCalledTimes(1);
  });

  it('keeps nothing for a host that serves no space, and refuses what is not a report', async () => {
    const { record } = await post(report('https://cdn.example/b.js'), {
      deployment: { spaceId: null, error: { code: 404, message: 'Space not found' } }
    });

    expect(record).not.toHaveBeenCalled();
    expect((await post('not json')).status).toBe(400);
  });
});
