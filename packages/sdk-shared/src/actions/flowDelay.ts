/**
 * The longest a `flow.delay` step waits, in ms. A run holds a connection and a concurrency slot its whole life, so a
 * longer wait spends both on nothing: anything longer is a schedule, not a step. Read by the step that caps a bound
 * value to it, saying so on its log, and by the validator that refuses a longer one written as it is.
 */
export const FLOW_DELAY_MAX_MS = 5000;
