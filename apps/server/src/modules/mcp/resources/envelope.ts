import { computeVersion } from '../helpers';

import type { ResourceEnvelope } from '../types';

/** Wrap any read projection with the version its optimistic-concurrency checks key on. */
export const envelope = <T>(data: T): ResourceEnvelope<T> => ({ stateVersion: computeVersion(data), data });

export const jsonContents = (uri: string, data: unknown) => ({
  contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }]
});
