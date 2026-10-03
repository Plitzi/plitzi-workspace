import { useCallback, useEffect, useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useTheme from '@plitzi/sdk-shared/theme/useTheme';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import AiChatContext from './AiChatContext';
import { getPendingQuestion } from '../components/ChatInput/components/QuestionInput';
import useAiChat from '../hooks/useAiChat';

import type { AiAttachment, AiProviderSettings } from '../types';
import type { AiEffort } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AiChatProviderProps = {
  children: ReactNode;
  providerSettings?: AiProviderSettings;
  prefillInput?: (text: string) => void;
};

const AiChatProvider = ({ children, providerSettings, prefillInput }: AiChatProviderProps) => {
  const [[elementSelected, currentPageId]] = useBuilderStore(['elementSelected', 'navigation.currentPageId']);
  const { resolvedTheme } = useTheme();
  const { environment } = useBuilderNetwork();

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
      void sendMessage(msg, { currentPageId, elementSelected, environment, theme: resolvedTheme }, attachments, effort);
    },
    [sendMessage, currentPageId, elementSelected, environment, resolvedTheme]
  );

  const onSendMessage = useCallback(
    (msg: string) => {
      void sendMessage(msg, { currentPageId, elementSelected, environment, theme: resolvedTheme });
    },
    [sendMessage, currentPageId, elementSelected, environment, resolvedTheme]
  );

  const conversationTitle = messages.find(m => m.role === 'user')?.content?.slice(0, 60);
  const pendingQuestion = useMemo(() => getPendingQuestion(messages, isStreaming), [messages, isStreaming]);

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
      pendingQuestion,
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
      pendingQuestion,
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
