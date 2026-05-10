import { formatTime } from '../../helpers/utils';

import type { AiAttachment, AiMessage } from '../../../../types';

export type UserMessageProps = {
  id: AiMessage['id'];
  content?: string;
  attachments?: AiAttachment[];
  createdAt?: number;
  irrelevant?: boolean;
};

const UserMessage = ({ id, content, attachments, createdAt, irrelevant }: UserMessageProps) => (
  <div className="flex flex-col gap-1.5" data-id={id}>
    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-br from-pink-500 to-sky-500" />
      <span className="font-medium text-zinc-900 dark:text-zinc-100">You</span>
      <span>{formatTime(createdAt)}</span>
      {irrelevant && <span className="text-yellow-500 dark:text-yellow-400">off-topic</span>}
    </div>
    {irrelevant && (
      <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-50 px-3 py-2 dark:border-yellow-400/30 dark:bg-yellow-900/20">
        <svg className="h-4 w-4 text-yellow-500 dark:text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92A5.5 5.5 0 0014.5 17h-9a5.5 5.5 0 00-4.743 6.98l-5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-[12px] text-yellow-700 dark:text-yellow-300">
          This message is off-topic and was not processed.
        </p>
      </div>
    )}
    {!irrelevant && (
      <>
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map(a => (
              <img
                key={a.id}
                src={`data:${a.mimeType};base64,${a.data}`}
                alt={a.name}
                className="h-20 w-20 rounded-lg border border-neutral-300 object-cover dark:border-zinc-700"
              />
            ))}
          </div>
        )}
        {content && (
          <div className="rounded-[9px] border border-neutral-300 bg-neutral-200 px-3 py-2 text-[12.5px] leading-[1.55] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            <p className="m-0 whitespace-pre-wrap">{content}</p>
          </div>
        )}
      </>
    )}
  </div>
);

export default UserMessage;
