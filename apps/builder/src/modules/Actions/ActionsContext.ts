import { createContext } from 'react';

import type {
  ActionDocument,
  ActionRunReport,
  ActionTaskDescriptor,
  ActionTriggerType,
  SpaceAction,
  SpaceCredential
} from '@plitzi/sdk-shared';

export type ActionsContextValue = {
  actions: Record<string, SpaceAction>;
  /** Served by this deployment's server, not hardcoded in the builder. */
  tasks: ActionTaskDescriptor[];
  /** Names and identifiers only — values never leave the server. */
  credentials: SpaceCredential[];
  isLoading: boolean;
  error: string;
  hasServerRendering: boolean;
  /** One origin per deployment, for building webhook URLs. */
  deployments: { environment: string; domain: string; isDefault: boolean }[];
  addAction: (name: string, document: ActionDocument) => Promise<SpaceAction | undefined>;
  updateAction: (identifier: string, name: string, document: ActionDocument) => Promise<SpaceAction | undefined>;
  removeAction: (identifier: string) => Promise<boolean>;
  /** Runs the stored action through the same runner a visitor hits, under the trigger's own access rules. */
  runAction: (
    identifier: string,
    input: Record<string, unknown>,
    trigger?: ActionTriggerType
  ) => Promise<ActionRunReport | undefined>;
};

const ActionsContext = createContext<ActionsContextValue>({
  actions: {},
  tasks: [],
  credentials: [],
  isLoading: false,
  error: '',
  hasServerRendering: false,
  deployments: [],
  addAction: () => Promise.resolve(undefined),
  updateAction: () => Promise.resolve(undefined),
  removeAction: () => Promise.resolve(false),
  runAction: () => Promise.resolve(undefined)
});
ActionsContext.displayName = 'ActionsContext';

export default ActionsContext;
