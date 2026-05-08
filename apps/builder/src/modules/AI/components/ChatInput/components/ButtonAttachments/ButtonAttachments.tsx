import { useCallback, useRef } from 'react';

import type { AiAttachment, AiMode } from '@pmodules/AI/types';
import type { ChangeEvent } from 'react';

export type ButtonAttachmentsProps = {
  attachments?: AiAttachment[];
  mode: AiMode;
  disabled?: boolean;
  onChange?: (attachments: AiAttachment[]) => void;
};

const ButtonAttachments = ({ attachments = [], disabled = false, onChange }: ButtonAttachmentsProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleChange = useCallback(
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

  return (
    <>
      <button
        className="grid h-7 w-7 place-items-center rounded-lg border-0 bg-transparent text-zinc-500 transition-colors duration-150 hover:bg-neutral-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
        title="Attach image"
        disabled={disabled}
        onClick={handleClick}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleChange} />
    </>
  );
};

export default ButtonAttachments;
