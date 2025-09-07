import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import { useState, use, useCallback } from 'react';

import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import NetworkContext from '@pmodules/Network/NetworkContext';

import ResourceContent from './ResourceManager/ResourceContent';
import ResourceName from './ResourceManager/ResourceName';
import ResourceType from './ResourceManager/ResourceType';
import ResourceUploadStatus from './ResourceManager/ResourceUploadStatus';

import type { PluginManifest } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourceProps = {
  className?: string;
  id?: string;
  type?: 'image' | 'video' | 'document' | 'application' | 'plugin';
  src?: string;
  title?: string;
  metadata?: PluginManifest;
  onRemove?: (id: string) => void;
};

const Resource = ({
  className = '',
  id = '',
  type = 'image',
  src = '',
  title = '',
  metadata,
  onRemove
}: ResourceProps) => {
  const { onDragStart } = useDragElement({ type, attributes: { src } });
  const { mutate } = use(NetworkContext);
  const { showModal, showDialog } = useModal();
  const [hovered, setHovered] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { addToast } = useToast();

  const handleClickCopyUrl = useCallback(() => {
    void navigator.clipboard.writeText(src);
    addToast('URL has been copied to clipboard', {
      appeareance: 'info',
      autoDismiss: true,
      placement: 'top-right'
    });
  }, [addToast, src]);

  const handleClick = useCallback(() => {
    if (type === 'plugin') {
      return;
    }

    void showModal(
      <Modal.Header>
        <h4 className="font-bold">Resource Details</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="mx-4 mt-2 mb-4 flex gap-4">
          <div className="flex">
            <div className="flex flex-col">
              <Heading as="h5" className="mb-1">
                Preview
              </Heading>
              <div className="rounded-sm border border-gray-400 p-1">
                <ResourceContent className="h-[96px] w-[96px] rounded-sm" type={type} src={src} title={title} />
              </div>
            </div>
          </div>
          <div className="flex grow basis-0 flex-col overflow-hidden">
            <Heading as="h5" className="mb-1">
              Information
            </Heading>
            <div className="flex flex-col">
              <div className="flex items-center">
                <Heading as="h6" className="w-[50px] font-bold">
                  Title:
                </Heading>
                <div className="ml-2 truncate" title={title}>
                  {title}
                </div>
              </div>
              <div className="flex items-center">
                <Heading as="h6" className="w-[50px] font-bold">
                  Type:
                </Heading>
                <div className="ml-2">{type}</div>
              </div>
              <div className="flex items-center">
                <Heading as="h6" className="w-[50px] font-bold">
                  Url:
                </Heading>
                <Input value={src} size="sm" className="mx-2 grow basis-0" readOnly />
                <Button title="Copy Url" className="rounded-sm" onClick={handleClickCopyUrl}>
                  <i className="fa-solid fa-copy" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
    );
  }, [handleClickCopyUrl, showModal, src, title, type]);

  const handleClickRemove = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Resource</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="mx-4 my-2">
            <h4>Do you want to remove this item ?</h4>
          </div>
        </Modal.Body>,
        undefined,
        undefined,
        id
      );

      if (response) {
        setRemoving(true);
        await mutate('SpaceRemoveResource', { resourceId: id });
        setRemoving(false);
        onRemove?.(id);
      }
    },
    [id, mutate, onRemove, showDialog]
  );

  const handleMouseEnter = () => setHovered(true);

  const handleMouseLeave = () => setHovered(false);

  const canDrag = ['video', 'image'].includes(type);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={canDrag ? onDragStart : undefined}
      draggable={canDrag}
      className={classNames(
        'relative flex w-full overflow-hidden rounded-md border border-gray-300 select-none',
        { 'min-h-[164px]': type === 'plugin', 'min-h-[80px]': type !== 'plugin', 'cursor-grabbing': !canDrag },
        className
      )}
      onClick={handleClick}
    >
      <ResourceContent type={type} src={src} title={title} metadata={metadata} isUploaded />
      {hovered && (
        <div className="absolute top-1 right-1 flex aspect-square cursor-pointer items-center justify-center rounded-full bg-white px-1">
          <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={handleClickRemove} />
        </div>
      )}
      <ResourceType type={type} />
      {title && <ResourceName name={title} />}
      <div
        className="absolute top-1 left-1 flex aspect-square cursor-pointer items-center justify-center rounded-full bg-white px-1 hover:text-blue-400"
        title="Information"
      >
        <i className="fa-solid fa-circle-info" />
      </div>
      {removing && <ResourceUploadStatus processing={removing} />}
    </div>
  );
};

export default Resource;
