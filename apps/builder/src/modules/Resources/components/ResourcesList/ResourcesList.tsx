/* eslint-disable quotes */
import Button from '@plitzi/plitzi-ui/Button';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import { useCallback, useState } from 'react';

import ResourceDirectoryForm from '@pmodules/Resources/Models/ResourceDirectoryForm';

import { getDirectories, sortDirectories } from './ListHelper';
import ResourcesDirectory from './ResourceDirectory';
import ResourcesListProvider from './ResourcesListProvider';

import type { Resource as TResource } from '@plitzi/sdk-shared';

export type ResourcesListProps = {
  className?: string;
  items: TResource[];
  prefix: string;
  cdnIdentifier: string;
  onChange?: () => void;
  onRemove?: (item: TResource) => void;
};

export type ResourceDirectory = {
  name: string;
  items: TResource[];
  canDrop: boolean;
  isDefault: boolean;
  canRemove: boolean;
};

const ResourcesList = ({ className, prefix = '', items, cdnIdentifier, onChange, onRemove }: ResourcesListProps) => {
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

    setDirectories(state =>
      [...state, { name, items: [], canDrop: true, isDefault: false, canRemove: true }].sort(sortDirectories)
    );
  }, [showModal, directories]);

  const handleClickRemoveDirectory = useCallback(
    (name?: string) => {
      const directory = directories.find(dir => dir.name === name);
      if (!directory) {
        return;
      }

      if (directory.items.length > 0) {
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
      <ResourcesListProvider>
        {directories.map(directory => (
          <ResourcesDirectory
            key={directory.name}
            name={directory.name}
            items={directory.items}
            isDefault={directory.isDefault}
            canRemove={directory.canRemove}
            canDrop={directory.canDrop}
            cdnIdentifier={cdnIdentifier}
            onRemoveDirectory={handleClickRemoveDirectory}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </ResourcesListProvider>
    </div>
  );
};

export default ResourcesList;
