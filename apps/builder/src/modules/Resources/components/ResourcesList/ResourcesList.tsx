import Button from '@plitzi/plitzi-ui/Button';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import { useCallback, useState } from 'react';

import ResourceDirectoryForm from '@pmodules/Resources/Models/ResourceDirectoryForm';

import ResourcesDirectory from '../ResourceDirectory';

import type { Resource as TResource } from '@plitzi/sdk-shared';

export type ResourcesListProps = {
  className?: string;
  items: TResource[];
  prefix: string;
  onRemove?: (item: TResource) => void;
};

export type ResourceDirectory = { name: string; items: TResource[]; canDrop: boolean };

const sortDirectories =
  (defaultFolderName: string = 'All Resources') =>
  (a: ResourceDirectory, b: ResourceDirectory) => {
    if (a.name === defaultFolderName) {
      return -1;
    }

    if (b.name === defaultFolderName) {
      return 1;
    }

    if (a.name === 'Plugins' && b.name !== 'Plugins') {
      return 1;
    }

    if (b.name === 'Plugins' && a.name !== 'Plugins') {
      return -1;
    }

    if (a.name === 'Templates' && b.name !== 'Templates') {
      return 1;
    }

    if (b.name === 'Templates' && a.name !== 'Templates') {
      return -1;
    }

    return a.name.localeCompare(b.name);
  };

const getDirectories = (
  prefix: string = 'https://cdn.plitzi.com/website/assets/',
  items: TResource[] = [],
  defaultFolderName: string = 'All Resources'
): ResourceDirectory[] => {
  const directoriesMap: { [key: string]: TResource[] } = {};

  items.forEach(item => {
    const { id, type } = item;
    if (id.startsWith(prefix) && !['plugin', 'template'].includes(type)) {
      const pathAfterPrefix = id.substring(prefix.length);
      const parts = pathAfterPrefix.split('/');
      const directoryName = parts.length > 1 ? parts[0] : defaultFolderName;

      if (!(directoriesMap[directoryName] as undefined | TResource[])) {
        directoriesMap[directoryName] = [];
      }

      directoriesMap[directoryName].push(item);
    } else if (type === 'plugin') {
      if (!(directoriesMap['Plugins'] as undefined | TResource[])) {
        directoriesMap['Plugins'] = [];
      }

      directoriesMap['Plugins'].push(item);
    } else if (type === 'template') {
      if (!(directoriesMap['Templates'] as undefined | TResource[])) {
        directoriesMap['Templates'] = [];
      }

      directoriesMap['Templates'].push(item);
    } else {
      if (!(directoriesMap[defaultFolderName] as undefined | TResource[])) {
        directoriesMap[defaultFolderName] = [];
      }

      directoriesMap[defaultFolderName].push(item);
    }
  });

  return Object.entries(directoriesMap)
    .map(([name, items]) => ({ name, items, canDrop: !['Plugins', 'Templates'].includes(name) }))
    .sort(sortDirectories(defaultFolderName));
};

const ResourcesList = ({ className, prefix = '', items, onRemove }: ResourcesListProps) => {
  const { showModal } = useModal();
  const { addToast } = useToast();
  const [directories, setDirectories] = useState<ResourceDirectory[]>(() => getDirectories(prefix, items));

  useDidUpdateEffect(() => {
    setDirectories(getDirectories(prefix, items));
  }, [prefix, items]);

  const handleAddDirectory = useCallback(async () => {
    const response = await showModal<{ name: string }>(
      <Modal.Header>
        <h4>Add Directory</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <ResourceDirectoryForm directories={directories} onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (!response) {
      return;
    }

    const { name } = response;

    setDirectories(state => [...state, { name, items: [], canDrop: true }].sort(sortDirectories()));
  }, [showModal, directories]);

  const handleClickRemoveDirectory = useCallback(
    (name?: string) => {
      const directory = directories.find(dir => dir.name === name);
      if (!directory) {
        return;
      }

      if (directory.items.length > 0) {
        // eslint-disable-next-line quotes
        addToast("You can't remove this folder with resources, move or remove all of the resources", {
          appeareance: 'warning',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      setDirectories(state => state.filter(directory => directory.name !== name));
    },
    [addToast, directories]
  );

  return (
    <div className={classNames('flex w-full flex-col gap-4 overflow-y-auto', className)}>
      <Button size="sm" onClick={handleAddDirectory}>
        Add Directory
      </Button>
      {directories.map(directory => (
        <ResourcesDirectory
          key={directory.name}
          name={directory.name}
          items={directory.items}
          defaultDirectory={directory.name === 'All Resources'}
          canDrop={directory.canDrop}
          onRemoveDirectory={handleClickRemoveDirectory}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

export default ResourcesList;
