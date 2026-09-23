import type { DataSourceUtility, DataSourceUtilityParamsValue } from '../../types';

/**
 * A checkbox param as the boolean it means.
 *
 * A document stores what an editor or an author wrote, and a checkbox arrives both ways: `true` from the builder,
 * `'true'` or `'false'` from anything that writes params as text — an authored space, an export, an agent. A callback
 * reading `if (asAge)` takes `'false'` for yes, so `dateConverter({ asAge: 'false' })` printed "3 days ago" and
 * `isUnix: 'false'` parsed an ISO date as a number and gave the raw string back. Normalised once here, before any
 * callback runs, every utility reads a checkbox the same way.
 */
export const checkboxParams = <TParams>(
  utility: Pick<DataSourceUtility<unknown, unknown, TParams>, 'params'>,
  params: DataSourceUtilityParamsValue<TParams> | undefined
): DataSourceUtilityParamsValue<TParams> | undefined => {
  if (!params) {
    return params;
  }

  let normalised = params;
  for (const [key, declared] of Object.entries(utility.params)) {
    const value: unknown = params[key];
    if (value !== 'true' && value !== 'false') {
      continue;
    }

    const type = typeof declared.type === 'function' ? declared.type(params) : declared.type;
    if (type !== 'checkbox') {
      continue;
    }

    if (normalised === params) {
      normalised = { ...params };
    }

    // The declared type says this key holds a boolean; `TParams` is the utility's text-shaped param type.
    normalised[key] = (value === 'true') as TParams;
  }

  return normalised;
};
