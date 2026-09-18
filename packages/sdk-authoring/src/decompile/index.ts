/**
 * Reading a space back into code: the other direction from `authorSpace`.
 *
 * `specFromSpace` reads a pair of documents — an export from the builder, a seed checked in as JSON — into the
 * `SpaceSpec` that authors it, repairing what a builder that has moved on left behind and saying so.
 * `specToSource` writes that spec out as the TypeScript a person would write, and `compareSpaces` proves the round
 * trip: author the spec again and nothing observable differs from what was read.
 */

export * from './compareSpaces';
export * from './specFromSpace';
export * from './specToSource';
