import type { SpecCorrection } from '@plitzi/sdk-authoring';

/** What each kind of repair is, said the way someone reading the export would say it. */
const REPAIR_LABELS: Record<string, string> = {
  'legacy-element-type': 'Elements updated to today’s types',
  'unknown-element-type': 'Element types kept as they are',
  'dropped-field': 'Unused element fields removed',
  'dropped-attribute': 'Attributes nothing reads removed',
  'fixed-attribute': 'Attribute values corrected',
  'dropped-setting': 'Unused settings removed',
  'missing-element': 'References to missing elements removed',
  'unreachable-element': 'Elements no page contains removed',
  'folded-state-selector': 'Hover rules merged into their class',
  'dropped-selector': 'Selectors that cannot be authored removed',
  'unwritable-css': 'CSS kept in custom CSS',
  'unknown-style-state': 'Rules for unknown states removed',
  'broken-binding': 'Bindings to nothing removed',
  'fixed-binding-source': 'Binding sources corrected',
  'broken-flow': 'Broken interaction flows removed',
  'fixed-global-callback': 'Interaction targets corrected',
  'dropped-initial-state': 'Unsupported initial state removed',
  'missing-folder': 'References to missing folders removed',
  'broken-layout': 'Broken layout references removed'
};

export const repairLabel = (code: string): string => REPAIR_LABELS[code] ?? code;

export type CorrectionGroup = {
  code: string;
  label: string;
  total: number;
  messages: { text: string; count: number }[];
};

/** The repairs by kind, in the order each kind first appeared — the same repair made several times listed once. */
export const groupCorrections = (corrections: SpecCorrection[]): CorrectionGroup[] => {
  const groups = new Map<string, Map<string, number>>();
  for (const { code, message } of corrections) {
    const messages = groups.get(code) ?? new Map<string, number>();
    messages.set(message, (messages.get(message) ?? 0) + 1);
    groups.set(code, messages);
  }

  return [...groups].map(([code, messages]) => ({
    code,
    label: repairLabel(code),
    total: [...messages.values()].reduce((sum, count) => sum + count, 0),
    messages: [...messages].map(([text, count]) => ({ text, count }))
  }));
};
