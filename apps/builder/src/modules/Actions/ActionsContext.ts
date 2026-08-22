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
  /** The steps this deployment can actually run, served by the server rather than hardcoded here. */
  tasks: ActionTaskDescriptor[];
  /** The space's credentials, so a step that needs one offers the list instead of asking for an identifier the
   *  author would have to go and look up. Never their values — those never leave the server. */
  credentials: SpaceCredential[];
  isLoading: boolean;
  error: string;
  /** True when the space has a deployment that can run server code, which is what runs an action at all. */
  hasServerRendering: boolean;
  /**
   * Where this space answers, one per deployment.
   *
   * A webhook's URL is not a property of the action — it is the space's origin plus the action's identifier — so
   * the panel needs the origins to be able to show it. An author configuring Stripe has to paste a URL somewhere,
   * and until it was written down here the only way to know it was to read the source.
   */
  deployments: { environment: string; domain: string; isDefault: boolean }[];
  addAction: (name: string, document: ActionDocument) => Promise<SpaceAction | undefined>;
  updateAction: (identifier: string, name: string, document: ActionDocument) => Promise<SpaceAction | undefined>;
  removeAction: (identifier: string) => Promise<boolean>;
  /**
   * Runs the STORED action through the same runner a visitor's call goes through, and returns its trace.
   *
   * `trigger` is which way in to rehearse. A webhook and a schedule are the ones with nobody watching, which is
   * exactly why being able to try them on purpose matters — and the run is subject to that trigger's own access
   * rule and input contract, not to a friendlier version of them.
   */
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
