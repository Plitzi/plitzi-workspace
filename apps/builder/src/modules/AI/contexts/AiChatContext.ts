import { createContext, useContext } from 'react';

import type { AiMode } from '../types';

export type AiChatContextValue = {
  onSendMessage: (message: string) => void;
  elementSelected?: string;
  currentMode: AiMode;
};

const AiChatContext = createContext<AiChatContextValue>({
  onSendMessage: () => {},
  currentMode: 'build'
});

export const useAiChatContext = () => useContext(AiChatContext);

export default AiChatContext;
