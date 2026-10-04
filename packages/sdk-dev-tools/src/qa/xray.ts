import type { ElementDefinition } from '@plitzi/sdk-shared';

/**
 * What the document wires to an element that its box does not show: where its values come from, what it does when
 * used, whether it may be hidden, how it moves and the flag it exists under. The x-ray draws every element's box — its
 * type and id when pointed at — and marks each kind of wiring on it, which is what a tester needs to know before
 * asking why something shows, moves or does what it does.
 */
export const XRAY_MARKS = ['data', 'visibility', 'flows', 'motion', 'flag'] as const;

export type XrayMark = (typeof XRAY_MARKS)[number];

/** The wiring the x-ray colours: every kind, one, or none — the boxes alone. */
export type XrayFilter = XrayMark | 'all' | 'none';

/** The attribute the x-ray marks an element with, its value the marks it carries. */
export const XRAY_ATTRIBUTE = 'data-plitzi-qa-xray';

export const XRAY: Record<XrayMark, { label: string; description: string; colour: string }> = {
  data: {
    label: 'Bound to data',
    description: 'A value of it — a text, a style, a state — is read from a binding',
    colour: '#0ea5e9'
  },
  visibility: {
    label: 'Shown on a condition',
    description: 'Whether it shows is bound, or it starts hidden',
    colour: '#f59e0b'
  },
  flows: { label: 'Runs a flow', description: 'Something done to it starts an interaction', colour: '#ec4899' },
  motion: { label: 'Moves', description: 'It arrives, or keeps moving, by its declared motion', colour: '#10b981' },
  flag: { label: 'Behind a flag', description: 'It exists only while a feature flag says so', colour: '#8b5cf6' }
};

export type XrayCounts = Record<XrayMark, number>;

export const NO_XRAY_COUNTS: XrayCounts = { data: 0, visibility: 0, flows: 0, motion: 0, flag: 0 };

const isVisibility = (to: string): boolean => to === 'visibility';

/** The marks an element's definition earns, in the order of {@link XRAY_MARKS}. */
export const xrayMarksOf = (definition: ElementDefinition): XrayMark[] => {
  const bindings = Object.entries(definition.bindings ?? {}).flatMap(([category, list]) =>
    list.filter(binding => binding.enabled !== false).map(binding => ({ category, to: binding.to }))
  );
  const bindsVisibility = bindings.some(({ category, to }) => category === 'initialState' && isVisibility(to));
  const marks: Record<XrayMark, boolean> = {
    data: bindings.some(({ category, to }) => !(category === 'initialState' && isVisibility(to))),
    visibility: bindsVisibility || definition.initialState?.visibility === false,
    flows: Object.values(definition.interactions ?? {}).some(interaction => interaction.enabled),
    motion: definition.motion?.enter !== undefined || definition.motion?.loop !== undefined,
    flag: definition.flag !== undefined
  };

  return XRAY_MARKS.filter(mark => marks[mark]);
};
