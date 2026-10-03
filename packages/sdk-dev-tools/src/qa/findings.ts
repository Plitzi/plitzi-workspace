import type { QaFinding } from './checks';
import type { QaCheck } from './qaSettings';

/** What each check found, the last time it looked. */
export type QaFindings = Record<QaCheck, QaFinding[]>;

export const NO_FINDINGS: QaFindings = { overflow: [], names: [], targets: [], contrast: [], images: [], headings: [] };
