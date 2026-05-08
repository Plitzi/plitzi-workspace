import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useImperativeHandle, useRef, useState } from 'react';

import { isMac } from './helpers';
import VoiceVisualizer from '../VoiceVisualizer';
import AttachmentThumbnail from './components/AttachmentThumbnail';
import ChatInputControls from './components/ChatInputControls';

import type { AiAttachment, AiMode } from '../../types';
import type { KeyboardEvent, Ref } from 'react';

export type ChatInputHandle = { appendText: (text: string) => void };

export type ChatInputProps = {
  ref?: Ref<ChatInputHandle>;
  isStreaming: boolean;
  isListening: boolean;
  isVoiceSupported: boolean;
  audioData: Uint8Array<ArrayBuffer> | null;
  onSend: (message: string, attachments: AiAttachment[]) => void;
  onVoiceToggle: () => void;
  mode?: AiMode;
  onModeChange?: (mode: AiMode) => void;
};

const ChatInput = ({
  ref,
  isStreaming,
  isListening,
  isVoiceSupported,
  audioData,
  onSend,
  onVoiceToggle,
  mode = 'build',
  onModeChange
}: ChatInputProps) => {
  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({
    appendText: (text: string) => {
      setMessageInput(prev => (prev ? `${prev} ${text}` : text));
      textareaRef.current?.focus();
    }
  }));

  const handleClickSend = useCallback(() => {
    if ((!messageInput.trim() && attachments.length === 0) || isStreaming) {
      return;
    }

    const msg = messageInput;
    const atts = attachments;
    setMessageInput('');
    setAttachments([]);
    onSend(msg, atts);
  }, [messageInput, attachments, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleClickSend();
      } else if (e.altKey && e.code === 'KeyP') {
        e.preventDefault();
        onModeChange?.(mode === 'plan' ? 'build' : 'plan');
      }
    },
    [handleClickSend, mode, onModeChange]
  );

  const handleChange = useCallback((value: string) => {
    setMessageInput(value);
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, []);

  const removeAttachment = useCallback((id: string) => setAttachments(prev => prev.filter(a => a.id !== id)), []);
  const handleChangeAttachments = useCallback((atts: AiAttachment[]) => setAttachments(atts), []);
  const voiceColor = mode === 'build' ? '#10b981' : '#0ea5e9';

  return (
    <div className="m-2 flex flex-col rounded-xl border border-neutral-300 bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex flex-col gap-2 p-3">
        {isListening && (
          <div className="rounded-lg border border-neutral-300 bg-neutral-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-700">
            <VoiceVisualizer
              audioData={audioData}
              isRecording={isListening}
              mainBarColor={voiceColor}
              backgroundColor="transparent"
              className="h-8"
            />
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map(a => (
              <AttachmentThumbnail key={a.id} attachment={a} onRemove={removeAttachment} />
            ))}
          </div>
        )}

        <TextArea
          ref={textareaRef}
          placeholder={isListening ? 'Listening…' : `Ask anything… (${isMac ? '⌘↵' : 'Ctrl+Enter'} to send)`}
          className={{
            root: 'w-full',
            inputContainer: 'border-none bg-transparent ring-0! dark:bg-transparent',
            input: 'bg-transparent'
          }}
          rows={1}
          value={messageInput}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          size="xs"
        />

        <ChatInputControls
          mode={mode}
          message={messageInput}
          isVoiceSupported={isVoiceSupported}
          disabled={isStreaming}
          isListening={isListening}
          attachments={attachments}
          onVoiceToggle={onVoiceToggle}
          onAttachmentsChange={handleChangeAttachments}
          onModeChange={onModeChange}
          onClickSend={handleClickSend}
        />
      </div>
    </div>
  );
};

export default ChatInput;
