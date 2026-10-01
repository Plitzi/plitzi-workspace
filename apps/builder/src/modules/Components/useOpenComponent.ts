import { useMemo } from 'react';

import { componentNamed } from '@plitzi/sdk-schema/helpers/components';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { SpaceComponent } from '@plitzi/sdk-shared';

/** The defaults of what a component declares: what its props read while it is edited, with no instance around it. */
const defaultsOf = (component: SpaceComponent): Record<string, unknown> =>
  Object.fromEntries(Object.entries(component.props ?? {}).map(([name, prop]) => [name, prop.default ?? null]));

/**
 * The component open in the canvas, and the scope the builder is drawn in while it is.
 *
 * The scope lays the component's tree over the pages' — ids are one namespace, so every tool that finds an element by
 * id finds the component's — and hands its props their defaults. With nothing open it is empty, and a scope with
 * nothing of its own reads straight through to the store.
 */
const useOpenComponent = (): { component?: SpaceComponent; scope: Record<string, unknown> } => {
  const [[componentOpen, components]] = useBuilderStore(['componentOpen', 'schema.components']);
  const component = componentOpen ? componentNamed({ components }, componentOpen) : undefined;
  const scope = useMemo(
    () =>
      component ? { schema: { flat: component.flat }, runtime: { sources: { props: defaultsOf(component) } } } : {},
    [component]
  );

  return { component, scope };
};

export default useOpenComponent;
