import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { NO_FINDINGS } from './findings';
import { QA_DEFAULTS } from './qaSettings';
import { NO_XRAY_COUNTS } from './xray';

import type { QaFindings } from './findings';
import type { QaCheck, QaSettings } from './qaSettings';
import type { XrayCounts } from './xray';
import type { ReactNode, RefObject } from 'react';

export interface QaContextValue {
  settings: QaSettings;
  setSetting: <K extends Exclude<keyof QaSettings, 'checks'>>(key: K, value: QaSettings[K]) => void;
  setCheck: (check: QaCheck, on: boolean) => void;
  /** What the checks that are on found, the last time they looked. */
  findings: QaFindings;
  setFindings: (findings: QaFindings) => void;
  /** How many elements of the page the x-ray marked, by mark, the last time it looked. */
  xrayCounts: XrayCounts;
  setXrayCounts: (counts: XrayCounts) => void;
  /** Bumped to make the checks look again. */
  round: number;
  rescan: () => void;
  /** The page's own box: what the tools draw over and what the checks look in — never the panel. */
  pageRef: RefObject<HTMLElement | null>;
  /** The element the inspector was clicked on, kept in the tab until another is. */
  pinned: Element | undefined;
  setPinned: (element: Element | undefined) => void;
}

const QaContext = createContext<QaContextValue>({
  settings: QA_DEFAULTS,
  setSetting: () => undefined,
  setCheck: () => undefined,
  findings: NO_FINDINGS,
  setFindings: () => undefined,
  xrayCounts: NO_XRAY_COUNTS,
  setXrayCounts: () => undefined,
  round: 0,
  rescan: () => undefined,
  pageRef: { current: null },
  pinned: undefined,
  setPinned: () => undefined
});
QaContext.displayName = 'QaContext';

export type QaProviderProps = {
  children?: ReactNode;
  pageRef: RefObject<HTMLElement | null>;
  /** The panel is folded away: what works on the page's own clicks and marks its elements stops with it. */
  collapsed: boolean;
};

/** The QA tab's settings, kept in this browser, and what its checks found — shared by the tab and the layer. */
export const QaProvider = ({ children, pageRef, collapsed }: QaProviderProps) => {
  // A key of its own, not a path under the dev tools' shared one: every write there — a tab picked, the panel resized
  // — would hand this a new object, and with it new settings and a rescan of every check that is on.
  const [stored, setStored] = useStorage<Partial<QaSettings>>('plitzi-sdk-dev-tools-qa', QA_DEFAULTS);
  const [findings, setFindings] = useState<QaFindings>(NO_FINDINGS);
  const [xrayCounts, setXrayCounts] = useState<XrayCounts>(NO_XRAY_COUNTS);
  const [round, setRound] = useState(0);
  const [pinned, setPinned] = useState<Element | undefined>();
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

  /**
   * Closing the panel puts away the tools that act on the page rather than draw over it: the inspector, which takes
   * the page's clicks, and the checks, which mark its elements. What only draws — the grid, the outlines, a vision
   * mode — is a view the tester chose, and stays.
   */
  useEffect(() => {
    if (!collapsed) {
      return;
    }

    setStored(previous => ({ ...previous, inspect: false, checks: QA_DEFAULTS.checks }));
    setPinned(undefined);
  }, [collapsed, setStored]);

  const value = useMemo(
    () => ({
      settings,
      setSetting,
      setCheck,
      findings,
      setFindings,
      xrayCounts,
      setXrayCounts,
      round,
      rescan,
      pageRef,
      pinned,
      setPinned
    }),
    [settings, setSetting, setCheck, findings, xrayCounts, round, rescan, pageRef, pinned]
  );

  return <QaContext value={value}>{children}</QaContext>;
};

export default QaContext;
