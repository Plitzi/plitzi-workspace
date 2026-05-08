import Alert from '@plitzi/plitzi-ui/Alert';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import AiChatHeader from './components/AiChatHeader';
import AiProviderSettings from './components/AiProviderSettings/AiProviderSettings';
import Chat from './components/Chat';
import ChatInput from './components/ChatInput';
import HistoryPanel from './components/HistoryPanel';
import QuotaCountdown from './components/QuotaCountdown';
import AiChatContext from './contexts/AiChatContext';
import useAiChat from './hooks/useAiChat';
import useAiProviderSettings from './hooks/useAiProviderSettings';
import useAiTools from './hooks/useAiTools';
import useVoice from './hooks/useVoice';

import type { ChatInputHandle } from './components/ChatInput';
import type { AiAttachment } from './types';
import type { BuilderState } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

const AiChat = () => {
  const { useStore } = createStoreHook<BuilderState>();
  const [elementSelected] = useStore('elementSelected');
  const { theme } = use(ThemeContext);
  const { currentPageId } = use(NavigationContext);
  const { environment } = use(NetworkContext) as BuilderNetworkContextValue;
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<ChatInputHandle | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const {
    settings: providerSettings,
    models,
    modelsLoading,
    modelsError,
    updateSettings
  } = useAiProviderSettings(isSettingsOpen);

  const runClientTool = useAiTools();
  const {
    messages,
    streamingText,
    liveThinking,
    liveTools,
    isStreaming,
    usage,
    error,
    clearError,
    quotaError,
    clearQuotaError,
    quotaRetryAfter,
    conversations,
    mode,
    setMode,
    initConversation,
    sendMessage,
    clearConversation,
    loadConversations,
    loadConversation,
    compact
  } = useAiChat(runClientTool, providerSettings);

  const handleTranscript = useCallback((text: string) => {
    chatInputRef.current?.appendText(text);
  }, []);

  const {
    start: startVoice,
    stop: stopVoice,
    isListening,
    isSupported: isVoiceSupported,
    audioData
  } = useVoice({ onTranscript: handleTranscript });

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  const handleOpenHistory = useCallback(() => {
    void loadConversations();
    setHistoryOpen(true);
  }, [loadConversations]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!historyOpen) {
          void loadConversations();
        }

        setHistoryOpen(v => !v);
      }
    };

    document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [historyOpen, loadConversations]);

  const handleClickHistory = useCallback(() => setHistoryOpen(false), []);

  const handleSend = useCallback(
    (msg: string, atts: AiAttachment[]) => {
      void sendMessage(msg, { currentPageId, elementSelected, environment, theme }, atts);
    },
    [sendMessage, currentPageId, elementSelected, environment, theme]
  );

  const handleApplySend = useCallback(
    (msg: string) => {
      void sendMessage(msg, { currentPageId, elementSelected, environment, theme }, []);
    },
    [sendMessage, currentPageId, elementSelected, environment, theme]
  );

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopVoice();
    } else {
      void startVoice();
    }
  }, [isListening, stopVoice, startVoice]);
  const handleClickSettingsToggle = useCallback(() => setIsSettingsOpen(s => !s), []);
  const handleNewChat = useCallback(() => {
    clearConversation();
    setHistoryOpen(false);
  }, [clearConversation]);

  const conversationTitle = messages.find(m => m.role === 'user')?.content?.slice(0, 60);

  const aiChatContextValue = useMemo(
    () => ({ onSendMessage: handleApplySend, elementSelected: elementSelected ?? undefined, currentMode: mode }),
    [elementSelected, handleApplySend, mode]
  );

  return (
    <AiChatContext value={aiChatContextValue}>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-neutral-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <AiChatHeader
          onClear={clearConversation}
          onCompact={compact}
          isStreaming={isStreaming}
          messageCount={messages.length}
          providerSettings={providerSettings}
          usage={usage}
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={handleClickSettingsToggle}
          onHistoryOpen={handleOpenHistory}
          mode={mode}
          conversationTitle={conversationTitle}
        />

        {isSettingsOpen && (
          <AiProviderSettings
            settings={providerSettings}
            models={models}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            onChange={updateSettings}
          />
        )}

        <Chat
          ref={chatRef}
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          liveThinking={liveThinking}
          liveTools={liveTools}
        />

        {quotaError && (
          <Alert
            className="mx-2 mb-2 w-auto"
            solid={false}
            intent="warning"
            closeable
            size="xs"
            onClick={clearQuotaError}
          >
            {quotaError}
            {quotaRetryAfter && <QuotaCountdown retryAfter={quotaRetryAfter} />}
          </Alert>
        )}

        {error && (
          <Alert className="mx-2 mb-2 w-auto" solid={false} intent="error" closeable size="xs" onClick={clearError}>
            {error}
          </Alert>
        )}

        <ChatInput
          ref={chatInputRef}
          isStreaming={isStreaming}
          isListening={isListening}
          isVoiceSupported={isVoiceSupported}
          audioData={audioData}
          onSend={handleSend}
          onVoiceToggle={handleVoiceToggle}
          mode={mode}
          onModeChange={setMode}
        />

        {historyOpen && (
          <HistoryPanel
            conversations={conversations}
            onClose={handleClickHistory}
            onSelect={loadConversation}
            onNew={handleNewChat}
          />
        )}
      </div>
    </AiChatContext>
  );
};

export default AiChat;
