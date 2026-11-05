import { runsFleetJobs } from '@plitzi/sdk-kernel/http';
import { privateOriginsOf } from '@plitzi/sdk-kernel/outbound';

import { ACTIONS_FLEET_STORES } from '../engine/fleet';
import { actionsModuleFor } from '../engine/moduleFor';
import { realtimeModuleFor } from '../realtime';
import { actionOriginProblem, publishedActionEndpoint } from './origin';
import { createActionStage } from './stages/action';
import { createFunctionRoutesStage } from './stages/functionRoutes';
import { createRealtimeStage } from './stages/realtime';
import { createConnectorResolver } from '../connectors/connectors';
import { actionLookupsOf, connectorLookupsOf } from '../engine/configSeam';
import { createActionResolver } from '../engine/runtime/renderResolver';
import { isFunctionsDefinition } from '../functions/load';

import type { EngineServerConfig } from '../types';
import type { PageEngine, RscElementResolver } from '@plitzi/sdk-kernel/engine';

/**
 * The actions engine as a page server is handed it (RFC 0032, D11): the actions module, the realtime channels and the
 * connectors' writes, each built once from the engine's own configuration — `action`, `functions`, `connectors`,
 * `realtime` — and nothing of the page server's. Undefined when there is nothing of the engine to run.
 *
 * Its stages close over what it built, so they read nothing of the server they are mounted in: the same ones answer in
 * a page server and in a worker.
 */
export const createPageEngine = (config: EngineServerConfig): PageEngine | undefined => {
  const problem = actionOriginProblem(config.action, 'pages');
  if (problem) {
    throw new Error(problem);
  }

  const actions = actionsModuleFor(config);
  const realtime = realtimeModuleFor(config);
  const connectors = config.connectors ? connectorLookupsOf(config.connectors) : undefined;
  if (!actions && !realtime && !connectors) {
    return undefined;
  }

  const resolveConnector = connectors
    ? createConnectorResolver(connectors, { privateOrigins: privateOriginsOf(config.outbound?.privateOrigins) })
    : undefined;
  const lookups = config.action?.lookups ? actionLookupsOf(config.action.lookups) : undefined;
  const resolveAction = actions && lookups ? createActionResolver(lookups, actions) : undefined;
  // An element names ONE producer: a connector stays the default, an action the read a manifest cannot express.
  const resolveElement: RscElementResolver = context => {
    const attributes = context.element.attributes as { connector?: string; action?: string };
    if (attributes.connector) {
      return resolveConnector ? resolveConnector(context) : Promise.resolve(undefined);
    }

    return attributes.action && resolveAction ? resolveAction(context) : Promise.resolve(undefined);
  };

  return {
    endpoints: [
      ...(actions || connectors ? [createActionStage(config, actions)] : []),
      ...(realtime ? [createRealtimeStage(realtime)] : [])
    ],
    routes: actions ? [createFunctionRoutesStage(actions)] : [],
    ...(realtime ? { upgrades: (path: string) => path === realtime.path } : {}),
    resolveElement,
    ...(lookups?.getData ? { data: lookups.getData } : {}),
    published: {
      ...(actions || connectors ? { actionPath: publishedActionEndpoint(config.action) } : {}),
      ...(realtime ? { realtimePath: realtime.path, realtimeTransport: realtime.transport } : {})
    },
    // With workers, only the one that carries the fleet's jobs starts them.
    listening: () => {
      if (runsFleetJobs()) {
        actions?.jobs?.start();
      }
    },
    // An open socket or stream never ends on its own, and would hold the shutdown until the grace cut it.
    closing: () => realtime?.close(),
    // The jobs running here are finished rather than abandoned: what is still pending stays in the shared queue.
    destroy: async () => {
      await actions?.jobs?.stop();
    },
    fleetStores: ACTIONS_FLEET_STORES,
    setPluginFunctions: (plugin, definition) => {
      if (!actions) {
        throw new Error(
          `[SSR] This server runs no actions (\`action.lookups\`), so no plugin's functions: "${plugin}"`
        );
      }

      if (definition !== undefined && !isFunctionsDefinition(definition)) {
        throw new Error(`[SSR] The functions of plugin "${plugin}" are not a definition: defineFunctions({ … })`);
      }

      actions.setPluginFunctions(plugin, definition);
    }
  };
};
