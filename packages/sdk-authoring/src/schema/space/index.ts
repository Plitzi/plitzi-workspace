/**
 * `authorSpace`: a `SpaceSpec` written as the documents the builder and the renderer read — one author (`author`) that
 * writes the space's styles, pages and layouts, and elements, after the checks of its shape; and, on the same writing,
 * what a fix would change (`fixes`) and where each element and class of the spec ended up (`locate`).
 */

export { PAGE_SPEC_FIELDS } from './values';
export { authorSpace } from './author';
export { planFixes } from './fixes';
export type { FixPlan, PlanProblem, PlannedFix, SpecEdit } from './fixes';
export { locateClasses, locateElements } from './locate';
export type { WrittenClass, WrittenElement } from './locate';
