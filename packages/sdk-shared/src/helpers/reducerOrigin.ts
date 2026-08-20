/**
 * Whether a reducer action is this session's user editing — the only kind of change the undo history and the save
 * queue are for.
 *
 * Two kinds of dispatch look like an edit and are not. `fromSubscriptions` is another session's edit arriving over
 * the space stream: an agent writing through the MCP, or a collaborator. `queryFailed` is the save queue putting
 * back the state a rejected mutation left behind. Recording either as undoable hands the user a button that reverts
 * work this session never did — an agent's whole apply, in one click — and re-queueing either sends the server a
 * change it just gave us, or just refused.
 */
export type ReducerActionOrigin = { fromSubscriptions?: boolean; queryFailed?: boolean };

export const isUserEdit = (action: ReducerActionOrigin): boolean => !action.fromSubscriptions && !action.queryFailed;
