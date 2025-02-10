// Package
import { createContext } from 'react';

// Types
import type useInteractions from './hooks/useInteractions';
import type InteractionsManager from './InteractionsManager';
import type { RuleValue } from '@plitzi/plitzi-ui';
import type { ElementInteraction } from '@plitzi/sdk-shared';

export type InteractionStatus = 'completed' | 'skipped';
export type InteractionNodeStatus = 'success' | 'failed' | 'skipped' | 'disabled';

export type InteractionNode = {
  node: ElementInteraction;
  status: InteractionNodeStatus;
  postCallbacks: unknown[];
  result?: unknown;
  startTime: number;
  endTime: number;
  whenParams?: Record<string, RuleValue>;
};

export type InteractionsContextValue = {
  interactionsManager: InteractionsManager;
  useInteractions: typeof useInteractions;
};

const InteractionsContextDefaultValue = {} as InteractionsContextValue;

const InteractionsContext = createContext<InteractionsContextValue>(InteractionsContextDefaultValue);

export default InteractionsContext;
