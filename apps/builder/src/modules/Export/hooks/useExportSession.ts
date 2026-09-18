import { useCallback, useEffect, useMemo, useState } from 'react';

import useSpaceQuota from '@pmodules/Space/hooks/useSpaceQuota';

import useSpaceExport from './useSpaceExport';
import { orderedPaths } from '../helpers/exportFiles';
import { DEFAULT_EXPORT_FORMAT } from '../helpers/exportFormats';

import type { SpaceExportResult } from './useSpaceExport';
import type { ExportFormat } from '../helpers/exportFormats';

/**
 * One visit to the export dialog: the format picked, what each format came to, and which file is on screen.
 *
 * A format is generated the first time it is shown and kept, so going back to one already seen is instant — the dialog
 * is short-lived, and nothing in it edits the space. Nothing is generated for a free plan: the dialog says what export
 * is instead, and the server would refuse the code anyway.
 */
const useExportSession = () => {
  const { quota, error: quotaError } = useSpaceQuota();
  const { exportSpace } = useSpaceExport();
  const [format, setFormat] = useState<ExportFormat>(DEFAULT_EXPORT_FORMAT);
  const [results, setResults] = useState<Partial<Record<ExportFormat, SpaceExportResult>>>({});
  const [pending, setPending] = useState<ExportFormat>();
  const [selected, setSelected] = useState<string>();

  // Until the plan is known nothing is generated. If it cannot be read, the builder does not decide on its own: the
  // server holds the gate, and its refusal locks the dialog like the plan would have.
  const planLoading = !quota && !quotaError;
  const result = results[format];
  const locked = quota?.isFree === true || (result?.ok === false && result.requiresPaidPlan);

  useEffect(() => {
    if (planLoading || locked || results[format]) {
      return;
    }

    let active = true;
    setPending(format);
    void exportSpace(format).then(next => {
      if (!active) {
        return;
      }

      setResults(current => ({ ...current, [format]: next }));
      setPending(undefined);
    });

    return () => {
      active = false;
    };
  }, [exportSpace, format, locked, planLoading, results]);

  const spaceExport = result?.ok ? result.spaceExport : undefined;
  const error = result && !result.ok && !result.requiresPaidPlan ? result.error : '';
  const paths = useMemo(() => (spaceExport ? orderedPaths(spaceExport.files) : []), [spaceExport]);
  const selectedPath = selected && paths.includes(selected) ? selected : paths[0];

  const changeFormat = useCallback((next: ExportFormat) => {
    setFormat(next);
    setSelected(undefined);
  }, []);

  return {
    format,
    changeFormat,
    planName: quota?.planName,
    locked,
    loading: planLoading || pending === format,
    error,
    spaceExport,
    paths,
    selectedPath,
    selectPath: setSelected,
    content: spaceExport && selectedPath ? spaceExport.files[selectedPath] : undefined
  };
};

export default useExportSession;
