import type { SpecCorrection, SpecCorrectionCode } from '@plitzi/sdk-authoring';

/**
 * What each kind of repair is, said the way someone reading the export would say it — one for every code the reader
 * can give, so a new one fails the build until it is named here.
 */
const REPAIR_LABELS: Record<SpecCorrectionCode, string> = {
  'legacy-element-id': 'Element ids renamed to their names',
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
  'folded-custom-css': 'Custom CSS merged into its class',
  'unknown-style-state': 'Rules for unknown states removed',
  'broken-binding': 'Bindings to nothing removed',
  'fixed-binding-source': 'Binding sources corrected',
  'broken-flow': 'Broken interaction flows removed',
  'dead-flow': 'Flows on events that never fire removed',
  'dead-step': 'Steps nothing answers removed',
  'fixed-global-callback': 'Interaction targets corrected',
  'dropped-initial-state': 'Unsupported initial state removed',
  'dropped-param': 'Parameters a step does not take removed',
  'missing-folder': 'References to missing folders removed',
  'broken-layout': 'Broken layout references removed'
};

export const repairLabel = (code: SpecCorrectionCode): string => REPAIR_LABELS[code];

/** Removed, corrected or kept: what the reader DID, which is what the icon beside a kind of repair says. */
export const repairIcon = (code: SpecCorrectionCode): string => {
  if (
    code.startsWith('fixed-') ||
    code === 'folded-state-selector' ||
    code === 'folded-custom-css' ||
    code === 'legacy-element-id'
  ) {
    return 'fa-solid fa-wrench';
  }

  if (code === 'unwritable-css' || code === 'unknown-element-type') {
    return 'fa-solid fa-box-archive';
  }

  return 'fa-solid fa-eraser';
};

/** A stretch of a message; `key` is its place in the message, which is fixed — a message is never reordered. */
export type MessagePart = { key: string; text: string; code: boolean };

/**
 * A repair message, with the names in it — `"listItem-bOPK"`, `"_blank"` — set apart from the prose around them.
 *
 * The reader quotes every name it mentions, so the quotes are what mark them: the parts between them are what a person
 * scans a list of repairs for, and reading them as code is what tells one from the sentence around it.
 */
export const messageParts = (message: string): MessagePart[] =>
  message
    .split(/"([^"]*)"/)
    .map((text, index) => ({ key: String(index), text, code: index % 2 === 1 }))
    .filter(part => part.text !== '');

export type CorrectionGroup = {
  code: SpecCorrectionCode;
  label: string;
  total: number;
  messages: { text: string; count: number }[];
};

/** The repairs by kind, in the order each kind first appeared — the same repair made several times listed once. */
export const groupCorrections = (corrections: SpecCorrection[]): CorrectionGroup[] => {
  const groups = new Map<SpecCorrectionCode, Map<string, number>>();
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
