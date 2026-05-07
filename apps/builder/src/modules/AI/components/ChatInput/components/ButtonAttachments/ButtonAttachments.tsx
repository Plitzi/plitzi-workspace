import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useRef } from 'react';

import type { AiAttachment, AiMode } from '@pmodules/AI/types';
import type { ChangeEvent } from 'react';

export type ButtonAttachmentsProps = {
  attachments?: AiAttachment[];
  mode: AiMode;
  disabled?: boolean;
  onChange?: (attachments: AiAttachment[]) => void;
};

const ButtonAttachments = ({ attachments = [], mode, disabled = false, onChange }: ButtonAttachmentsProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClickAddAttachment = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(file => {
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
      <Button
        className={clsx('shrink-0 rounded border-none p-1.5 transition-colors', {
          'text-violet-400 hover:bg-violet-100 hover:text-violet-700 dark:text-violet-600 dark:hover:bg-violet-900/50 dark:hover:text-violet-400':
            mode === 'build',
          'text-sky-500 hover:bg-sky-100 hover:text-sky-700 dark:text-sky-600 dark:hover:bg-sky-900/50 dark:hover:text-sky-400':
            mode === 'plan'
        })}
        intent="custom"
        title="Attach image"
        disabled={disabled}
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
    </>
  );
};

export default ButtonAttachments;
