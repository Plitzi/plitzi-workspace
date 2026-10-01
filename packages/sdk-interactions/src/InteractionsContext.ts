// Package

import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

import type InteractionsManager from './InteractionsManager';
import type { InteractionsContextValue as InteractionsContextValueShared } from '@plitzi/sdk-shared';

export type InteractionsContextValue = InteractionsContextValueShared<InstanceType<typeof InteractionsManager>>;

const InteractionsContextDefaultValue = {} as InteractionsContextValue;

const InteractionsContext = sharedContext('InteractionsContext', InteractionsContextDefaultValue);

export default InteractionsContext;
