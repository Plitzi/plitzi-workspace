/**
 * The interaction vocabulary: what a step can do, and what each action takes.
 *
 * Gathered from the sources that implement the actions rather than restated — a global callback's params are
 * declared once, beside the function that runs it, and are read from here by the builder's editor, by whatever
 * validates a flow and by the step builders below.
 */

export * from './globalCallbacks';
export * from './spaceCallbacks';
export * from './steps';
export * from './utilities';
