import { useMemo } from 'react';

import useStableValue from '../../hooks/useStableValue';
import { useCommonStore, useRenderSettings } from '../../store';
import resolveVariables from '../resolveVariables';

import type { SchemaVariableValue } from '../../types';

/**
 * The space's variables, resolved for where the visitor is — from `schema.variables` and the route, never from the
 * published `runtime.sources.variables`.
 *
 * `GlobalSources` publishes that map while it renders, which is below the SDK's own stylesheet: on the server the sheet
 * is already written by then, without them, and in the browser the store has changed in the middle of hydration, so
 * React drew the sheet again with them — a hydration error on every space that declares a variable. Everything that
 * renders above the provider, or must render the same on both sides, resolves them here instead.
 */
const useResolvedVariables = (): Record<string, SchemaVariableValue> => {
  const { environment } = useRenderSettings();
  const [[variables, routeParams, queryParams, hostname]] = useCommonStore([
    'schema.variables',
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.hostname'
  ]);

  return useStableValue(
    useMemo(
      () => resolveVariables(variables, { routeParams, queryParams, hostname, environment }),
      [environment, hostname, queryParams, routeParams, variables]
    )
  );
};

export default useResolvedVariables;
