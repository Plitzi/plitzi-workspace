import { readOfflineData } from '@plitzi/example-space';

import { actionSpace } from './actions';
import { minimalSpace } from './minimal';
import { plainSpace } from './plain';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export * from './actions';
export * from './minimal';
export * from './plain';

/** The spaces the suite renders.
 *
 *  Pick per test — a spec should render the smallest space that can still show what it is about.
 *
 *  | Space | What it is for |
 *  |---|---|
 *  | `plainSpace()` | **The default.** A whole page — headings, copy, cards, an image — from element types the SDK ships and nothing else |
 *  | `minimalSpace()` | Two elements and a stylesheet, for when thirty around them would only add thirty possible causes to a failure |
 *  | `authSpace()` | Four pages, guest and member, with bindings onto the session |
 *  | `sampleSpace()` | The one the examples ship. A parity check — what a reader following the docs sees |
 *  | `actionSpace()` | Two `runtime: 'server'` providers — one fed by an action, one naming a producer this deployment does not have |
 *
 *  Only `sampleSpace()` carries **custom plugins** (its three RSC elements), and only a deployment that provides
 *  their components can render it whole. Anywhere else it draws "Component … Not Found" where they should be, so
 *  it belongs in the specs that are about RSC and nowhere else. */

export const sampleSpace = (): OfflineDataRaw => readOfflineData();

/** The sample space with one element's props overridden — the usual shape of "same page, one thing different". */
export const sampleSpaceWith = (id: string, props: Record<string, unknown>): OfflineDataRaw => {
  const data = sampleSpace();

  if (!(id in data.schema.flat)) {
    throw new Error(`No element "${id}" in the sample space`);
  }

  const node = data.schema.flat[id];

  return {
    ...data,
    schema: {
      ...data.schema,
      flat: { ...data.schema.flat, [id]: { ...node, attributes: { ...node.attributes, ...props } } }
    }
  };
};

/** Ids worth naming, so a spec reads as intent rather than as a hex string. */
export const SAMPLE_IDS = {
  page: '655221a12565b83ac5060e20',
  mainHeading: '65522cc49b57167ea7a2a076',
  logo: '655226c2a62ab65a53302504'
};

export { actionSpace, minimalSpace, plainSpace };
