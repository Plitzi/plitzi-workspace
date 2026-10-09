// Package

import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

import type { InteractionsContextValue as InteractionsContextValueShared } from '@plitzi/sdk-shared';

/** The manager as its context holds it: the interface sdk-shared declares, which `InteractionsManager` implements. */
export type InteractionsContextValue = InteractionsContextValueShared;

const InteractionsContextDefaultValue = {} as InteractionsContextValue;

const InteractionsContext = sharedContext('InteractionsContext', InteractionsContextDefaultValue);

export default InteractionsContext;
