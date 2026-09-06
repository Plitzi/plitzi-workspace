import { validateConnectorManifest } from '@plitzi/sdk-shared/connectors';

import { warnOnce } from './context';
import { findConnectorEntry } from '../../../helpers';
import { toManifest } from '../../operations/connectors';

import type { ValidationCtx } from './context';
import type { Space } from '../../../helpers';
import type { Operation } from '../../operations';

// Connector checks, in two directions: the manifest an op writes must be one the engine can execute, and a
// provider element must name a connector, an endpoint and operators that exist.

/** Run the one shared manifest validator and fold its report into the batch result. Errors reject the batch;
 *  warnings ride along — notably "reads {{credential.…}} but names no credential", which is expected here: the
 *  agent authors the manifest and the space owner attaches the secret afterwards. */
const checkManifest = (manifest: unknown, base: string, ctx: ValidationCtx): void => {
  const report = validateConnectorManifest(manifest);
  for (const issue of report.errors) {
    ctx.errors.push({
      path: issue.path ? `${base}.${issue.path}` : base,
      message: issue.message,
      hint: issue.hint ?? 'Read plitzi://guide (Connectors) for the manifest shape'
    });
  }

  for (const issue of report.warnings) {
    warnOnce(ctx, `${base}.${issue.path}: ${issue.message}${issue.hint ? ` — ${issue.hint}` : ''}`);
  }
};

/** Connectors this batch creates, so an element wired to one earlier in the same batch is not reported missing. */
export const batchDeclaredConnectors = (ops: Operation[]): Set<string> => {
  const refs = new Set<string>();
  for (const op of ops) {
    if (op.type === 'upsertConnector') {
      refs.add(op.ref);
    }
  }

  return refs;
};

export const checkConnectorOp = (space: Space, op: Operation, base: string, ctx: ValidationCtx): void => {
  if (op.type === 'upsertConnector') {
    checkManifest(toManifest(op), base, ctx);

    return;
  }

  if (op.type !== 'deleteConnector') {
    return;
  }

  // Removing a connector is not a local edit: every provider pointing at it stops resolving and its page renders
  // empty. Name the elements, so "confirm with the user" is a question they can actually answer.
  const inUse = Object.values(space.schema.flat)
    .filter(el => el.attributes.connector === op.ref)
    .map(el => el.id);
  if (inUse.length > 0) {
    warnOnce(
      ctx,
      `Connector "${op.ref}" still feeds ${inUse.length} element(s) (${inUse.join(', ')}). Deleting it leaves them ` +
        'resolving to no data. Confirm with the user, and repoint or remove those elements too.'
    );
  }
};

/** A provider element's props. Read as an open bag of unknowns — they are agent-authored, so `connector`,
 *  `endpoint` and `filters` are claims to verify, not fields to trust. */
type ProviderProps = Record<string, unknown>;

const asString = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

/**
 * A provider element checked against the connector it names.
 *
 * These are warnings, not errors, and deliberately: the connector store is a different document from the schema,
 * so an element may legitimately be authored before (or after) the connector it points at — and a batch that
 * refuses the page because the connector is not there yet would make the two impossible to write in either order.
 * What the agent must not do is walk away believing a page is wired when it resolves to nothing.
 */
export const checkProviderElement = (
  space: Space,
  ctx: ValidationCtx,
  ref: string,
  runtime: string | undefined,
  props: ProviderProps | undefined,
  batchConnectors: Set<string>,
  base: string
): void => {
  const connectorId = asString(props?.connector);
  if (!connectorId) {
    if (runtime === 'server') {
      warnOnce(
        ctx,
        `"${ref}" at ${base} renders on the server but names no connector, so it resolves to no data. Set its ` +
          '`connector` prop to one the space has (read plitzi://connectors).'
      );
    }

    return;
  }

  // The opposite mistake, and the more common one: the connector attributes are set but the element still renders
  // in the browser, where they mean nothing — the page silently shows an empty list.
  if (runtime !== 'server') {
    warnOnce(
      ctx,
      `"${ref}" at ${base} names connector "${connectorId}" but is not server-rendered, so the connector is ` +
        'IGNORED and the element fetches its own `query` from the browser instead. Set runtime: "server" on it.'
    );
  }

  const entry = findConnectorEntry(space, connectorId);
  if (!entry) {
    if (!batchConnectors.has(connectorId)) {
      warnOnce(
        ctx,
        `Connector "${connectorId}" at ${base} is not configured in this space, so "${ref}" resolves to no data. ` +
          'Read plitzi://connectors, or create it with upsertConnector.'
      );
    }

    return;
  }

  const endpoint = asString(props?.endpoint);
  const reads = Object.keys(entry.manifest.endpoints.read);
  if (endpoint !== undefined && !reads.includes(endpoint)) {
    ctx.errors.push({
      path: `${base}.props.endpoint`,
      message: `Connector "${connectorId}" has no read endpoint named "${endpoint}"`,
      hint: 'Name one the connector declares, or add it with patchConnector',
      validValues: reads
    });
  }

  // A filter naming an operator the manifest does not declare is DROPPED by the engine — the query runs unfiltered
  // and returns the wrong records rather than none, so this is an error even though nothing throws.
  const operators = Object.keys(entry.manifest.operators ?? {});
  if (!Array.isArray(props?.filters)) {
    return;
  }

  props.filters.forEach((filter, i) => {
    if (filter === null || typeof filter !== 'object') {
      return;
    }

    const operator = asString((filter as { operator?: unknown }).operator);
    if (operator !== undefined && !operators.includes(operator)) {
      ctx.errors.push({
        path: `${base}.props.filters[${i}].operator`,
        message: `Connector "${connectorId}" declares no operator "${operator}", so this filter is dropped and the query returns unfiltered records`,
        hint: 'Use an operator the connector declares, or add it with patchConnector',
        validValues: operators
      });
    }
  });
};
