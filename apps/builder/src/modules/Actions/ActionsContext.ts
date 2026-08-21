import { createContext } from 'react';

import type {
  ActionDocument,
  ActionRunReport,
  ActionTaskDescriptor,
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
  addAction: (name: string, document: ActionDocument) => Promise<SpaceAction | undefined>;
  updateAction: (identifier: string, name: string, document: ActionDocument) => Promise<SpaceAction | undefined>;
  removeAction: (identifier: string) => Promise<boolean>;
  /** Runs the STORED action through the same runner a visitor's call goes through, and returns its trace. */
  runAction: (identifier: string, input: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
};

const ActionsContext = createContext<ActionsContextValue>({
  actions: {},
  tasks: [],
  credentials: [],
  isLoading: false,
  error: '',
  hasServerRendering: false,
  addAction: () => Promise.resolve(undefined),
  updateAction: () => Promise.resolve(undefined),
  removeAction: () => Promise.resolve(false),
  runAction: () => Promise.resolve(undefined)
});
ActionsContext.displayName = 'ActionsContext';

export default ActionsContext;
