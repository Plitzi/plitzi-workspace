/**
 * Each answer's ceiling in tokens on `largeSpace(30, 100, 200)`, held by `answerBudgets.test.ts`: what was measured when
 * it was set, and a tenth more. Raised when an answer grows because it says what an agent needs — said in the change.
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
  'plitzi_describe_operation upsertElement': 910
} as const;
