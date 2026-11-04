import { isRecord } from '@plitzi/sdk-shared/helpers';

import { knowHostDeployment } from './hostDeployment';
import { serverLog } from '../../../helpers/serverLog';
import { CSP_REPORT_PATH } from '../../../modules/ssr/scriptPolicy';
import { readRawBody } from '../../requestParser';

import type { BaseContext, Stage } from '../types';
import type { SSRScriptPolicyReport } from '@plitzi/sdk-shared';

/**
 * What one report says: the page, what it would have refused, by which directive, where that was written, the first
 * characters of it, and whether it was refused or only reported.
 */
type Violation = Pick<SSRScriptPolicyReport, 'page' | 'blocked' | 'directive' | 'source' | 'sample' | 'disposition'>;

const dispositionOf = (value: unknown): Violation['disposition'] => (value === 'enforce' ? 'enforce' : 'report');

const text = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/** A browser's report, either way they come: `report-uri`'s `{ "csp-report": … }` or the Reporting API's list. */
const violationsOf = (body: unknown): Violation[] => {
  if (isRecord(body) && isRecord(body['csp-report'])) {
    const report = body['csp-report'];

    return [
      {
        page: text(report['document-uri']),
        blocked: text(report['blocked-uri']),
        directive: text(report['effective-directive']) || text(report['violated-directive']),
        source: [text(report['source-file']), text(report['line-number'])].filter(Boolean).join(':'),
        sample: text(report['script-sample']),
        disposition: dispositionOf(report.disposition)
      }
    ];
  }

  return (Array.isArray(body) ? body : []).flatMap(entry => {
    if (!isRecord(entry) || entry.type !== 'csp-violation' || !isRecord(entry.body)) {
      return [];
    }

    const report = entry.body;

    return [
      {
        page: text(report.documentURL),
        blocked: text(report.blockedURL),
        directive: text(report.effectiveDirective),
        source: [text(report.sourceFile), text(report.lineNumber)].filter(Boolean).join(':'),
        sample: text(report.sample),
        disposition: dispositionOf(report.disposition)
      }
    ];
  });
};

/** A violation said once an hour, a hundred a minute at most: anyone may post a report, and a page reports on every load. */
const SAY_AGAIN_MS = 60 * 60 * 1000;
const MAX_PER_MINUTE = 100;
const MAX_KNOWN = 1000;
const said = new Map<string, number>();
let minute = { startedAt: 0, count: 0 };

const pathOf = (page: string): string => {
  try {
    const url = new URL(page);

    return `${url.host}${url.pathname}`;
  } catch {
    return page;
  }
};

const say = (violation: Violation): void => {
  const now = Date.now();
  // By what would be refused and where it comes from, not by page: one script of the SDK, refused on every page of every
  // space, is one thing to say — with the first page it was seen on.
  const key = `${violation.directive}|${violation.blocked}|${violation.source}`;
  const last = said.get(key);
  if (last !== undefined && now - last < SAY_AGAIN_MS) {
    return;
  }

  if (now - minute.startedAt >= 60_000) {
    minute = { startedAt: now, count: 0 };
  }

  minute.count += 1;
  if (minute.count > MAX_PER_MINUTE) {
    return;
  }

  // Bounded, and once full it keeps what it has: past it a violation is said, never forgotten to make room.
  if (last !== undefined || said.size < MAX_KNOWN) {
    said.set(key, now);
  }

  serverLog.warn(
    'CSP',
    `A page's script policy ${violation.disposition === 'enforce' ? 'refused' : 'would refuse'} ${violation.blocked || '(an inline script)'} under ${violation.directive || 'its script policy'} (first seen on ${pathOf(violation.page)})` +
      (violation.source ? `, from ${violation.source}` : '') +
      (violation.disposition === 'enforce'
        ? ' — the policy is enforced, and it did not run'
        : ' — the policy only reports (`scriptPolicy`); enforced, this would not run')
  );
};

/**
 * Each space's violations, handed to the deployment (`recordScriptPolicyReport`) once in a while rather than on every
 * page a visitor opens: by space and by what would be refused, again after `KEEP_AGAIN_MS`. Bounded as the log's is.
 */
const KEEP_AGAIN_MS = 10 * 60 * 1000;
const kept = new Map<string, number>();

const pageOf = (page: string): string => {
  try {
    const url = new URL(page);

    return `${url.origin}${url.pathname}`;
  } catch {
    return page;
  }
};

/** The space is the one the report's host serves, never one the report names: anyone may post one. */
const keep = async (ctx: BaseContext, violations: Violation[]): Promise<void> => {
  const record = ctx.config.adapters.recordScriptPolicyReport;
  if (!record || violations.length === 0) {
    return;
  }

  await knowHostDeployment(ctx);
  const deployment = ctx.req.ctx.spaceDeployment;
  if (typeof deployment?.spaceId !== 'number') {
    return;
  }

  const { spaceId, environment = 'main' } = deployment;
  const now = Date.now();
  for (const violation of violations) {
    const key = `${String(spaceId)}|${violation.directive}|${violation.blocked}|${violation.source}`;
    const last = kept.get(key);
    if (last !== undefined && now - last < KEEP_AGAIN_MS) {
      continue;
    }

    if (last !== undefined || kept.size < MAX_KNOWN) {
      kept.set(key, now);
    }

    try {
      await record({ ...violation, page: pageOf(violation.page), spaceId, environment });
    } catch (error) {
      serverLog.warn('CSP', `A report for space ${String(spaceId)} could not be kept: it is in the log alone`, error);
    }
  }
};

/**
 * Where a page's script policy reports (`SSRServerConfig.scriptPolicy`): said in the log, kept for its space when the
 * deployment keeps them (`recordScriptPolicyReport`), answered with nothing.
 */
export const cspReportStage: Stage = async ctx => {
  const { raw, req, res } = ctx;
  if (req.path !== CSP_REPORT_PATH) {
    return false;
  }

  if (req.method !== 'POST') {
    res.setStatus(405);
    res.setHeader('Allow', 'POST');
    res.send('Method not allowed');

    return true;
  }

  let body: unknown;
  try {
    body = JSON.parse(await readRawBody(raw));
  } catch {
    res.setStatus(400);
    res.send('Not a report');

    return true;
  }

  const violations = violationsOf(body);
  violations.forEach(say);
  await keep(ctx, violations);
  res.setStatus(204);
  res.end();

  return true;
};
