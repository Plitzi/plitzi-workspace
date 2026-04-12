import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo, useState } from 'react';

import { formatDate } from '@plitzi/sdk-shared';

export type DetailsSidebarProps = {
  name?: string;
  description?: string;
  createdAt?: number;
  icon?: string;
  revisions?: { version: string }[];
  owner?: string;
  website?: string;
  color?: string;
  version: string;
  latestVersion: string;
  onAdd?: (version: string) => void;
  onUpdate?: (version: string) => Promise<boolean>;
  onRemove?: () => void;
};

const DetailsSidebar = ({
  name = 'Plugin',
  description = 'Plugin Description',
  createdAt = 0,
  icon = '',
  revisions,
  owner = 'Plitzi',
  website = 'https://plitzi.com',
  color = '',
  version: versionInstalled,
  latestVersion,
  onAdd,
  onUpdate,
  onRemove
}: DetailsSidebarProps) => {
  const createdAtParsed = useMemo(() => formatDate(createdAt, 'MMMM dd, yyyy'), [createdAt]);
  const [versionSelected, setVersionSelected] = useState(() => {
    let versionSelected = versionInstalled;
    if (!versionInstalled) {
      versionSelected = latestVersion;
    }

    return versionSelected;
  });

  const handleChangeVersion = useCallback((value: string) => setVersionSelected(value), [setVersionSelected]);

  const handleClickInstall = useCallback(() => {
    if (!versionInstalled) {
      onAdd?.(versionSelected);
    } else {
      onRemove?.();
    }
  }, [onAdd, onRemove, versionInstalled, versionSelected]);

  const handleClickUpdate = useCallback(async () => {
    if (await onUpdate?.(latestVersion)) {
      setVersionSelected(latestVersion);
    }
  }, [latestVersion, onUpdate]);

  return (
    <div className="flex w-75 flex-col">
      <div className="flex flex-col rounded-sm border border-gray-300 p-4 dark:border-zinc-700">
        <div className="flex items-center justify-center">
          <div className="h-32 w-32 bg-contain bg-no-repeat" style={{ backgroundImage: `url(${icon})` }} />
        </div>
        <div className="mt-4 flex items-center justify-center">
          <Heading as="h5" className="truncate">
            {name}
          </Heading>
        </div>
        <Select onChange={handleChangeVersion} value={versionSelected} className="mb-4 rounded-sm">
          {revisions &&
            revisions.map((revision, i) => {
              const { version } = revision;

              return (
                <option key={i} value={version}>
                  {version}
                  {i === 0 && ' (Latest)'}
                  {versionInstalled && version === versionInstalled && ' (Installed)'}
                </option>
              );
            })}
        </Select>
        {versionInstalled && versionInstalled !== latestVersion && (
          <Button className="rounded-sm" onClick={handleClickUpdate}>
            Update Now
          </Button>
        )}
        <Button className="rounded-sm" onClick={handleClickInstall}>
          {!versionInstalled ? 'Install Now' : 'Uninstall'}
        </Button>
      </div>
      <div className="mt-6 flex flex-col rounded-sm border border-gray-300 p-4 dark:border-zinc-700">
        <Heading as="h4">Overview</Heading>
        <div className="font-sm mt-4">{description}</div>
      </div>
      <div className="mt-6 flex flex-col rounded-sm border border-gray-300 p-4 text-sm dark:border-zinc-700">
        <Heading as="h4">Information</Heading>
        <div className="mt-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="font-bold">Publised By</div>
            <div className="font-bold" style={{ color }}>
              {owner}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="font-bold">Website</div>
            <a className="" href={website} rel="noreferrer" target="_blank" style={{ color }}>
              {website}
            </a>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="font-bold">Published At</div>
            {createdAtParsed}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsSidebar;
