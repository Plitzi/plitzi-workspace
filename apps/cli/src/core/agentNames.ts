/**
 * How an agent of a run is named on every command: read by the run's own commands and by the usage every command
 * records, so it is kept apart from the identity's checks (`runs/agents/identity.ts`), which only a run's commands load.
 */

/** An agent's token: its run, its name, its secret — told apart from a task's (`<run>.<task>.<secret>`) by the `@`. */
export const AGENT_TOKEN = /^([a-z0-9][a-z0-9_-]*)\.@([a-z0-9][a-z0-9_-]*)\.([0-9a-f]{32})$/;

/** Who reads what anyone may read, saying nothing of itself (`runOf`'s `anyone`): no lead, no agent. */
export const UNNAMED = 'unnamed';
