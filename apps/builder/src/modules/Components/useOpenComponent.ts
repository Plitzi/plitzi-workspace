import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useMemo } from 'react';

import { componentNamed } from '@plitzi/sdk-schema';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { placementsOf, previewOf } from './preview';

import type { ComponentGround, ComponentPlacement } from './preview';
import type { SpaceComponent } from '@plitzi/sdk-shared';

/** Which instance each component is shown as while it is edited, by component — kept for the next time it opens. */
const SHOWN_AS = 'builder-state.components.shownAs';

export type OpenComponent = {
  component?: SpaceComponent;
  scope: Record<string, unknown>;
  /** What it is drawn on: the ground around the instance it is shown as. */
  ground: ComponentGround;
  /** Every place it is drawn, and the one it is shown as. */
  placements: ComponentPlacement[];
  shownAs?: string;
  showAs: (instanceId: string) => void;
};

/**
 * The component open in the canvas, and the scope the builder is drawn in while it is.
 *
 * The scope lays the component's tree over the pages' — ids are one namespace, so every tool that finds an element by
 * id finds the component's — and hands its props the values of one of its instances (the first, or the one picked in
 * the banner), over their defaults: a component reads its words from its props, and with defaults alone most drew
 * empty. With nothing open it is empty, and a scope with nothing of its own reads straight through to the store.
 */
const useOpenComponent = (): OpenComponent => {
  const [[componentOpen, components, flat, platform]] = useBuilderStore([
    'componentOpen',
    'schema.components',
    'schema.flat',
    'style.platform'
  ]);
  const [shownAsBy, setShownAsBy] = useStorage<Record<string, string>>(SHOWN_AS, {});
  const component = componentOpen ? componentNamed({ components }, componentOpen) : undefined;
  const placements = useMemo(
    () => (component ? placementsOf({ flat, components }, component.id) : []),
    [component, flat, components]
  );
  const asked = component ? shownAsBy[component.id] : undefined;
  const shownAs =
    placements.find(placement => placement.instanceId === asked)?.instanceId ?? placements.at(0)?.instanceId;
  const preview = useMemo(
    () => (component ? previewOf({ flat, components }, { platform }, component, shownAs) : undefined),
    [component, flat, components, platform, shownAs]
  );
  const scope = useMemo(
    () =>
      component && preview ? { schema: { flat: component.flat }, runtime: { sources: { props: preview.props } } } : {},
    [component, preview]
  );

  return {
    component,
    scope,
    ground: preview?.ground ?? {},
    placements,
    shownAs,
    showAs: (instanceId: string) => {
      if (component) {
        setShownAsBy({ ...shownAsBy, [component.id]: instanceId });
      }
    }
  };
};

export default useOpenComponent;
