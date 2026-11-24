import { sharedContext } from '@plitzi/sdk-shared/react';

/** The time window around an element, as what is inside reads it: a countdown counts to its end. */
export type TimeWindowContextValue = { endsAt: string } | undefined;

// Outside any window there is none: a countdown there counts to its own `to` alone. Shared, as every runtime context
// is, so a plugin drawn inside a window reads the same one.
const TimeWindowContext = sharedContext<TimeWindowContextValue>('TimeWindowContext', undefined);

export default TimeWindowContext;
