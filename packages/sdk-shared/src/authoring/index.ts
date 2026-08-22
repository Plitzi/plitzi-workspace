/**
 * The authoring vocabulary this package owns.
 *
 * Two things, and both are here because everything else depends on this package: the shape a declared param has —
 * shared by every catalog of actions in the SDK, in three different packages — and the binding transformers,
 * which live beside the runtime implementations they describe so the two cannot drift without a test saying so.
 *
 * What is NOT here is the adapter that turns a declared param into the control the builder draws: that produces
 * an `InteractionCallback`, which is `@plitzi/sdk-interactions`' registration API, and it lives with it.
 */

export * from './paramSpec';
export * from './transformers';
