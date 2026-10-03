import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { createContext, useCallback, useMemo, useState } from 'react';

import { QA_DEFAULTS } from './qaSettings';

import type { QaCheck, QaSettings } from './qaSettings';
import type { QaFinding } from './scans';
import type { ReactNode, RefObject } from 'react';

export type QaFindings = Record<QaCheck, QaFinding[]>;

const NO_FINDINGS: QaFindings = { overflow: [], names: [], targets: [] };

export interface QaContextValue {
  settings: QaSettings;
  setSetting: <K extends Exclude<keyof QaSettings, 'checks'>>(key: K, value: QaSettings[K]) => void;
  setCheck: (check: QaCheck, on: boolean) => void;
  /** What the checks that are on found, the last time they looked. */
  findings: QaFindings;
  setFindings: (findings: QaFindings) => void;
  /** Bumped to make the checks look again. */
  round: number;
  rescan: () => void;
  /** The page's own box: what the tools draw over and what the checks look in — never the panel. */
  pageRef: RefObject<HTMLElement | null>;
}

const QaContext = createContext<QaContextValue>({
  settings: QA_DEFAULTS,
  setSetting: () => undefined,
  setCheck: () => undefined,
  findings: NO_FINDINGS,
  setFindings: () => undefined,
  round: 0,
  rescan: () => undefined,
  pageRef: { current: null }
});
QaContext.displayName = 'QaContext';

export type QaProviderProps = {
  children?: ReactNode;
  pageRef: RefObject<HTMLElement | null>;
};

/** The QA tab's settings, kept in this browser, and what its checks found — shared by the tab and the layer. */
export const QaProvider = ({ children, pageRef }: QaProviderProps) => {
  const [stored, setStored] = useStorage<Partial<QaSettings>>('plitzi-sdk.dev-tools.qa', QA_DEFAULTS);
  const [findings, setFindings] = useState<QaFindings>(NO_FINDINGS);
  const [round, setRound] = useState(0);
  // A browser that kept an older set of settings gets the new ones off, not undefined.
  const settings = useMemo<QaSettings>(
    () => ({ ...QA_DEFAULTS, ...stored, checks: { ...QA_DEFAULTS.checks, ...stored.checks } }),
    [stored]
  );

  const setSetting = useCallback<QaContextValue['setSetting']>(
    (key, value) => setStored(previous => ({ ...previous, [key]: value })),
    [setStored]
  );

  const setCheck = useCallback(
    (check: QaCheck, on: boolean) =>
      setStored(previous => ({ ...previous, checks: { ...QA_DEFAULTS.checks, ...previous.checks, [check]: on } })),
    [setStored]
  );

  const rescan = useCallback(() => setRound(previous => previous + 1), []);

  const value = useMemo(
    () => ({ settings, setSetting, setCheck, findings, setFindings, round, rescan, pageRef }),
    [settings, setSetting, setCheck, findings, round, rescan, pageRef]
  );

  return <QaContext value={value}>{children}</QaContext>;
};

export default QaContext;
