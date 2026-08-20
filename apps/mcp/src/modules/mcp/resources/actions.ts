import { actionTasksUri, actionUri, actionsUri, afterPrefix, findActionEntry } from '../helpers';
import { envelope } from './envelope';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';
import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * What a `runServerAction` step needs to know without opening the flow: what the action is called, whether it can
 * run at all, what starts it, and the two contracts a caller is held to. The steps themselves are one read away —
 * they are the longest part and the part a caller never has to know.
 */
const summarize = (entry: ActionEntry) => {
  const { document } = entry;

  return {
    ref: entry.id,
    name: document.name,
    ...(document.description === undefined ? {} : { description: document.description }),
    enabled: document.enabled,
    access: document.access,
    triggers: document.triggers.map(trigger => trigger.type),
    input: document.input,
    output: document.output
  };
};

export const actionSummaries = (space: Space) => ({ actions: space.actions.map(summarize) });

/**
 * Action reads: the space's action listing and one document in full.
 *
 * The item read returns the document verbatim, steps and credential references included. That is server-side state
 * a browser never sees, and an agent authoring one has to read back what it wrote — the document holds no secret
 * either way: `credentials` names them, it does not carry them.
 */
export const readActionResource = (
  space: Space,
  env: Env,
  uri: string
): ResourceEnvelope<unknown> | null | undefined => {
  if (uri === actionsUri(env)) {
    return envelope(actionSummaries(space));
  }

  // Before the ref branch, so the vocabulary is never mistaken for an action called "tasks".
  if (uri === actionTasksUri(env)) {
    return envelope({ tasks: space.actionTasks ?? [] });
  }

  const ref = afterPrefix(uri, actionUri(env, ''));
  if (ref === undefined) {
    return undefined;
  }

  const entry = findActionEntry(space, ref);

  return entry ? envelope({ ref: entry.id, document: entry.document }) : null;
};
