import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import KeyboardKey from '@pmodules/AI/components/KeyboardKey';

import type { AiAttachment, AiMode } from '@pmodules/AI/types';
import type { ChangeEvent } from 'react';

export type ButtonAttachmentsProps = {
  mode: AiMode;
  attachments?: AiAttachment[];
  disabled?: boolean;
  isListening?: boolean;
  isVoiceSupported?: boolean;
  onChange?: (attachments: AiAttachment[]) => void;
  onVoiceToggle?: () => void;
};

const ButtonAttachments = ({
  mode,
  attachments = [],
  disabled = false,
  isListening = false,
  isVoiceSupported = false,
  onChange,
  onVoiceToggle
}: ButtonAttachmentsProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggle = useCallback(() => setOpen(o => !o), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
    setOpen(false);
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      Array.from(e.target.files ?? []).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const result = ev.target?.result as string;
          const [header, data] = result.split(',');
          const mimeType = header.split(':')[1].split(';')[0];
          onChange?.([...attachments, { id: crypto.randomUUID(), type: 'image', mimeType, data, name: file.name }]);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    },
    [attachments, onChange]
  );

  const handleVoiceClick = useCallback(() => {
    onVoiceToggle?.();
    setOpen(false);
  }, [onVoiceToggle]);

  return (
    <div ref={rootRef} className="relative">
      <button
        disabled={disabled}
        onClick={toggle}
        title="Attach (⌘ U)"
        className={clsx(
          'grid h-7 w-7 place-items-center rounded-lg border-0 transition-colors',
          isListening
            ? {
                'bg-emerald-500 text-white dark:bg-emerald-400': mode === 'build',
                'bg-sky-500 text-white dark:bg-sky-400': mode === 'plan'
              }
            : 'bg-transparent text-zinc-500 hover:bg-neutral-200 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700'
        )}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-60 overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <button
            onClick={handleFileClick}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-zinc-800"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-100 dark:border-zinc-700 dark:bg-zinc-800">
              <svg
                className="h-3 w-3 text-zinc-500 dark:text-zinc-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block text-[12px] text-zinc-700 dark:text-zinc-300">Attach image</span>
              <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-600">.png .jpg .gif .webp</span>
            </span>
            <KeyboardKey char="U" />
          </button>

          {isVoiceSupported && (
            <button
              onClick={handleVoiceClick}
              className={clsx(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                isListening ? 'bg-neutral-50 dark:bg-zinc-800' : 'hover:bg-neutral-50 dark:hover:bg-zinc-800'
              )}
            >
              <span
                className={clsx(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-md border',
                  isListening
                    ? {
                        'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-400':
                          mode === 'build',
                        'border-sky-500/50 bg-sky-500/10 text-sky-500 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-400':
                          mode === 'plan'
                      }
                    : 'border-neutral-200 bg-neutral-100 dark:border-zinc-700 dark:bg-zinc-800'
                )}
              >
                <svg className="h-3 w-3 text-zinc-500 dark:text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V22h2v2H9v-2h2v-1.06A9 9 0 013 12h2z" />
                </svg>
              </span>
              <span className="flex-1">
                <span className="block text-xs text-zinc-700 dark:text-zinc-300">
                  {isListening ? 'Stop recording' : 'Record voice'}
                </span>
                <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
                  {isListening ? 'Click to stop' : 'Whisper · hold to record'}
                </span>
              </span>
              <KeyboardKey char="M" />
            </button>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFileChange} />
    </div>
  );
};

export default ButtonAttachments;
