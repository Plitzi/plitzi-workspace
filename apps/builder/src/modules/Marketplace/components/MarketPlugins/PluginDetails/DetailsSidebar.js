// Packages
import React, { useCallback, useMemo, useState } from 'react';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import moment from 'moment';
import Select from '@plitzi/plitzi-ui-components/Select';
import Button from '@plitzi/plitzi-ui-components/Button';
import noop from 'lodash/noop';

const revisionsDefault = [];

/**
 * @param {{
 *   name?: string;
 *   description?: string;
 *   createdAt?: number;
 *   icon?: string;
 *   revisions?: object[];
 *   owner?: string;
 *   website?: string;
 *   color?: string;
 *   version?: string;
 *   latestVersion?: string;
 *   onAdd?: (version: string) => void;
 *   onUpdate?: (version: string) => Promise<boolean>;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DetailsSidebar = props => {
  const {
    name = 'Plugin',
    description = 'Plugin Description',
    createdAt = 0,
    icon = '',
    revisions = revisionsDefault,
    owner = 'Plitzi',
    website = 'https://plitzi.com',
    color = '',
    version: versionInstalled,
    latestVersion,
    onAdd = noop,
    onUpdate = noop,
    onRemove = noop
  } = props;
  const createdAtParsed = useMemo(() => () => moment(createdAt).format('DD MMMM, YYYY'), [createdAt]);
  const [versionSelected, setVersionSelected] = useState(() => {
    let versionSelected = versionInstalled;
    if (!versionInstalled) {
      versionSelected = latestVersion;
    }

    return versionSelected;
  });

  const handleChangeVersion = useCallback(value => setVersionSelected(value), [setVersionSelected]);

  const handleClickInstall = useCallback(() => {
    if (!versionInstalled) {
      onAdd(versionSelected);
    } else {
      onRemove();
    }
  }, [onAdd, onRemove, versionInstalled]);

  const handleClickUpdate = useCallback(async () => {
    if (await onUpdate(latestVersion)) {
      setVersionSelected(latestVersion);
    }
  }, [onUpdate, setVersionSelected]);

  return (
    <div className="flex flex-col w-[300px]">
      <div className="flex flex-col border border-gray-300 rounded-sm p-4">
        <div className="flex items-center justify-center">
          <div className="w-32 h-32 bg-no-repeat bg-contain" style={{ backgroundImage: `url(${icon})` }} />
        </div>
        <div className="flex items-center justify-center mt-4">
          <Heading type="h5" className="truncate">
            {name}
          </Heading>
        </div>
        <Select onChange={handleChangeVersion} value={versionSelected} className="rounded-sm mb-4">
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
      <div className="flex flex-col border border-gray-300 rounded-sm p-4 mt-6">
        <Heading type="h4">Overview</Heading>
        <div className="font-sm mt-4">{description}</div>
      </div>
      <div className="flex flex-col border border-gray-300 rounded-sm p-4 mt-6 text-sm">
        <Heading type="h4">Information</Heading>
        <div className="flex flex-col mt-4">
          <div className="flex items-center justify-between">
            <div className="font-bold">Publised By</div>
            <div className="font-bold" style={{ color }}>
              {owner}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="font-bold">Website</div>
            <a className="" href={website} rel="noreferrer" target="_blank" style={{ color }}>
              {website}
            </a>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="font-bold">Published At</div>
            {createdAtParsed}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsSidebar;
