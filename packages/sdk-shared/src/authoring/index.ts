/**
 * The authoring vocabulary this package owns.
 *
 * Two things, and both are here because everything else depends on this package: the shape a declared param has —
 * shared by every catalog of actions in the SDK — and the binding transformers, which live beside the runtime
 * implementations they describe so the two cannot drift without a test saying so.
 */

export * from './builder';
export * from './paramSpec';
export * from './transformers';
