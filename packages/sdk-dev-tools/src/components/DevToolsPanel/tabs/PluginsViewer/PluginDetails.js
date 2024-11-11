// Packages
import { useMemo } from "react";

// Monorepo
import syntaxHighlight from '@plitzi/sdk-shared/syntaxHighlight';

/**
 * @param {{
 *   className?: string;
 *   label?: string;
 *   version?: string;
 *   author?: string;
 *   settings?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const PluginDetails = props => {
  const { author, settings, label, version } = props;

  const settingsParsed = useMemo(() => {
    if (Object.keys(settings).length === 0) {
      return 'No Settings';
    }

    return syntaxHighlight(JSON.stringify(settings, null, 2));
  }, [settings, settings]);

  return (
    <div className="flex basis-0 grow p-4 h-full">
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
