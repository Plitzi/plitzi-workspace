import clsx from 'clsx';
import { useMemo } from 'react';

import syntaxHighlight from '@plitzi/sdk-shared/helpers/syntaxHighlight';

import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

export type PluginDetailsProps = {
  label?: string;
  version?: string;
  author?: string;
  settings?: Record<string, unknown>;
};

const PluginDetails = ({ author, settings, label, version }: PluginDetailsProps) => {
  const { isDark } = useDevToolsTheme();

  const settingsParsed = useMemo(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return null;
    }

    return syntaxHighlight(JSON.stringify(settings, null, 2));
  }, [settings]);

  const labelColor = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const valueColor = isDark ? 'text-zinc-200' : 'text-zinc-800';
  const borderColor = isDark ? 'border-zinc-700' : 'border-zinc-200';
  const codeBg = isDark ? 'bg-zinc-800' : 'bg-zinc-50';

  return (
    <div className="flex h-full grow basis-0 flex-col overflow-y-auto p-4">
      <div className={clsx('mb-4 border-b pb-3', borderColor)}>
        <div className={clsx('text-base font-semibold', valueColor)}>{label}</div>
        <div className={clsx('text-xs', labelColor)}>Plugin</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={clsx('text-xs font-medium tracking-wider uppercase', labelColor)}>Version</span>
          <span className={clsx('font-mono text-xs', valueColor)}>{version ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={clsx('text-xs font-medium tracking-wider uppercase', labelColor)}>Author</span>
          <span className={clsx('text-xs', valueColor)}>{author ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={clsx('text-xs font-medium tracking-wider uppercase', labelColor)}>Settings</span>
          {settingsParsed ? (
            <pre
              className={clsx('overflow-auto rounded p-2 font-mono text-xs leading-5', codeBg)}
              dangerouslySetInnerHTML={{ __html: settingsParsed }}
            />
          ) : (
            <span className={clsx('text-xs italic', labelColor)}>No settings</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginDetails;
