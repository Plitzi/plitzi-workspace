// Packages
import { useMemo } from 'react';

// Monorepo
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';

export type PluginDetailsProps = {
  label?: string;
  version?: string;
  author?: string;
  settings?: Record<string, unknown>;
};

const PluginDetails = ({ author, settings, label, version }: PluginDetailsProps) => {
  const settingsParsed = useMemo(() => {
    if (settings && Object.keys(settings).length === 0) {
      return 'No Settings';
    }

    return syntaxHighlight(JSON.stringify(settings, null, 2));
  }, [settings]);

  return (
    <div className="grow flex basis-0 grow p-4 h-full">
      <div className="flex flex-col gap-4">
        <div className="font-bold text-2xl">{label}</div>
        <div className="flex flex-col">
          <div className="font-bold">Version</div>
          <div>{version}</div>
        </div>
        <div className="flex flex-col">
          <div className="font-bold">Author</div>
          <div>{author}</div>
        </div>
        <div className="flex flex-col">
          <div className="font-bold">Settings</div>
          <div>{settingsParsed}</div>
        </div>
      </div>
    </div>
  );
};

export default PluginDetails;
