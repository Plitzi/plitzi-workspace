import { createContext, useContext } from 'react';

import type { AiAttachment, AiLiveStep, AiMessage, AiMode, AiUsage, ConversationSummary } from '../types';
import type { AiEffort } from '@plitzi/sdk-shared';

export type AiChatContextValue = {
  messages: AiMessage[];
  streamingText: string;
  liveSteps: AiLiveStep[];
  isStreaming: boolean;
  isBusy: boolean;
  usage: AiUsage | undefined;
  error: string | undefined;
  quotaError: string | undefined;
  quotaRetryAfter: number | undefined;
  conversationId: string;
  conversations: ConversationSummary[];
  mode: AiMode;
  currentMode: AiMode;
  conversationTitle: string | undefined;
  elementSelected: string | undefined;
  onSend: (message: string, attachments: AiAttachment[], effort: AiEffort) => void;
  onSendMessage: (message: string) => void;
  setMode: (mode: AiMode) => void;
  clearError: () => void;
  clearQuotaError: () => void;
  clearConversation: () => void;
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  compact: () => Promise<void>;
};

const AiChatContext = createContext<AiChatContextValue>({
  messages: [],
  streamingText: '',
  liveSteps: [],
  isStreaming: false,
  isBusy: false,
  usage: undefined,
  error: undefined,
  quotaError: undefined,
  quotaRetryAfter: undefined,
  conversationId: '',
  conversations: [],
  mode: 'build',
  currentMode: 'build',
  conversationTitle: undefined,
  elementSelected: undefined,
  onSend: () => {},
  onSendMessage: () => {},
  setMode: () => {},
  clearError: () => {},
  clearQuotaError: () => {},
  clearConversation: () => {},
  loadConversations: async () => {},
  loadConversation: async () => {},
  compact: async () => {}
});

export const useAiChatContext = () => useContext(AiChatContext);

export default AiChatContext;
