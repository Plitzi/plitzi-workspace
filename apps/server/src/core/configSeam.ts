import { isActionDocument, validateActionDocument } from '@plitzi/sdk-shared/actions';
import { isConnectorManifestDraft, validateConnectorManifest } from '@plitzi/sdk-shared/connectors';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { serverLog } from '../helpers/serverLog';

import type { ActionDbDriver, ActionLookups, ActionsConfig } from '../modules/actions/types';
import type { ConnectorLookups } from '../modules/connectors/resolver';
import type { SpaceFunctions } from '../modules/functions/protocol';
import type {
  ActionDocument,
  ActionEntry,
  ActionLookupsConfig,
  ConnectorLookupsConfig,
  ConnectorManifest,
  ConnectorManifestDraft
} from '@plitzi/sdk-shared';

/*
 * The one seam where what the public config types as `unknown` becomes this package's own contract.
 *
 * `@plitzi/sdk-shared` describes a server's config without this package's internals, so a lookup hands back
 * `unknown` and a driver or a runner is `unknown` too. The documents a lookup reads — from a database, a file, another
 * service — are checked here with the validator the builder and the API save through, each as it is read: one that is
 * not a document is refused with what is wrong with it rather than run as if it were. The code a deployment hands in —
 * drivers, a runner, native functions — is checked once, as the server starts.
 */

/**
 * A guard that checks each object once: a deployment that caches what it reads hands back the same object on every
 * call, and a render must not pay for validating its action again.
 */
const checkedOnce = <T extends object>(guard: (value: unknown) => value is T) => {
  const seen = new WeakMap<object, boolean>();

  return (value: unknown): value is T => {
    if (!isRecord(value)) {
      return false;
    }

    const known = seen.get(value);
    if (known !== undefined) {
      return known;
    }

    const valid = guard(value);
    seen.set(value, valid);

    return valid;
  };
};

const isManifest = checkedOnce<ConnectorManifestDraft>(isConnectorManifestDraft);

const isDocument = checkedOnce<ActionDocument>(isActionDocument);

/** What `getFunctions` answers: built by `@plitzi/sdk-server/functions` from a space's saved bundle, a live object. */
const isSpaceFunctions = (value: unknown): value is SpaceFunctions =>
  isRecord(value) &&
  isRecord(value.bundle) &&
  typeof value.bundle.id === 'string' &&
  typeof value.bundle.load === 'function' &&
  isRecord(value.manifest);

/** What `getPluginFunctions` answers: a `SpaceFunctions` per plugin type. */
const isPluginFunctions = (value: unknown): value is Record<string, SpaceFunctions> =>
  isRecord(value) && Object.values(value).every(isSpaceFunctions);

/** Why a document is not one this server runs: the first problem its validator found, by where it is. */
const firstProblem = (errors: readonly { path: string; message: string }[]): string => {
  const first = errors.at(0);
  if (!first) {
    return 'it is not a document';
  }

  return first.path ? `${first.path}: ${first.message}` : first.message;
};

const manifestFrom = (found: unknown, spaceId: number, connectorId: string): ConnectorManifest | undefined => {
  if (found === undefined || found === null) {
    return undefined;
  }

  if (!isManifest(found)) {
    throw new Error(
      `Connector "${connectorId}" of space ${String(spaceId)} is not a manifest this server can run — ${firstProblem(validateConnectorManifest(found).errors)}`
    );
  }

  return { ...found, id: connectorId };
};

/** An action as a lookup found it: the entry, or why it is not one. */
const readAction = (found: unknown): { entry: ActionEntry } | { problem: string } => {
  const document = isRecord(found) ? found.document : undefined;
  if (!isRecord(found) || typeof found.id !== 'string') {
    return { problem: 'it has no id' };
  }

  return isDocument(document)
    ? { entry: { id: found.id, document } }
    : { problem: firstProblem(validateActionDocument(document).errors) };
};

const connectorSeams = new WeakMap<ConnectorLookupsConfig, ConnectorLookups>();

/** The connector lookups a deployment configured, each manifest checked as it is read. One per config object. */
export const connectorLookupsOf = (config: ConnectorLookupsConfig): ConnectorLookups => {
  const existing = connectorSeams.get(config);
  if (existing) {
    return existing;
  }

  const lookups: ConnectorLookups = {
    getConnector: async (spaceId, connectorId, at) =>
      manifestFrom(await config.getConnector(spaceId, connectorId, at), spaceId, connectorId),
    ...(config.getCredential ? { getCredential: config.getCredential } : {}),
    ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {})
  };
  connectorSeams.set(config, lookups);

  return lookups;
};

