import type { AiAttachment } from '../../types';

type AttachmentThumbnailProps = { attachment: AiAttachment; onRemove: (id: string) => void };

const AttachmentThumbnail = ({ attachment, onRemove }: AttachmentThumbnailProps) => (
  <div className="group relative">
    <img
      src={`data:${attachment.mimeType};base64,${attachment.data}`}
      alt={attachment.name}
      className="h-14 w-14 rounded border border-gray-300 object-cover dark:border-zinc-700"
    />
    <button
      className="absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-xs text-zinc-700 group-hover:flex dark:bg-zinc-800 dark:text-zinc-300"
      onClick={() => onRemove(attachment.id)}
    >
      ×
    </button>
  </div>
);

export default AttachmentThumbnail;
