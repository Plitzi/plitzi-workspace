import clsx from 'clsx';

import type { SpaceVersionContents } from '@plitzi/sdk-shared';

export type PluginListProps = { plugins: SpaceVersionContents['plugins'] };

/** Each installed plugin, and whether it can be taken out as code or only as it was built. */
const PluginList = ({ plugins }: PluginListProps) => (
  <ul className="flex flex-wrap gap-1.5">
    {plugins.map(plugin => (
      <li
        key={plugin.type}
        className={clsx(
          'rounded-full border px-2 py-0.5 text-[11px]',
          plugin.source
            ? 'border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300'
            : 'border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400'
        )}
        title={plugin.source ? 'Kept with the source it was built from' : 'Built only: upload it again from its source'}
      >
        {plugin.type}
        {!plugin.source && <span className="ml-1 opacity-70">built only</span>}
      </li>
    ))}
  </ul>
);

export default PluginList;
