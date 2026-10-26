import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { CheckIssue } from './types';

/**
 * The server providers that failed on the page server and were answered in the browser after: the first paint and a
 * crawler lack them, and the server logs the failure on every load — a run's conversation page did, every check saying
 * "nothing wrong". One that still fails is the data's to say (`dataIssues`: failed, or shown by the page).
 */
export const serverFailedIssues = (
  failures: Readonly<Record<string, string>>,
  sources: Readonly<Record<string, unknown>> | undefined,
  width: number
): CheckIssue[] =>
  Object.entries(failures).flatMap(([id, why]) => {
    const source = sources?.[`apiContainer_${id}`];

    return isRecord(source) && source.hasError === true
      ? []
      : [
          {
            code: 'server-render-failed' as const,
            message: `apiContainer_${id} failed on the page server — ${why} — and was answered in the browser after: the first paint and a crawler lack it, and the server logs it on every load`,
            elementId: id,
            width
          }
        ];
  });
