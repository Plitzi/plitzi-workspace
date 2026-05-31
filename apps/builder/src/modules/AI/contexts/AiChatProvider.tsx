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
  prefillInput?: (text: string) => void;
};

const AiChatProvider = ({ children, providerSettings, prefillInput }: AiChatProviderProps) => {
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
    stopGeneration,
    clearConversation,
    loadConversations,
    loadConversation,
    forkConversation,
    compact
  } = useAiChat(providerSettings);

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  const forkFromMessage = useCallback(
    async (messageId: string, content: string) => {
      const newId = await forkConversation(messageId);
      if (newId) {
        await loadConversation(newId);
      }

      prefillInput?.(content);
    },
    [forkConversation, loadConversation, prefillInput]
  );

  const newChatFromMessage = useCallback(
    (content: string) => {
      clearConversation();
      prefillInput?.(content);
    },
    [clearConversation, prefillInput]
  );

  const prefill = useCallback((text: string) => prefillInput?.(text), [prefillInput]);

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
      stopGeneration,
      clearConversation,
      loadConversations,
      loadConversation,
      forkFromMessage,
      newChatFromMessage,
      prefillInput: prefill,
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
      stopGeneration,
      clearConversation,
      loadConversations,
      loadConversation,
      forkFromMessage,
      newChatFromMessage,
      prefill,
      compact
    ]
  );

  return <AiChatContext value={value}>{children}</AiChatContext>;
};

export default AiChatProvider;
