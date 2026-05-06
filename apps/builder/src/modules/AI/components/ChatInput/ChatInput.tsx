import Button from '@plitzi/plitzi-ui/Button';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

import VoiceVisualizer from '../VoiceVisualizer';
import AttachmentThumbnail from './AttachmentThumbnail';

import type { AiAttachment, AiMode } from '../../types';
import type { ChangeEvent, KeyboardEvent } from 'react';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const sendShortcutLabel = isMac ? '⌘↵' : 'Ctrl+Enter';
const modeShortcutLabel = 'Alt+P';

const MODE_STYLES = {
  build: {
    footer: 'bg-violet-50/70 dark:bg-violet-950/20',
    border: 'border-violet-200 dark:border-violet-800/50',
    accent: 'bg-violet-500 dark:bg-violet-600',
    textarea: 'border-violet-200 dark:border-violet-900/60 focus:ring-violet-400 dark:focus:ring-violet-500',
    sendBtn: 'bg-violet-600 hover:bg-violet-500 disabled:bg-violet-300 dark:disabled:bg-violet-900',
    iconBtn:
      'text-violet-400 dark:text-violet-600 hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-900/50 dark:hover:text-violet-400',
    voiceActive: 'bg-violet-600 text-white',
    modeWrap: 'border-violet-300 dark:border-violet-800/60',
    modeActive: 'bg-violet-600 dark:bg-violet-500 text-white',
    modeInactive: 'text-violet-400 dark:text-violet-600 hover:text-violet-700 dark:hover:text-violet-400'
  },
  plan: {
    footer: 'bg-sky-50/80 dark:bg-sky-950/20',
    border: 'border-sky-200 dark:border-sky-800/50',
    accent: 'bg-sky-500 dark:bg-sky-600',
    textarea: 'border-sky-200 dark:border-sky-900/60 focus:ring-sky-400 dark:focus:ring-sky-500',
    sendBtn: 'bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 dark:disabled:bg-sky-900',
    iconBtn:
      'text-sky-500 dark:text-sky-600 hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-900/50 dark:hover:text-sky-400',
    voiceActive: 'bg-sky-600 text-white',
    modeWrap: 'border-sky-300 dark:border-sky-800/60',
    modeActive: 'bg-sky-600 dark:bg-sky-500 text-white',
    modeInactive: 'text-sky-500 dark:text-sky-600 hover:text-sky-700 dark:hover:text-sky-400'
  }
} as const;

export type ChatInputHandle = { appendText: (text: string) => void };

type ChatInputProps = {
  isStreaming: boolean;
  isListening: boolean;
  isVoiceSupported: boolean;
  audioData: Uint8Array<ArrayBuffer> | null;
  onSend: (message: string, attachments: AiAttachment[]) => void;
  onVoiceToggle: () => void;
  mode?: AiMode;
  onModeChange?: (mode: AiMode) => void;
};

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  (
    { isStreaming, isListening, isVoiceSupported, audioData, onSend, onVoiceToggle, mode = 'build', onModeChange },
    ref
  ) => {
    const [messageInput, setMessageInput] = useState('');
    const [attachments, setAttachments] = useState<AiAttachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const ms = MODE_STYLES[mode];

    useImperativeHandle(ref, () => ({
      appendText: (text: string) => {
        setMessageInput(prev => (prev ? `${prev} ${text}` : text));
        textareaRef.current?.focus();
      }
    }));

    const handleSend = useCallback(() => {
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
          handleSend();
        } else if (e.altKey && e.code === 'KeyP') {
          e.preventDefault();
          onModeChange?.(mode === 'plan' ? 'build' : 'plan');
        }
      },
      [handleSend, mode, onModeChange]
    );

    const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const result = ev.target?.result as string;
          const [header, data] = result.split(',');
          const mimeType = header.split(':')[1].split(';')[0];
          setAttachments(prev => [
            ...prev,
            { id: crypto.randomUUID(), type: 'image', mimeType, data, name: file.name }
          ]);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    }, []);

    const removeAttachment = useCallback((id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
    }, []);

    const handleChange = useCallback((value: string) => {
      setMessageInput(value);
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }, []);

    const handleClickAddAttachment = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    return (
      <div className={`flex flex-col border-t transition-colors duration-200 ${ms.border} ${ms.footer}`}>
        <div className={`h-0.5 transition-colors duration-200 ${ms.accent}`} />

        <div className="flex flex-col gap-2 p-3">
          {isListening && (
            <div className="rounded-md border border-gray-200 bg-white/80 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950/80">
              <VoiceVisualizer
                audioData={audioData}
                isRecording={isListening}
                mainBarColor={mode === 'plan' ? '#0ea5e9' : '#a78bfa'}
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

          <div className="flex items-end gap-2">
            <Button
              className={`shrink-0 rounded p-1.5 transition-colors ${ms.iconBtn} border-none`}
              intent="custom"
              title="Attach image"
              disabled={isStreaming}
              onClick={handleClickAddAttachment}
            >
              <Button.Icon>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </Button.Icon>
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
            <TextArea
              ref={textareaRef}
              placeholder={isListening ? 'Listening…' : `Ask anything… (${sendShortcutLabel} to send)`}
              className={{ root: 'w-full', inputContainer: ms.textarea }}
              rows={1}
              value={messageInput}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              size="xs"
            />

            {isVoiceSupported && (
              <Button
                className={`shrink-0 rounded p-1.5 transition-colors ${isListening ? ms.voiceActive : ms.iconBtn} border-none`}
                intent="custom"
                title={isListening ? 'Stop recording' : 'Voice input'}
                disabled={isStreaming}
                onClick={onVoiceToggle}
              >
                <Button.Icon icon="fa-solid fa-microphone" size="xs">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V22h2v2H9v-2h2v-1.06A9 9 0 013 12h2z" />
                  </svg>
                </Button.Icon>
              </Button>
            )}

            <div
              className={`flex shrink-0 items-center overflow-hidden rounded border font-mono text-[10px] transition-colors duration-200 ${ms.modeWrap}`}
            >
              {(['plan', 'build'] as AiMode[]).map(m => (
                <button
                  key={m}
                  className={`px-2.5 py-1 capitalize transition-colors duration-200 ${mode === m ? ms.modeActive : ms.modeInactive}`}
                  onClick={() => onModeChange?.(m)}
                  disabled={isStreaming}
                  title={
                    m === 'plan'
                      ? `Plan — analysis only, no changes (${modeShortcutLabel})`
                      : `Build — full implementation (${modeShortcutLabel})`
                  }
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              className={`shrink-0 rounded p-1.5 text-white transition-colors duration-200 disabled:opacity-40 ${ms.sendBtn}`}
              onClick={handleSend}
              disabled={(!messageInput.trim() && attachments.length === 0) || isStreaming}
              title={`Send (${sendShortcutLabel})`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;
