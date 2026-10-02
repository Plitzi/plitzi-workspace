import { flagUserFromSSR, flagValues, resolveFlags, undeclaredFlagOverrides } from '@plitzi/sdk-shared/flags';

import { serverFlagsFor } from '../../../helpers/flagOverrides';
import { serverLog } from '../../../helpers/serverLog';

import type { ActionRunRequest, ActionsConfig } from '../types';

const reading = new WeakMap<object, boolean>();

/**
 * Whether a flow names `flags` anywhere — a template, a `when` rule's field. Only those are worth a lookup: most flows
 * read no flag, and asking for the space's flags on every run of every one of them would be a read per click.
 *
 * Over the serialized document, so a template in any step's params counts without knowing every step's shape. A word
 * `flags` that is not the source costs one lookup that was not needed, never a flow without its flags. Kept per
 * document, which the lookups hand out once per version.
 */
export const readsFlags = (document: object): boolean => {
  const known = reading.get(document);
  if (known !== undefined) {
    return known;
  }

  const reads = /\bflags\b/.test(JSON.stringify(document));
  reading.set(document, reads);

  return reads;
};

/**
 * The space's flags as this run sees them: what the space declares at the run's revision, matched against the run's
 * environment and visitor, then the server's own layer and a tester's forced one — the same order a page resolves
 * them in. A run has no URL, so a rule on the host or the route does not match here.
 */
export const flagsForRun = async (
  config: Pick<ActionsConfig, 'lookups' | 'flags'>,
  request: Pick<ActionRunRequest, 'entry' | 'spaceId' | 'environment' | 'at' | 'user' | 'forcedFlags'>
): Promise<Record<string, boolean>> => {
  if (!readsFlags(request.entry.document)) {
    return {};
  }

  const { getFlags } = config.lookups;
  if (!getFlags) {
    serverLog.warn(
      'Actions',
      `Action "${request.entry.id}" reads flags, but this deployment's action lookups have no getFlags: it sees none.`
    );

    return {};
  }

  const declared = await getFlags(request.spaceId, request.at);
  const { spaceId, environment, user } = request;
  const overrides = { server: serverFlagsFor(config, { spaceId, environment }), qa: request.forcedFlags };
  undeclaredFlagOverrides(declared, { server: overrides.server }).forEach(({ name }) =>
    serverLog.warn('Actions', `The server sets the flag "${name}", which space ${spaceId} does not declare.`)
  );

  return flagValues(resolveFlags(declared, { environment, user: flagUserFromSSR(user) }, overrides));
};