/**
 * The action lookups a deployment configured, each document checked as it is read. Asked for one, a document that is
 * not one is refused; listed, it is left out and said, so one broken action does not take its space's schedule down.
 */
export const actionLookupsOf = (config: ActionLookupsConfig): ActionLookups => {
  const { getConnector, getFunctions, getPluginFunctions, listActions } = config;

  return {
    getAction: async (spaceId, actionId, at) => {
      const found = await config.getAction(spaceId, actionId, at);
      if (found === undefined || found === null) {
        return undefined;
      }

      const read = readAction(found);
      if ('problem' in read) {
        throw new Error(
          `Action "${actionId}" of space ${String(spaceId)} is not a document this server can run — ${read.problem}`
        );
      }

      return read.entry;
    },
    ...(listActions
      ? {
          listActions: async (spaceId, at) =>
            (await listActions(spaceId, at)).flatMap(found => {
              const read = readAction(found);
              if ('problem' in read) {
                serverLog.warn('actions', `An action of space ${String(spaceId)} is left out — ${read.problem}`);

                return [];
              }

              return [read.entry];
            })
        }
      : {}),
    ...(config.listScheduledSpaces ? { listScheduledSpaces: config.listScheduledSpaces } : {}),
    ...(config.getCredential ? { getCredential: config.getCredential } : {}),
    ...(getConnector
      ? {
          getConnector: async (spaceId, connectorId, at) =>
            manifestFrom(await getConnector(spaceId, connectorId, at), spaceId, connectorId)
        }
      : {}),
    ...(getFunctions
      ? {
          getFunctions: async (spaceId, at) => {
            const found = await getFunctions(spaceId, at);
            if (found === undefined || found === null) {
              return undefined;
            }

            if (!isSpaceFunctions(found)) {
              throw new Error(
                `The functions of space ${String(spaceId)} are not what @plitzi/sdk-server/functions builds for one`
              );
            }

            return found;
          }
        }
      : {}),
    ...(getPluginFunctions
      ? {
          getPluginFunctions: async (spaceId, at) => {
            const found = await getPluginFunctions(spaceId, at);
            if (found === undefined || found === null) {
              return undefined;
            }

            if (!isPluginFunctions(found)) {
              throw new Error(
                `The plugin functions of space ${String(spaceId)} are not, by plugin type, what @plitzi/sdk-server/functions builds for one`
              );
            }

            return found;
          }
        }
      : {}),
    ...(config.getFlags ? { getFlags: config.getFlags } : {})
  };
};

const isFunction = (value: unknown): boolean => typeof value === 'function';

/** A driver as `createDbDrivers` builds one: the engine a credential names, and how to query it. */
const isDbDriver = (value: unknown): value is ActionDbDriver =>
  isRecord(value) && typeof value.engine === 'string' && isFunction(value.query);

/** The functions config as `@plitzi/sdk-server/functions` builds it: native definitions, a runner, ceilings. */
const isFunctionsConfig = (value: unknown): value is NonNullable<ActionsConfig['functions']> =>
  isRecord(value) &&
  (value.native === undefined || (Array.isArray(value.native) && value.native.every(isRecord))) &&
  (value.runner === undefined ||
    (isRecord(value.runner) && isFunction(value.runner.describe) && isFunction(value.runner.invoke))) &&
  (value.limits === undefined || isRecord(value.limits));

/** The deployment's database drivers, each held to what a `db` task calls — or why one is not, as the server starts. */
export const dbDriversOf = (drivers: readonly unknown[] | undefined): ActionDbDriver[] | undefined => {
  if (drivers === undefined) {
    return undefined;
  }

  const wrong = drivers.findIndex(driver => !isDbDriver(driver));
  if (wrong >= 0) {
    throw new Error(
      `action.dbDrivers[${String(wrong)}] is not a database driver: it needs an \`engine\` and a \`query\` function.`
    );
  }

  return drivers.filter(isDbDriver);
};

/** The deployment's functions config, held to what runs a space's code — or why it is not, as the server starts. */
export const functionsConfigOf = (config: unknown): ActionsConfig['functions'] => {
  if (config === undefined) {
    return undefined;
  }

  if (!isFunctionsConfig(config)) {
    throw new Error(
      '`functions` is not what @plitzi/sdk-server/functions configures: `native` definitions, a `runner` with `describe` and `invoke`, `limits`.'
    );
  }

  return config;
};
