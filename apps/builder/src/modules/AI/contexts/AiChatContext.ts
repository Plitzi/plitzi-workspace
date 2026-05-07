import { createContext, useContext } from 'react';

type AiChatContextValue = {
  onSendMessage: (message: string) => void;
  elementSelected?: string;
};

const AiChatContext = createContext<AiChatContextValue>({ onSendMessage: () => {} });

export const useAiChatContext = () => useContext(AiChatContext);
export default AiChatContext;
