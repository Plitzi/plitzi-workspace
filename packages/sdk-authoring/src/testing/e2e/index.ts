export { answered, dragElement, giveValue, hiddenAtWidth, shownCopy, valueFieldIn } from './act';
export type { Copy } from './act';
export { e2e } from './define';
export {
  awaitHydration,
  endlesslyMovedInPage,
  FIELD,
  fieldsOf,
  hoverElement,
  HYDRATION_MS,
  locateField,
  locateTarget,
  pressFailure,
  pressOnce,
  settle,
  targetId,
  targetOf
} from './page';
export type { E2eElement, E2eLocator, E2ePage } from './page';
export { EDGES, parseRelation, relationElements, relationHolds, sidePx } from './position';
export type { Box, Edge, Relation, RelationSide, RelationSign } from './position';
export { e2eTestProblems, journeyStartWarnings, testAccountWarnings } from './problems';
export { e2eResultText, journeyAccount, runE2eTest } from './run';
export { bridge, isExpectation, playE2eStep } from './play';
export type { Located, StepPlay, StepPlayed } from './play';
export {
  durationMs,
  E2E_STEP_USAGE,
  e2eStepText,
  isE2eStepWord,
  leadingTarget,
  MAX_WAIT_FOR_MS,
  parseE2eStep,
  parseE2eSteps,
  stepLines,
  unquoted
} from './stepText';
export type { E2eResult, E2eRunOptions, E2eStepResult } from './run';
