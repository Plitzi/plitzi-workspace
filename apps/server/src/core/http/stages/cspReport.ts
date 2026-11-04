import { isRecord } from '@plitzi/sdk-shared/helpers';

import { serverLog } from '../../../helpers/serverLog';
import { CSP_REPORT_PATH } from '../../../modules/ssr/scriptPolicy';
import { readRawBody } from '../../requestParser';

import type { Stage } from '../types';

/** What one report says: the page, what it would have refused, by which directive, and where that was written. */
type Violation = { page: string; blocked: string; directive: string; source: string };

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
        source: [text(report['source-file']), text(report['line-number'])].filter(Boolean).join(':')
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
        source: [text(report.sourceFile), text(report.lineNumber)].filter(Boolean).join(':')
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
    `A page's script policy would refuse ${violation.blocked || '(an inline script)'} under ${violation.directive || 'its script policy'} (first seen on ${pathOf(violation.page)})` +
      (violation.source ? `, from ${violation.source}` : '') +
      ' — the policy only reports for now (`scriptPolicy`); enforced, this would not run'
  );
};

/** Where a page's script policy reports (`SSRServerConfig.scriptPolicy`): said in the log, answered with nothing. */
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

  violationsOf(body).forEach(say);
  res.setStatus(204);
  res.end();

  return true;
};
