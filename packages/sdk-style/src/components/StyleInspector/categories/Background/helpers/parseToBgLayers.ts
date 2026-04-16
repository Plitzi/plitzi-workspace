import { newLayerId, newStopId, parseBackgroundLayers } from '../helpers/backgroundParser';

import type { BackgroundLayer } from '../helpers/backgroundParser';
import type { StyleValue } from '@plitzi/sdk-shared';

export type LayerValues = Record<string, StyleValue | undefined>;

const parseToBgLayers = (values: LayerValues): BackgroundLayer[] => {
  const parsed = parseBackgroundLayers({
    'background-image': values['background-image'] as string | undefined,
    'background-size': values['background-size'] as string | undefined,
    'background-position': values['background-position'] as string | undefined,
    'background-repeat': values['background-repeat'] as string | undefined,
    'background-attachment': values['background-attachment'] as string | undefined,
    'background-clip': values['background-clip'] as string | undefined
  });

  return parsed.map(l => ({
    ...l,
    id: newLayerId(),
    stops: l.stops.map(s => ({ ...s, id: newStopId() }))
  }));
};
export default parseToBgLayers;
