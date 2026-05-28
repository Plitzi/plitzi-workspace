import Alert from '@plitzi/plitzi-ui/Alert';

import { useAiChatContext } from '../../contexts/AiChatContext';
import AiChatHeader from '../AiChatHeader';
import AiProviderSettings from '../AiProviderSettings';
import Chat from '../Chat';
import ChatInput from '../ChatInput';
import QuotaCountdown from '../QuotaCountdown';

import type { AiModelInfo, AiProviderSettings as AiProviderSettingsConfig } from '../../types';
import type { ChatInputHandle } from '../ChatInput';
import type { RefObject } from 'react';

export type AiChatContentProps = {
  chatInputRef: RefObject<ChatInputHandle | null>;
  chatRef: RefObject<HTMLDivElement | null>;
  isSettingsOpen: boolean;
  onSettingsToggle: () => void;
  isListening: boolean;
  isVoiceSupported: boolean;
  audioData: Uint8Array<ArrayBuffer> | null;
  onVoiceToggle: () => void;
  models: AiModelInfo[];
  currentModel: string | undefined;
  modelsLoading: boolean;
  modelsError: string | undefined;
  providerSettings: AiProviderSettingsConfig;
  onModelChange: (modelId: string) => void;
  onSettingsChange: (updates: Partial<AiProviderSettingsConfig>) => void;
};

const AiChatContent = ({
  chatInputRef,
  chatRef,
  isSettingsOpen,
  onSettingsToggle,
  isListening,
  isVoiceSupported,
  audioData,
  onVoiceToggle,
  models,
  currentModel,
  modelsLoading,
  modelsError,
  providerSettings,
  onModelChange,
  onSettingsChange
}: AiChatContentProps) => {
  const { error, clearError, quotaError, clearQuotaError, quotaRetryAfter } = useAiChatContext();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-neutral-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AiChatHeader isSettingsOpen={isSettingsOpen} onSettingsToggle={onSettingsToggle} />

      {isSettingsOpen && (
        <AiProviderSettings
          settings={providerSettings}
          models={models}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          onChange={onSettingsChange}
        />
      )}

      <Chat ref={chatRef} />

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
        isListening={isListening}
        isVoiceSupported={isVoiceSupported}
        audioData={audioData}
        models={models}
        currentModel={currentModel}
        modelsLoading={modelsLoading}
        onVoiceToggle={onVoiceToggle}
        onModelChange={onModelChange}
      />
    </div>
  );
};

export default AiChatContent;
