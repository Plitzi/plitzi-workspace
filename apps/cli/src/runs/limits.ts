import { SCOPE_SPIKE } from './spike';

/**
 * How long a piece of a run's work goes before something is likely wrong (Carlos: "si una tarea demora más de 10
 * minutos normalmente algo suele estar mal"): a task, a spike after the scope — what the agents find as they go is
 * small. Past it the lead is woken to ask where it stands, and again at each limit more.
 */
export const WORK_LIMIT_MINUTES = 10;

/** The run's scope, the one spike that reads the whole job: its limit. */
export const SCOPE_LIMIT_MINUTES = 30;

/** A task's limit: the scope's, or any other piece's. */
export const workLimitOf = (taskId: string): number =>
  taskId === SCOPE_SPIKE ? SCOPE_LIMIT_MINUTES : WORK_LIMIT_MINUTES;
