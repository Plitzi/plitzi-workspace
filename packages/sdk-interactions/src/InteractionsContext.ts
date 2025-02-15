// Package
import { createContext } from 'react';

// Types
import type InteractionsManager from './InteractionsManager';
import type { InteractionsContextValue as InteractionsContextValueShared } from '@plitzi/sdk-shared';

export type InteractionsContextValue = InteractionsContextValueShared<InstanceType<typeof InteractionsManager>>;

const InteractionsContextDefaultValue = {} as InteractionsContextValue;

const InteractionsContext = createContext<InteractionsContextValue>(InteractionsContextDefaultValue);

export default InteractionsContext;
