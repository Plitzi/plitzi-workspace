import { createContext } from 'react';

export type QueueStatusContextValue = boolean;

const QueueStatusContext = createContext<QueueStatusContextValue>(false);

export default QueueStatusContext;
