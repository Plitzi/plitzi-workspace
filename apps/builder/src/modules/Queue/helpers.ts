import { CombinedGraphQLErrors } from '@apollo/client/core';

/** What one queued write answered: nothing when there was nothing to send, else what the network layer reported. */
export type QueueOutcome = { success: boolean; error?: string | Error } | null;

/** A write the server did not store. Nothing sent is not a failure — there was nothing to store. */
export const writeFailed = (outcome: QueueOutcome): boolean => outcome !== null && !outcome.success;

/**
 * Whether sending the same write again could change the answer.
 *
 * Only when the server never answered: a refusal it did answer — the change would break the space, the element is not
 * there — is its reading of that very change, and it reads it the same way every time.
 */
export const worthRetrying = (outcome: QueueOutcome): boolean =>
  writeFailed(outcome) && !CombinedGraphQLErrors.is(outcome?.error);
