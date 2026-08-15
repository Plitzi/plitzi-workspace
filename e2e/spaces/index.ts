import { readOfflineData } from '@plitzi/example-space';

import { minimalSpace } from './minimal';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export * from './minimal';

/** The spaces the suite renders.
 *
 *  Two kinds, and the difference matters. The **sample space** is the one the examples ship, so rendering it here
 *  is a parity check: what a reader following the docs sees is what these specs see. The **built spaces** are the
 *  suite's own — small, hand-written and free to change — for the cases a test wants to isolate one element type,
 *  one binding, one style rule, without touching an artifact that exists to teach somebody. */

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

export { minimalSpace };
