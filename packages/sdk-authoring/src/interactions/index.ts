/**
 * The interaction vocabulary: what a step can do, and what each action takes.
 *
 * Gathered from the sources that implement the actions rather than restated — a global callback's params are
 * declared once, beside the function that runs it, and are read from here by whatever validates a flow and by the
 * step builders. What the builder's own editor needs from the same declarations is
 * `@plitzi/sdk-shared/authoring/builder`, which runs in a browser and therefore cannot live here.
 */

export * from './globalCallbacks';
export * from './steps';
export * from './utilities';
