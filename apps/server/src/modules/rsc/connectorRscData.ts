import { serverQueryOf } from '@plitzi/sdk-shared/schema';

import { createActionResolver } from '../actions/runtime/renderResolver';
import { createConnectorResolver } from '../connectors';
import { externalQueryReader } from './externalQueryReader';
import { dataLookupResolver, publicFileResolver } from './publicFileResolver';
import { resolveRscData } from './resolveRscData';

import type { OutboundOptions } from '../../helpers/outboundGuard';
import type { ActionsModule } from '../actions';
import type { RscElementResolver } from './resolveRscData';
import type { ProjectDataLookup } from '../actions/runtime/projectData';
import type { ActionLookups } from '../actions/types';
import type { ConnectorLookups } from '../connectors/resolver';
import type { SSRAdapters } from '@plitzi/sdk-shared';

/**
 * `getRscData`, built from the producers the server was already given — connectors, actions, its own static files.
 *
 * Every deployment that served server-driven elements wrote this same adapter: await the render payload, check the
 * schema opted into RSC, then hand `resolveRscData` a resolver over the lookups — all of which are this package's
 * own exports, assembled by the consumer only because nothing assembled them here. That made the lookups a thing
 * you passed twice, once as config and once folded into an adapter, and put a copy of the enabled check in every
 * deployment.
 *
 * Either half may be absent: a space whose server elements all name actions configures no connectors, and an
 * element naming a producer this deployment does not have resolves to nothing rather than to an error — the same
 * answer it gets for a connector the space never created.
 *
 * A deployment that resolves server elements some other way still supplies its own `getRscData`, and that one wins.
 */
export const connectorRscData = ({
  connectors,
  actions,
  publicDir,
  data,
  elementTimeoutMs,
  sayFailures = false,
  outbound
}: {
  connectors?: ConnectorLookups;
  actions?: { lookups: ActionLookups; module: ActionsModule };
  /** Where the server's static files are: a provider whose `query` is one of them is read from disk. */
  publicDir?: string;
  /**
   * The space's data, never served: a provider whose `query` is `/data/<file>` is read from it — the lookup a
   * deployment gave, or the one `createServer` derives from `dataDir`.
   */
  data?: ProjectDataLookup;
  /** The deployment's per-element ceiling, when it set one. `resolveRscData` decides the default. */
  elementTimeoutMs?: number;
  /** While developing: a failed element says why where the page reads it. */
  sayFailures?: boolean;
  /** The deployment's own origins a connector or a query may reach on its network (`outbound.privateOrigins`). */
  outbound?: OutboundOptions;
}): NonNullable<SSRAdapters['getRscData']> => {
  const resolveConnector = connectors ? createConnectorResolver(connectors, outbound) : undefined;
  const resolveAction = actions ? createActionResolver(actions.lookups, actions.module) : undefined;
  const resolvePublicFile = publicDir ? publicFileResolver(publicDir) : undefined;
  const resolveDataFile = data ? dataLookupResolver(data) : undefined;
  const readExternal = externalQueryReader({ outbound });

  /**
   * An element names ONE producer, and which one decides how its data is fetched.
   *
   * A connector is the declarative read and stays the default; an action is the read a manifest cannot express; a
   * file of the server's own is the read with no backend at all, and another site's address is asked as the browser
   * would have asked it (`externalQueryResolver`). Checked in that order so an element carrying more
   * than one keeps resolving the way its page already renders, instead of silently changing under them.
   */
  const resolveElement: RscElementResolver = async context => {
    const attributes = context.element.attributes as { connector?: string; action?: string };
    if (attributes.connector) {
      return resolveConnector ? resolveConnector(context) : undefined;
    }

    if (attributes.action) {
      return resolveAction ? resolveAction(context) : undefined;
    }

    // A query the page server cannot read is said, never resolved to nothing: authoring refuses it
    // (`server-query-unresolved`), and a document written before that rule says why where the page reads it.
    const query = serverQueryOf(context.element, context.templateData);
    if (query === undefined) {
      return undefined;
    }

    if (query.kind === 'unresolved') {
      throw new Error(`the page server cannot read its query: ${query.why}`);
    }

    if (query.kind === 'url') {
      return readExternal(query, context.signal);
    }

    // A file is read at the path its template came to, as the browser would have asked for it.
    const atPath = {
      ...context,
      element: { ...context.element, attributes: { ...context.element.attributes, query: query.path } }
    };
    // The project's data first — its folder, or the space's as the platform keeps it, read through one lookup:
    // `/data/…` is its, wherever `publicDir` has a folder of that name.
    const fromData = resolveDataFile ? await resolveDataFile(atPath) : undefined;
    const fromFile =
      fromData !== undefined ? fromData : resolvePublicFile ? await resolvePublicFile(atPath) : undefined;
    if (fromFile === undefined) {
      throw new Error(`no file of this server's answers ${query.path}`);
    }

    return fromFile;
  };

  return async ({ req, spaceId, environment, user, ids, loadOfflineData, flagOverrides, signal }) => {
    // Joins the read the page render already started rather than asking for the document a second time.
    const offlineData = await loadOfflineData();
    // On unless the space turns it off, as the page render decides it: a space the builder or the MCP made never says.
    if (!offlineData || offlineData.schema.rsc?.enabled === false) {
      return {};
    }

    return resolveRscData({
      schema: offlineData.schema,
      req,
      spaceId,
      environment,
      user,
      ids,
      resolveElement,
      ...(flagOverrides ? { flagOverrides } : {}),
      ...(signal ? { signal } : {}),
      ...(elementTimeoutMs === undefined ? {} : { timeoutMs: elementTimeoutMs }),
      sayFailures
    });
  };
};
