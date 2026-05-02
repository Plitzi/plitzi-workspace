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

const formatRetryDelay = (ts: number): string => {
  const ms = ts - Date.now();
  if (ms <= 0) return 'now';
  const totalSecs = Math.ceil(ms / 1000);
  if (totalSecs < 60) return `in ${String(totalSecs)}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) return `in ${String(mins)}m ${String(secs)}s`;
  return `at ${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const QuotaCountdown = ({ retryAfter }: { retryAfter: number }) => {
  const [label, setLabel] = useState(() => formatRetryDelay(retryAfter));

  useEffect(() => {
    setLabel(formatRetryDelay(retryAfter));
    const id = setInterval(() => {
      const next = formatRetryDelay(retryAfter);
      setLabel(next);
      if (next === 'now') clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  return <span className="ml-2 opacity-75">· resets {label}</span>;
};

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
        <div className="mx-3 mb-1 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
          <span className="flex-1">
            ⚠ {quotaError}
            {quotaRetryAfter && <QuotaCountdown retryAfter={quotaRetryAfter} />}
          </span>
          <button onClick={clearQuotaError} className="shrink-0 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}
      {error && (
        <div className="mx-3 mb-1 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <span className="flex-1">⚠ {error}</span>
          <button onClick={clearError} className="shrink-0 opacity-50 hover:opacity-100">✕</button>
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
