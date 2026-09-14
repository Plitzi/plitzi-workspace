import { useMemo } from 'react';

import { templateRootNames } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import type { ElementBinding } from '@plitzi/sdk-shared';

export type UseElementDataSourceProps = {
  bindings?: Record<string, ElementBinding[]>;
  sources?: string[];
};

/**
 * The sources one binding names: the head of its `source`, and every root its `twigTemplate` transformers read.
 *
 * The template half is what used to fail in silence. A binding on `list_spaces.item.id` whose template also said
 * `{{ theme.resolved }}` or `{{ state.scope }}` got nothing for the second name, because only the `source` was
 * subscribed — the URL it built carried an empty value, and nothing anywhere reported it.
 */
const namesOf = ({ source, transformers }: ElementBinding): string[] => {
  const names: string[] = [];
  if (source) {
    const dotIndex = source.indexOf('.');
    names.push(dotIndex > -1 ? source.substring(0, dotIndex) : source);
  }

  for (const { action, params } of transformers ?? []) {
    if (action === 'twigTemplate' && params.template) {
      names.push(...templateRootNames(params.template));
    }
  }

  return names;
};

// Source VALUES live under `runtime.sources.*` (globals + scoped), combined by the store's deep-merge scope
// chain. We subscribe only to the sources the element's bindings reference, so the element re-renders only when
// one of its own sources changes — not on unrelated source updates.
const useElementDataSource = ({ bindings, sources: sourcesProp }: UseElementDataSourceProps) => {
  const sourceNames = useMemo(() => {
    const names = new Set<string>(sourcesProp ?? []);
    for (const bindingsGroup of Object.values(bindings ?? {})) {
      if (!Array.isArray(bindingsGroup)) {
        continue;
      }

      for (const binding of bindingsGroup) {
        for (const name of namesOf(binding)) {
          names.add(name);
        }
      }
    }

    if (names.size > 0 && !names.has('variables')) {
      names.add('variables');
    }

    return [...names];
  }, [bindings, sourcesProp]);

  const paths = useMemo(() => sourceNames.map(name => `runtime.sources.${name}` as const), [sourceNames]);
  const [values] = useCommonStore(paths);

  return useMemo(() => {
    const map: Record<string, unknown> = {};
    sourceNames.forEach((name, index) => {
      // Left out rather than set to undefined. A template root is not always a source — `{{ source }}` is the bound
      // value, `{{ apiUrl }}` a variable the evaluator lifts to the root — and an undefined key spread over the
      // template's context would shadow both.
      if (values[index] !== undefined) {
        map[name] = values[index];
      }
    });

    return map;
  }, [sourceNames, values]);
};

export default useElementDataSource;
