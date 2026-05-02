import { use, useCallback, useEffect, useRef, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import AiChatHeader from './components/AiChatHeader';
import AiProviderSettings from './components/AiProviderSettings/AiProviderSettings';
import Chat from './components/Chat';
import ChatInput from './components/ChatInput';
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
    mode,
    setMode,
    initConversation,
    sendMessage,
    clearConversation,
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

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, streamingText, liveTools]);

  const handleSend = useCallback(
    (msg: string, atts: AiAttachment[]) => {
      void sendMessage(msg, { currentPageId, elementSelected, environment }, atts);
    },
    [sendMessage, currentPageId, elementSelected, environment]
  );

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopVoice();
    } else {
      void startVoice();
    }
  }, [isListening, stopVoice, startVoice]);

  return (
    <div className="flex h-full w-full flex-col bg-white font-mono text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <AiChatHeader
        onClear={clearConversation}
        onCompact={compact}
        isStreaming={isStreaming}
        messageCount={messages.length}
        providerSettings={providerSettings}
        usage={usage}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={() => setIsSettingsOpen(v => !v)}
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
      {error && (
        <div className="mx-3 mb-1 rounded border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          ⚠ {error}
        </div>
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
  );
};

export default AiChat;
