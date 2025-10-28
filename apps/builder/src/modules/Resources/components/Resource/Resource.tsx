import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import Icon from '@plitzi/plitzi-ui/Icon';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useState, use, useCallback } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import ResourceContent from '../ResourceManager/ResourceContent';
import ResourceImage from './subTypes/ResourceImage';
import ResourcePlugin from './subTypes/ResourcePlugin/ResourcePlugin';
import ResourceTemplate from './subTypes/ResourceTemplate';
import ResourceUnknown from './subTypes/ResourceUnknown';
import ResourceVideo from './subTypes/ResourceVideo';

import type { PluginManifest, ResourceType as TResourceType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourceProps = {
  className?: string;
  id: string;
  cdnIdentifier: string;
  type?: TResourceType;
  src?: string;
  title?: string;
  metadata?: PluginManifest;
  onRemove?: (id: string) => void;
};

const Resource = ({
  className = '',
  id,
  cdnIdentifier,
  type = 'image',
  src = '',
  title = '',
  metadata,
  onRemove
}: ResourceProps) => {
  const { mutate } = use(NetworkContext);
  const { showModal, showDialog } = useModal();
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
      <Modal.Header size="sm" alignItems="center">
        <h4 className="font-bold">Resource Details</h4>
      </Modal.Header>,
      <Modal.Body direction="row" gap={4} size="sm">
        <div className="flex">
          <div className="flex flex-col">
            <Heading as="h5" className="mb-1">
              Preview
            </Heading>
            <div className="group relative rounded-sm border border-gray-400 p-1">
              <ResourceContent className="h-24 w-24 rounded-sm" type={type} src={src} title={title} />
              {(type === 'image' || type === 'video') && (
                <a
                  target="_blank"
                  href={src}
                  className="invisible absolute top-2 right-2 cursor-pointer group-hover:visible"
                >
                  <Icon
                    icon="fa-solid fa-arrow-up-right-from-square"
                    className="rounded-sm bg-white p-1"
                    size="custom"
                  />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex grow basis-0 flex-col overflow-hidden">
          <Heading as="h5" className="mb-1">
            Information
          </Heading>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Heading as="h6" className="w-[50px] text-end font-bold">
                Title:
              </Heading>
              <div className="font-sm truncate" title={title}>
                {title}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Heading as="h6" className="w-[50px] text-end font-bold">
                Type:
              </Heading>
              <div className="font-sm">{type}</div>
            </div>
            <div className="flex items-center gap-2">
              <Heading as="h6" className="w-[50px] text-end font-bold">
                Url:
              </Heading>
              <Input value={src} size="xs" className="grow basis-0" readOnly />
              <Button title="Copy Url" size="sm" onClick={handleClickCopyUrl}>
                <i className="fa-solid fa-copy" />
              </Button>
            </div>
          </div>
        </div>
      </Modal.Body>,
      undefined,
      { className: { card: 'min-w-[500px]' } }
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
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (response) {
        setRemoving(true);
        await mutate('SpaceRemoveResource', { identifier: id, cdnIdentifier });
        setRemoving(false);
        onRemove?.(id);
      }
    },
    [id, cdnIdentifier, mutate, onRemove, showDialog]
  );

  const sharedProps = {
    className,
    id,
    cdnIdentifier,
    title,
    removing,
    onClick: handleClick,
    onRemove: handleClickRemove
  };

  switch (type) {
    case 'template':
      return <ResourceTemplate {...sharedProps} src={src} />;

    case 'image':
      return <ResourceImage {...sharedProps} src={src} />;

    case 'video':
      return <ResourceVideo {...sharedProps} src={src} />;

    case 'plugin':
      return <ResourcePlugin {...sharedProps} src={src} metadata={metadata} />;

    default:
      return <ResourceUnknown {...sharedProps} type={type} />;
  }
};

export default Resource;
