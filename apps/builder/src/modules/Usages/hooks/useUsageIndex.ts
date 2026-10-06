import { useDeferredValue, useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { PROVIDER_TYPES } from '../helpers/providerTypes';
import { usageIndexOf } from '../helpers/usageIndex';

import type { UsageIndex, UsageSource } from '../helpers/usageIndex';

/**
 * The space's usage index, for what the builder holds now.
 *
 * Deferred: an edit is drawn first and the index catches up after it, so typing in a field is never held up by a
 * rebuild — which re-reads only the elements and selectors the edit changed.
 */
const useUsageIndex = (): UsageIndex => {
  const [[schema, style]] = useBuilderStore(['schema', 'style']);
  const source = useMemo<UsageSource>(() => ({ schema, style, providerTypes: PROVIDER_TYPES }), [schema, style]);
  const deferred = useDeferredValue(source);

  return useMemo(() => usageIndexOf(deferred), [deferred]);
};

export default useUsageIndex;
