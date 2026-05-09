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
  </div>
);

export default UserMessage;
