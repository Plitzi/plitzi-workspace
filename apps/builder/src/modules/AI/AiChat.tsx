import Alert from '@plitzi/plitzi-ui/Alert';
import { use, useCallback, useEffect, useRef, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import AiChatHeader from './components/AiChatHeader';
import AiProviderSettings from './components/AiProviderSettings/AiProviderSettings';
import Chat from './components/Chat';
import ChatInput from './components/ChatInput';
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

  const handleClickSettingsToggle = useCallback(() => setIsSettingsOpen(state => !state), []);

  return (
    <AiChatContext.Provider value={{ onSendMessage: handleApplySend, elementSelected: elementSelected ?? undefined }}>
      <div className="flex h-full w-full flex-col bg-white font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <AiChatHeader
        onClear={clearConversation}
        onCompact={compact}
        isStreaming={isStreaming}
        messageCount={messages.length}
        providerSettings={providerSettings}
        usage={usage}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={handleClickSettingsToggle}
        conversations={conversations}
        onLoadConversations={loadConversations}
        onLoadConversation={loadConversation}
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
          className="mx-3 mb-2 w-auto"
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
        <Alert className="mx-3 mb-2 w-auto" solid={false} intent="error" closeable size="xs" onClick={clearError}>
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
      </div>
    </AiChatContext.Provider>
  );
};

export default AiChat;
