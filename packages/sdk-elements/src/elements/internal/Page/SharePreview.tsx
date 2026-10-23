import { isHeadAddress, spaceIdentity } from '@plitzi/sdk-shared/schema';
import { useCommonStore } from '@plitzi/sdk-shared/store';

type SharePreviewProps = {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
};

/** A template the page server reads as it answers: the builder cannot say what it holds, only that it is one. */
const TEMPLATE = /\{\{[\s\S]*\}\}/;

/**
 * How a link to the page shows where it is pasted — a chat's card, a post: the site, the title, the description and
 * the picture, the page's own or the space's (`shareImage`). A picture written as a template is said as one: what it
 * reads exists only once the page server answers for an address.
 */
const SharePreview = ({ title, description, image, imageAlt }: SharePreviewProps) => {
  const [[settings]] = useCommonStore(['schema.settings']);
  const { siteName, shareImage } = spaceIdentity(settings);
  const picture = image ?? shareImage;
  const templated = picture !== undefined && TEMPLATE.test(picture);
  const shown = picture !== undefined && !templated && isHeadAddress(picture) ? picture : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs">Link preview</label>
      <div className="overflow-hidden rounded-md border border-l-4 border-zinc-300 border-l-indigo-500 bg-zinc-50 dark:border-zinc-700 dark:border-l-indigo-400 dark:bg-zinc-800">
        <div className="flex flex-col gap-1 p-2">
          {siteName && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{siteName}</span>}
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{title}</span>
          <span className="line-clamp-3 text-xs text-zinc-700 dark:text-zinc-300">{description}</span>
        </div>
        {shown && <img src={shown} alt={imageAlt ?? ''} className="aspect-[1200/630] w-full object-cover" />}
        {templated && (
          <div className="flex aspect-[1200/630] w-full items-center justify-center bg-zinc-200 px-3 text-center text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            The picture each address reads: {picture}
          </div>
        )}
      </div>
      {!picture && (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          No picture: a link shows a small card. Give the page one, or the space a share image (Settings → Sharing).
        </span>
      )}
    </div>
  );
};

export default SharePreview;
