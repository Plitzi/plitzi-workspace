import { useMemo } from 'react';

import syntaxHighlight from '@plitzi/sdk-shared/helpers/syntaxHighlight';

export type PluginDetailsProps = {
  label?: string;
  version?: string;
  author?: string;
  settings?: Record<string, unknown>;
};

const PluginDetails = ({ author, settings, label, version }: PluginDetailsProps) => {
  const settingsParsed = useMemo(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return null;
    }

    return syntaxHighlight(JSON.stringify(settings, null, 2));
  }, [settings]);

  return (
    <div className="flex h-full grow basis-0 flex-col overflow-y-auto p-4">
      <div className="mb-4 border-b border-zinc-200 pb-3 dark:border-zinc-700">
        <div className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-400 dark:text-zinc-500">Plugin</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">Version</span>
          <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{version ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">Author</span>
          <span className="text-xs text-zinc-800 dark:text-zinc-200">{author ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
            Settings
          </span>
          {settingsParsed ? (
            <pre
              className="overflow-auto rounded bg-zinc-50 p-2 font-mono text-xs leading-5 dark:bg-zinc-800"
              dangerouslySetInnerHTML={{ __html: settingsParsed }}
            />
          ) : (
            <span className="text-xs text-zinc-400 italic dark:text-zinc-500">No settings</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginDetails;
