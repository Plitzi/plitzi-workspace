import { use, useCallback, useEffect, useMemo } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import AiChatContext from './AiChatContext';
import useAiChat from '../hooks/useAiChat';

import type { AiAttachment, AiProviderSettings } from '../types';
import type { AiEffort, BuilderState } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { ReactNode } from 'react';

const { useStore } = createStoreHook<BuilderState>();

export type AiChatProviderProps = {
  children: ReactNode;
  providerSettings?: AiProviderSettings;
};

const AiChatProvider = ({ children, providerSettings }: AiChatProviderProps) => {
  const [elementSelected] = useStore('elementSelected');
  const { theme } = use(ThemeContext);
  const { currentPageId } = use(NavigationContext);
  const { environment } = use(NetworkContext) as BuilderNetworkContextValue;

  const {
    messages,
    streamingText,
    liveSteps,
    isStreaming,
    isBusy,
    usage,
    error,
    clearError,
    quotaError,
    clearQuotaError,
    quotaRetryAfter,
    conversationId,
    conversations,
    mode,
    setMode,
    initConversation,
    sendMessage,
    clearConversation,
    loadConversations,
    loadConversation,
    compact
  } = useAiChat(providerSettings);

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  const onSend = useCallback(
    (msg: string, attachments: AiAttachment[], effort: AiEffort) => {
      void sendMessage(msg, { currentPageId, elementSelected, environment, theme }, attachments, effort);
    },
    [sendMessage, currentPageId, elementSelected, environment, theme]
  );

  const onSendMessage = useCallback(
    (msg: string) => {
      void sendMessage(msg, { currentPageId, elementSelected, environment, theme });
    },
    [sendMessage, currentPageId, elementSelected, environment, theme]
  );

  const conversationTitle = messages.find(m => m.role === 'user')?.content?.slice(0, 60);

  const value = useMemo(
    () => ({
      messages,
      streamingText,
      liveSteps,
      isStreaming,
      isBusy,
      usage,
      error,
      clearError,
      quotaError,
      clearQuotaError,
      quotaRetryAfter,
      conversationId,
      conversations,
      mode,
      currentMode: mode,
      conversationTitle,
      elementSelected: elementSelected ?? undefined,
      onSend,
      onSendMessage,
      setMode,
      clearConversation,
      loadConversations,
      loadConversation,
      compact
    }),
    [
      messages,
      streamingText,
      liveSteps,
      isStreaming,
      isBusy,
      usage,
      error,
      clearError,
      quotaError,
      clearQuotaError,
      quotaRetryAfter,
      conversationId,
      conversations,
      mode,
      conversationTitle,
      elementSelected,
      onSend,
      onSendMessage,
      setMode,
      clearConversation,
      loadConversations,
      loadConversation,
      compact
    ]
  );

  return <AiChatContext value={value}>{children}</AiChatContext>;
};

export default AiChatProvider;
