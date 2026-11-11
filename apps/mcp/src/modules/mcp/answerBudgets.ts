/**
 * Each answer's ceiling in tokens (four characters each), measured when it was set and a tenth more. Raised when an
 * answer grows because it says what an agent needs — said in the change; what is cut is what is said twice, never a
 * field. The answers made from the space alone are held on `largeSpace(30, 100, 200)` by `tests/answerBudgets.test.ts`;
 * those a host makes — the activity it reads, the page it renders — are held where the host runs them, against this
 * table (`HOST_ANSWERS`): Plitzi's in `plitzi-sdk-server`'s e2e.
 */
export const ANSWER_BUDGETS = {
  'plitzi://primer': 13400,
  'plitzi://schema/…/pages/{ref}': 4000,
  'plitzi://schema/…/elements/{ref}': 100,
  'plitzi://definitions': 540,
  'plitzi://types': 1560,
  'plitzi://global-styles': 50,
  'plitzi://interactions': 5100,
  'plitzi://style-variables': 50,
  plitzi_search: 5110,
  'plitzi_search include detail': 9340,
  plitzi_describe_operation: 230,
  'plitzi_describe_operation upsertElement': 910,
  plitzi_render: 32,
  // A page of the activity of a space twelve changes old: edits by two writers and an action that failed.
  plitzi_activity: 448
} as const;

/** The answers this package cannot make alone: a host measures them, on its own adapters. */
export const HOST_ANSWERS = ['plitzi_activity'] as const satisfies readonly (keyof typeof ANSWER_BUDGETS)[];
