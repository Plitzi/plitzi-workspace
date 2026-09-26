import type { RootElements } from '@plitzi/sdk-schema/helpers/elementTree';

export type PluginInUseProps = { usage: RootElements[] };

/** What removing a plugin leaves behind: the pages whose elements of it will render as not found. */
const PluginInUse = ({ usage }: PluginInUseProps) => {
  if (!usage.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-sm border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <p>
        This plugin is still in use. Its elements will show as not found until it is installed again (elements per
        page):
      </p>
      <ul className="list-disc pl-5">
        {usage.map(({ page, elements }) => (
          <li key={page}>{`${page}: ${elements}`}</li>
        ))}
      </ul>
    </div>
  );
};

export default PluginInUse;
