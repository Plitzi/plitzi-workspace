import { createContext } from 'react';

export type QueueStatusContextValue = boolean;

const QueueStatusContext = createContext<QueueStatusContextValue>(false);
QueueStatusContext.displayName = 'QueueStatusContext';

export default QueueStatusContext;
