/**
 * The step that marks where a server action's undo begins.
 *
 * Steps after it run only when a step before it failed, so an action can give back what it already did — seats it took,
 * a row it wrote — instead of leaving it behind a failure. Named once because four places read it: the runner that jumps
 * to it, the validator that checks where it sits, the authoring API that writes it and the task catalog that offers it.
 */
export const FAILURE_HANDLER_TASK = 'flow.onFailure';
