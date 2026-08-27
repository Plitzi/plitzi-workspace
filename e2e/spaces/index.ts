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
export const sampleSpaceWith = (ref: string, props: Record<string, unknown>): OfflineDataRaw => {
  const data = sampleSpace();
  const id = sampleId(ref, data);
  const node = data.schema.flat[id];

  return {
    ...data,
    schema: {
      ...data.schema,
      flat: { ...data.schema.flat, [id]: { ...node, attributes: { ...node.attributes, ...props } } }
    }
  };
};

/**
 * The elements a spec addresses, by the NAME the space gives them.
 *
 * Not their ids: those are derived from the declaration that authors the space, so a hex string written down here
 * is a copy of a hash that changes whenever somebody adds an element above it — and it fails as "no such element"
 * long after the edit that moved it. `examples/shared-space/space.ts` gives these three an `idRef` for exactly this
 * reason, which is also the spelling the MCP takes (`pageRef`/`ref` are "ref or id").
 */
export const SAMPLE_REFS = {
  page: 'home',
  mainHeading: 'mainHeading',
  logo: 'logo'
};

/** The document id of a named element, for the places that can only be given one. */
export const sampleId = (ref: string, data: OfflineDataRaw = sampleSpace()): string => {
  const found = Object.values(data.schema.flat).find(element => element.idRef === ref);

  if (!found) {
    throw new Error(`No element named "${ref}" in the sample space`);
  }

  return found.id;
};

export { actionSpace, minimalSpace, plainSpace };
