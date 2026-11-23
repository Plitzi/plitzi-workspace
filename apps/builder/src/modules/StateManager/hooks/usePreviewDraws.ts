import { useEffect, useMemo } from 'react';

import { declaredExperiments } from '@plitzi/sdk-shared/experiments';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { sameVariants, withDraws } from '../previewDraws';

import type { Schema } from '@plitzi/sdk-shared';
import type { ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

const NONE: ExperimentAssignments = {};
// Read before the space has loaded too — the hook runs with the builder, above its loading — so nothing is there yet.
const NO_ELEMENTS: Schema['flat'] = {};
const NO_NAMES: string[] = [];

/**
 * In the preview, every A/B test nobody picked a variant of by hand is drawn by its shares, as a visitor's page draws
 * it — once, when it has none: a reload keeps what was drawn, as a visitor's cookie keeps it.
 */
const usePreviewDraws = (previewMode: boolean): void => {
  const [[flat = NO_ELEMENTS, components, shown = NONE, picked = NO_NAMES]] = useBuilderStore([
    'schema.flat',
    'schema.components',
    'experiments.qa',
    'previewPicked'
  ]);
  const [, setShown] = useBuilderStore('experiments.qa');
  const declared = useMemo(() => declaredExperiments({ flat, components }), [flat, components]);

  useEffect(() => {
    if (!previewMode) {
      return;
    }

    const next = withDraws(declared, shown, picked);
    if (!sameVariants(next, shown)) {
      setShown(next);
    }
  }, [declared, picked, previewMode, setShown, shown]);
};

export default usePreviewDraws;
