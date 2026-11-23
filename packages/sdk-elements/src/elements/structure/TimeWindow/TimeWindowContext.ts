import { createContext } from 'react';

/** The time window around an element, as what is inside reads it: a countdown counts to its end. */
export type TimeWindowContextValue = { endsAt: string };

// Outside any window there is none: a countdown there counts to its own `to` alone.
const TimeWindowContext = createContext<TimeWindowContextValue | undefined>(undefined);
TimeWindowContext.displayName = 'TimeWindowContext';

export default TimeWindowContext;
