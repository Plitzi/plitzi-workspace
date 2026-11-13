import { useMemo } from 'react';

import { syntaxHighlight } from '@plitzi/sdk-shared/helpers';
import { ownHtml } from '@plitzi/sdk-shared/security';

import type { ComponentOrigin } from '@plitzi/sdk-shared';

/** One element this page has that the SDK did not bring, however it got here. */
export type PluginEntry = {
  type: string;
  origin: Exclude<ComponentOrigin, 'local'>;
  /** Absent for a plugin nobody published: a file a deployment ships has no manifest to read a version off. */
  version?: string;
  author?: string;
  settings?: Record<string, unknown>;
};

export type PluginDetailsProps = {
  entry: PluginEntry;
};

const ORIGIN: Record<PluginEntry['origin'], { label: string; hint: string }> = {
  'local-custom': {
    label: 'Shipped with this space',
    hint: 'A file this deployment hands the server, compiled and rendered with everything else.'
  },
  remote: { label: 'Installed', hint: 'A published bundle, described by the manifest it was published with.' }
};

const PluginDetails = ({ entry }: PluginDetailsProps) => {
  const { type, origin, version, author, settings } = entry;

  const settingsParsed = useMemo(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return null;
    }

    return syntaxHighlight(JSON.stringify(settings, null, 2));
  }, [settings]);

  return (
    <div className="flex h-full grow basis-0 flex-col overflow-y-auto p-4">
      <div className="border-ui-line mb-4 border-b pb-3">
        <div className="text-ui-fg text-base font-semibold">{type}</div>
        <div className="text-ui-fg-subtle text-xs">{ORIGIN[origin].label}</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-ui-fg-subtle text-xs font-medium tracking-wider uppercase">Where it comes from</span>
          <span className="text-ui-fg text-xs">{ORIGIN[origin].hint}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-ui-fg-subtle text-xs font-medium tracking-wider uppercase">Version</span>
          <span className="text-ui-fg font-mono text-xs">{version ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-ui-fg-subtle text-xs font-medium tracking-wider uppercase">Author</span>
          <span className="text-ui-fg text-xs">{author ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-ui-fg-subtle text-xs font-medium tracking-wider uppercase">Settings</span>
          {settingsParsed ? (
            <pre
              className="bg-ui-raised overflow-auto rounded p-2 font-mono text-xs leading-5"
              dangerouslySetInnerHTML={{ __html: ownHtml(settingsParsed) }}
            />
          ) : (
            <span className="text-ui-fg-subtle text-xs italic">No settings</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginDetails;
