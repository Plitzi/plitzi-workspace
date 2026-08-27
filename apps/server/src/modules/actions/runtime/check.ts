import { parseCron, triggerHasStaleVerify, triggerVerify } from '@plitzi/sdk-shared/actions';
import { hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { triggerParams } from './triggers';

import type { ActionDbDriver, ActionLookups, ActionTaskRegistry } from '../types';
import type { ActionCheckIssue, ActionCheckReport, ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

export type ActionCheckDeps = {
  spaceId: number;
  registry: ActionTaskRegistry;
  lookups: ActionLookups;
  dbDrivers?: ActionDbDriver[];
};

/** A value the check can reason about: a literal the author typed, not a template resolved at run time. */
const literal = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';

  return text && !hasValidToken(text) ? text : '';
};

/**
 * What only THIS deployment can answer about an action.
 *
 * `validateActionDocument` reads the document and nothing else, so it catches a flow that contradicts itself — a
 * step with no task, an output that names a step that does not exist. It cannot catch the other half, which is
 * every way a correct document meets a server that cannot run it: a task this deployment never registered, a
 * credential the space does not have, a key that is not in the credential it does have, a connector that was
 * deleted, a database engine with no driver, a cron that will never fire.
 *
 * Those are the failures that surface at 3am on the first real delivery, and an author has no way to see them
 * from the editor — which is why this runs on the server and answers in the same shape the validator does.
 *
 * It reads credentials to ask WHETHER they exist and whether they carry the key a step names. It never reports a
 * value, and nothing here runs a step.
 */
export const checkAction = async (entry: ActionEntry, deps: ActionCheckDeps): Promise<ActionCheckReport> => {
  const { spaceId, registry, lookups, dbDrivers = [] } = deps;
  const issues: ActionCheckIssue[] = [];
  const add = (level: ActionCheckIssue['level'], path: string, message: string, hint?: string) =>
    issues.push({ level, path, message, ...(hint === undefined ? {} : { hint }) });

  /** Answers once per identifier: a flow naming the same credential in four steps is one lookup, not four. */
  const credentials = new Map<string, Record<string, string> | undefined>();
  const credentialOf = async (identifier: string) => {
    if (!credentials.has(identifier)) {
      credentials.set(identifier, await lookups.getCredential?.(spaceId, identifier));
    }

    return credentials.get(identifier);
  };

  const checkCredential = async (node: ElementInteraction, identifier: string, field?: string) => {
    const path = `nodes.${node.id}.params.credential`;
    const credential = await credentialOf(identifier);
    if (!credential) {
      add(
        'error',
        path,
        `This space has no credential called "${identifier}"`,
        'Add it in Credentials, or name one that exists'
      );

      return undefined;
    }

    if (field && !(field in credential)) {
      add(
        'error',
        path,
        `The credential "${identifier}" has no key called "${field}"`,
        `It holds: ${Object.keys(credential).join(', ') || 'nothing'}`
      );
    }

    return credential;
  };

  const checkTrigger = async (node: ElementInteraction) => {
    const params = triggerParams(node);
    if (node.action === 'webhook') {
      if (triggerHasStaleVerify(params)) {
        add(
          'error',
          `nodes.${node.id}.params.signatureCredential`,
          'The signature check is in a format nothing reads any more, so this endpoint is refused outright',
          'Name the signing credential on the trigger step'
        );

        return;
      }

      const verify = triggerVerify(params);
      if (!verify) {
        add(
          'warning',
          `nodes.${node.id}.params.signatureCredential`,
          'This webhook verifies nothing: anyone who learns the URL can start it',
          'Name the credential holding the sender’s signing secret'
        );

        return;
      }

      const credential = await credentialOf(verify.credential);
      const field = verify.secretField ?? 'secret';
      if (!credential) {
        add(
          'error',
          `nodes.${node.id}.params.signatureCredential`,
          `This space has no credential called "${verify.credential}"`
        );

        return;
      }

      if (!(field in credential)) {
        add(
          'error',
          `nodes.${node.id}.params.signatureSecretField`,
          `The credential "${verify.credential}" has no key called "${field}"`,
          `It holds: ${Object.keys(credential).join(', ') || 'nothing'}`
        );

        return;
      }

      if (!credential[field]) {
        // Present and empty verifies every request against an empty secret, which is worse than not verifying:
        // it looks protected.
        add(
          'error',
          `nodes.${node.id}.params.signatureSecretField`,
          `The key "${field}" of "${verify.credential}" is empty`
        );
      }
    }

    if (node.action === 'schedule' && !parseCron(params.cron ?? '')) {
      add(
        'error',
        `nodes.${node.id}.params.cron`,
        `"${params.cron ?? ''}" is not an expression this server can fire`,
        'Five fields, UTC — minute hour day-of-month month day-of-week'
      );
    }
  };

  const checkTask = async (node: ElementInteraction) => {
    const task = registry.get(node.action);
    if (!task) {
      add(
        'error',
        `nodes.${node.id}.action`,
        `This server registers no task called "${node.action}"`,
        `It offers: ${registry
          .list()
          .map(entry => entry.name)
          .join(', ')}`
      );

      return;
    }

    const { params } = node;
    const connector = literal(params.connector);
    if (connector && !(await lookups.getConnector?.(spaceId, connector))) {
      add(
        'error',
        `nodes.${node.id}.params.connector`,
        `This space has no connector called "${connector}"`,
        'Add it in Connectors, or name one that exists'
      );
    }

    const identifier = literal(params.credential);
    if (!identifier) {
      return;
    }

    // `db.query` is the one task whose credential has to carry particular keys, and whose engine has to be one
    // this deployment registered a driver for — a flow naming Postgres on a server that only drivers MySQL fails
    // at the first query and nowhere earlier.
    if (node.action === 'db.query') {
      const credential = await checkCredential(node, identifier, 'dsn');
      const engine = credential?.engine ?? '';
      if (credential && !engine) {
        add(
          'error',
          `nodes.${node.id}.params.credential`,
          `The credential "${identifier}" declares no engine`,
          'Add an `engine` key naming the database, e.g. mysql'
        );

        return;
      }

      if (engine && !dbDrivers.some(driver => driver.engine === engine)) {
        add(
          'error',
          `nodes.${node.id}.params.credential`,
          `This server has no driver for "${engine}"`,
          dbDrivers.length > 0
            ? `It drives: ${dbDrivers.map(driver => driver.engine).join(', ')}`
            : 'It registers no database drivers at all'
        );
      }

      return;
    }

    await checkCredential(node, identifier);
  };

  for (const node of Object.values(entry.document.nodes)) {
    if (node.type === 'trigger') {
      await checkTrigger(node);
      continue;
    }

    if (node.type === 'task' && node.action) {
      await checkTask(node);
    }
  }

  return { valid: !issues.some(issue => issue.level === 'error'), issues };
};
