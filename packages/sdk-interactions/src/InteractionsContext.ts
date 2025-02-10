// Package
import { createContext } from 'react';

// Types
import type useInteractions from './hooks/useInteractions';
import type InteractionsManager from './InteractionsManager';

export type InteractionsContextValue = {
  interactionsManager: InteractionsManager;
  useInteractions: typeof useInteractions;
};

const InteractionsContextDefaultValue = {} as InteractionsContextValue;

const InteractionsContext = createContext<InteractionsContextValue>(InteractionsContextDefaultValue);

export default InteractionsContext;
