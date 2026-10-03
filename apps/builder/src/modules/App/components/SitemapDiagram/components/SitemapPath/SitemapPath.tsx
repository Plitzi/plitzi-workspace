import clsx from 'clsx';

export type SitemapPathProps = { path: string };

/** A page's address, its dynamic segments (`:productId`) marked as what they are: a value, not a word. */
const SitemapPath = ({ path }: SitemapPathProps) => (
  <span className="truncate font-mono text-[11px] text-gray-500 dark:text-zinc-400" title={path}>
    {path
      .split('/')
      .slice(1)
      .map((segment, index) => (
        <span key={index}>
          /
          <span
            className={clsx({
              'bg-primary-50 text-primary-700 dark:bg-primary-400/15 dark:text-primary-200 rounded px-0.5':
                segment.startsWith(':')
            })}
          >
            {segment}
          </span>
        </span>
      ))}
  </span>
);

export default SitemapPath;
