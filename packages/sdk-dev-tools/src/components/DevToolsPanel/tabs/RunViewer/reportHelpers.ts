import { isRecord } from '@plitzi/sdk-shared/helpers';
import { RUN_REPORT_PATH } from '@plitzi/sdk-shared/runs';

import { recordedSteps } from './stepRecorder';

import type { RunReport } from '@plitzi/sdk-shared/runs';

/**
 * The page's own width when the dev tools' panel takes part of the window, or none when the page has the window whole:
 * the lead plays it at the window's width, and is told the page was narrower.
 */
const pageWidthOf = (page: HTMLElement | null): number | undefined => {
  const width = page ? Math.round(page.getBoundingClientRect().width) : undefined;

  return width !== undefined && width > 0 && Math.abs(width - window.innerWidth) > 1 ? width : undefined;
};

/** What the person reports, as the page is now: where, how wide, which theme, what they pointed at and did. */
export const reportOf = (
  text: string,
  element: string | undefined,
  scheme: 'light' | 'dark',
  page: HTMLElement | null
): RunReport => {
  const { steps, earlier, from } = recordedSteps();
  const pageWidth = pageWidthOf(page);
  const now = `${window.location.pathname}${window.location.search}`;

  return {
    text: text.trim(),
    path: from,
    ...(now === from ? {} : { seenOn: now }),
    width: window.innerWidth,
    height: window.innerHeight,
    ...(pageWidth === undefined ? {} : { pageWidth }),
    scheme,
    ...(element ? { element } : {}),
    steps,
    ...(earlier > 0 ? { earlier } : {}),
    at: new Date().toISOString()
  };
};

/** Sent to the preview's server: its note when kept, or why not — its own words, or the request's failure. */
export const sendReport = async (report: RunReport): Promise<{ sent: string } | { failed: string }> => {
  try {
    const response = await fetch(RUN_REPORT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    const body: unknown = await response.json().catch(() => undefined);
    const said = (key: string): string | undefined => {
      const value = isRecord(body) ? body[key] : undefined;

      return typeof value === 'string' ? value : undefined;
    };

    return response.ok
      ? { sent: said('note') ?? 'Sent to the run’s lead' }
      : { failed: said('error') ?? `The preview answered ${String(response.status)}` };
  } catch (error) {
    return { failed: `The preview did not answer: ${error instanceof Error ? error.message : String(error)}` };
  }
};
