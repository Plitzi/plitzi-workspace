import { useMemo } from 'react';

import { templatePaths } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import type { ElementBinding } from '@plitzi/sdk-shared';
import type { RuleGroup } from '@plitzi/sdk-shared/helpers/ruleEvaluator';

export type UseElementDataSourceProps = {
  bindings?: Record<string, ElementBinding[]>;
  sources?: string[];
};

/**
 * The paths one binding reads: its `source`, every path its `twigTemplate` transformers read, and every field its `when`
 * rules compare.
 *
 * The template half is what used to fail in silence. A binding on `list_spaces.item.id` whose template also said
 * `{{ theme.resolved }}` or `{{ state.scope }}` got nothing for the second name, because only the `source` was
 * subscribed — the URL it built carried an empty value, and nothing anywhere reported it. The `when` half did too: a
 * binding shown only while `state.open` held was never told `state.open` changed. In a transformer's template `source`
 * is the bound value itself, not a source, and is left out.
 */
const pathsOf = ({ source, transformers, when }: ElementBinding): string[] => {
  const paths: string[] = source ? [source] : [];
  for (const { action, params } of transformers ?? []) {
    if (action === 'twigTemplate' && typeof params.template === 'string' && params.template) {
      paths.push(...templatePaths(params.template).filter(path => path !== 'source' && !path.startsWith('source.')));
    }
  }

  if (when) {
    paths.push(...rulePaths(when));
  }

  return paths;
};

const rulePaths = (group: RuleGroup): string[] =>
  group.rules.flatMap(rule =>
    'rules' in rule
      ? rulePaths(rule)
      : [rule.field, ...(rule.isBinding && typeof rule.value === 'string' ? [rule.value] : [])]
  );

/**
 * The fewest paths that cover all of them: a path under one already listed is read through it. Keeping both would
 * subscribe twice to the same change — and put the deeper value into the object the shallower one already holds.
 */
const covering = (paths: Iterable<string>): string[] => {
  const kept: string[] = [];
  for (const path of [...new Set(paths)].filter(Boolean).sort((a, b) => a.length - b.length)) {
    if (!kept.some(shorter => path.startsWith(`${shorter}.`))) {
      kept.push(path);
    }
  }

  return kept;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value` at `path` inside `map`, making the objects on the way — never writing into one read from the store. */
const place = (map: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = path.split('.');
  let at = map;
  for (const segment of segments.slice(0, -1)) {
    // Always one of ours: a path under a value read from the store was dropped by `covering`.
    const next = at[segment];
    const inner: Record<string, unknown> = isRecord(next) ? next : {};
    at[segment] = inner;
    at = inner;
  }

  at[segments[segments.length - 1]] = value;
};

// Source VALUES live under `runtime.sources.*` (globals + scoped), combined by the store's deep-merge scope
// chain. We subscribe only to the PATHS the element's bindings and templates read — not the whole source they sit
// in — so the element re-renders only when one of those values changes. Subscribed by root, every element that read
// any computed value rendered again whenever any computed value changed: on a board with a few hundred elements, the
// tool in hand changing was the whole page drawn again.
const useElementDataSource = ({ bindings, sources: sourcesProp }: UseElementDataSourceProps) => {
  const sourcePaths = useMemo(() => {
    const paths = new Set<string>(sourcesProp ?? []);
    for (const bindingsGroup of Object.values(bindings ?? {})) {
      if (!Array.isArray(bindingsGroup)) {
        continue;
      }

      for (const binding of bindingsGroup) {
        for (const path of pathsOf(binding)) {
          paths.add(path);
        }
      }
    }

    if (paths.size > 0) {
      paths.add('variables');
    }

    return covering(paths);
  }, [bindings, sourcesProp]);

  const storePaths = useMemo(() => sourcePaths.map(path => `runtime.sources.${path}` as const), [sourcePaths]);
  const [values] = useCommonStore(storePaths);

  return useMemo(() => {
    const map: Record<string, unknown> = {};
    sourcePaths.forEach((path, index) => {
      // Left out rather than set to undefined. A template root is not always a source — `{{ source }}` is the bound
      // value, `{{ apiUrl }}` a variable the evaluator lifts to the root — and an undefined key spread over the
      // template's context would shadow both.
      if (values[index] !== undefined) {
        place(map, path, values[index]);
      }
    });

    return map;
  }, [sourcePaths, values]);
};

export default useElementDataSource;
