import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';

import type { SchemaVariable } from '../types';

/** What a variable's `subValues` are matched against — everything a `when` rule may name. */
export type VariableScope = {
  routeParams?: Record<string, unknown>;
  queryParams?: Record<string, unknown>;
  hostname?: string;
  environment?: string;
};

/**
 * The space's variables, resolved for this request: `{ apiUrl: 'https://api.plitzi.local', … }`.
 *
 * A variable carries a default and a list of `subValues`, each guarded by a rule on the host, the environment or
 * the request's params — which is how one document names an API that lives at a different address in every
 * environment. The FIRST matching sub-value wins; with none, the default stands.
 *
 * It lives here, apart from the provider that publishes the result into the store, because two callers need it at
 * different moments. `GlobalSources` publishes it for everything that renders. The router needs it BEFORE that:
 * a page that sends an unauthenticated visitor to `{{authUrl}}/` is deciding not to render at all, so the
 * provider that would have resolved the token never runs.
 */
export const resolveVariables = (
  variables: SchemaVariable[] | undefined,
  scope: VariableScope = {}
): Record<string, unknown> => {
  if (!Array.isArray(variables)) {
    return {};
  }

  return variables.reduce<Record<string, unknown>>((acum, variable) => {
    const { name, value, subValues } = variable;
    if (!Array.isArray(subValues) || subValues.length === 0) {
      return { ...acum, [name]: value };
    }

    const subValue = subValues.find(entry => QueryBuilderEvaluator(entry.when, scope));

    return { ...acum, [name]: subValue ? subValue.value : value };
  }, {});
};

export default resolveVariables;
