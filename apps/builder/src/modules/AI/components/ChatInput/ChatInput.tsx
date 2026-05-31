import TextArea from '@plitzi/plitzi-ui/TextArea';
import clsx from 'clsx';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import VoiceVisualizer from '../VoiceVisualizer';
import AttachmentThumbnail from './components/AttachmentThumbnail';
import ChatInputControls from './components/ChatInputControls';
import { DEFAULT_SKILLS, SkillsManager } from './components/SkillsManager';
import { isMac } from './helpers';
import useMessageHistory from './hooks/useMessageHistory';
import { useAiChatContext } from '../../contexts/AiChatContext';

import type { AiAttachment, AiEffort, AiModelInfo, AiSkill } from '../../types';
import type { KeyboardEvent, Ref } from 'react';

export type ChatInputHandle = { appendText: (text: string) => void; setText: (text: string) => void };

export type ChatInputProps = {
  ref?: Ref<ChatInputHandle>;
  isListening: boolean;
  isVoiceSupported: boolean;
  audioData: Uint8Array<ArrayBuffer> | null;
  models?: AiModelInfo[];
  currentModel?: string;
  modelsLoading?: boolean;
  onVoiceToggle: () => void;
  onModelChange?: (modelId: string) => void;
};

const ChatInput = ({
  ref,
  isListening,
  isVoiceSupported,
  audioData,
  models = [],
  currentModel,
  modelsLoading,
  onVoiceToggle,
  onModelChange
}: ChatInputProps) => {
  const {
    isStreaming,
    messages,
    usage,
    mode,
    setMode: onModeChange,
    compact: onCompact,
    onSend,
    stopGeneration
  } = useAiChatContext();
  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [effort, setEffort] = useState<AiEffort>('medium');
  const [skills, setSkills] = useState<AiSkill[]>(DEFAULT_SKILLS);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { navigatePrev, navigateNext, reset } = useMessageHistory(messages);

  useImperativeHandle(ref, () => ({
    appendText: (text: string) => {
      setMessageInput(prev => (prev ? `${prev} ${text}` : text));
      textareaRef.current?.focus();
    },
    setText: (text: string) => {
      setMessageInput(text);
      textareaRef.current?.focus();
    }
  }));

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [messageInput]);

  const handleClickSend = useCallback(() => {
    if (!messageInput.trim() && attachments.length === 0) {
      return;
    }

    const activeSkillTags = activeSkills
      .map(id => skills.find(s => s.id === id)?.slash)
      .filter(Boolean)
      .map(slash => `/${slash}`)
      .join(' ');

    const msg = activeSkillTags ? `${activeSkillTags} ${messageInput}` : messageInput;
    const atts = attachments;
    reset();
    setMessageInput('');
    setAttachments([]);
    setActiveSkills([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(msg, atts, effort);
  }, [messageInput, attachments, activeSkills, skills, reset, onSend, effort]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleClickSend();

        return;
      }

      if (e.altKey && e.code === 'KeyP') {
        e.preventDefault();
        onModeChange(mode === 'plan' ? 'build' : 'plan');

        return;
      }

      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      if (e.key === 'ArrowUp' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        const prev = navigatePrev(messageInput);
        if (prev !== null) {
          e.preventDefault();
          setMessageInput(prev);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(prev.length, prev.length);
            }
          });
        }

        return;
      }

      if (e.key === 'ArrowDown' && textarea.selectionStart === messageInput.length) {
        const next = navigateNext();
        if (next !== null) {
          e.preventDefault();
          setMessageInput(next);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(next.length, next.length);
            }
          });
        }
      }
    },
    [handleClickSend, mode, onModeChange, messageInput, navigatePrev, navigateNext]
  );

  const handleChange = useCallback(
    (value: string) => {
      reset();
      setMessageInput(value);
    },
    [reset]
  );

  const handleFocus = useCallback(() => setIsFocused(true), []);

  const handleBlur = useCallback(() => setIsFocused(false), []);

  const removeAttachment = useCallback((id: string) => setAttachments(prev => prev.filter(a => a.id !== id)), []);

  const handleChangeAttachments = useCallback((atts: AiAttachment[]) => setAttachments(atts), []);

  const handleToggleSkill = useCallback(
    (id: string) => setSkills(prev => prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))),
    []
  );

  const removeActiveSkill = useCallback((id: string) => setActiveSkills(prev => prev.filter(i => i !== id)), []);

  const voiceColor = mode === 'build' ? '#10b981' : '#0ea5e9';

  return (
    <>
      <div
        className={clsx('m-2 flex flex-col rounded-xl border bg-neutral-50 dark:bg-zinc-800', {
          'border-neutral-300 dark:border-zinc-700': !isFocused,
          'border-emerald-500 ring-2 ring-emerald-500/20 dark:border-emerald-400': isFocused && mode === 'build',
          'border-sky-500 ring-2 ring-sky-500/20 dark:border-sky-400': isFocused && mode === 'plan'
        })}
      >
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

          {activeSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeSkills.map(id => {
                const skill = skills.find(s => s.id === id);

                if (!skill) {
                  return null;
                }

                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-2 py-0.5 font-mono text-[9.5px] text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                  >
                    <span>/{skill.slash}</span>
                    <button
                      onClick={() => removeActiveSkill(id)}
                      className="grid h-3 w-3 place-items-center text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                    >
                      <svg
                        className="h-2.5 w-2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <TextArea
            ref={textareaRef}
            placeholder={isListening ? 'Listening…' : `Ask anything… (${isMac ? '⌘↵' : 'Ctrl+Enter'} to send)`}
            className={{
              root: 'w-full',
              inputContainer: 'border-none bg-transparent ring-0! dark:bg-transparent',
              input: 'resize-none bg-transparent'
            }}
            rows={1}
            value={messageInput}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            size="xs"
          />

          <ChatInputControls
            mode={mode}
            effort={effort}
            message={messageInput}
            skills={skills}
            models={models}
            currentModel={currentModel}
            modelsLoading={modelsLoading}
            isVoiceSupported={isVoiceSupported}
            isStreaming={isStreaming}
            isListening={isListening}
            attachments={attachments}
            usage={usage}
            messageCount={messages.length}
            onCompact={onCompact}
            onVoiceToggle={onVoiceToggle}
            onAttachmentsChange={handleChangeAttachments}
            onModeChange={onModeChange}
            onEffortChange={setEffort}
            onModelChange={onModelChange ?? (() => undefined)}
            onManageSkills={() => setSkillsOpen(true)}
            onClickSend={handleClickSend}
            onStop={stopGeneration}
          />
        </div>
      </div>

      {skillsOpen && (
        <SkillsManager skills={skills} onToggle={handleToggleSkill} onClose={() => setSkillsOpen(false)} />
      )}
    </>
  );
};

export default ChatInput;
