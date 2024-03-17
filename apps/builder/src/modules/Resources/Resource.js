// Packages
import React, { useState, useContext, useCallback } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import Button from '@plitzi/plitzi-ui-components/Button';
import Input from '@plitzi/plitzi-ui-components/Input';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import ResourceContent from './ResourceManager/ResourceContent';
import ResourceType from './ResourceManager/ResourceType';
import ResourceUploadStatus from './ResourceManager/ResourceUploadStatus';

const Resource = props => {
  const {
    className = '',
    id = '',
    type = 'image',
    src = '',
    title = '',
    metadata = emptyObject,
    onRemove = noop
  } = props;
  const { onDragStart } = useDragElement({ type, attributes: { src } });
  const { mutate } = useContext(NetworkContext);
  const { showModal } = useModal();
  const [hovered, setHovered] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { addToast } = useToast();

  const handleClickCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(src);
    addToast('URL has been copied to clipboard', {
      appeareance: 'info',
      autoDismiss: true,
      placement: 'top-right'
    });
  }, [addToast, src]);

  const handleClick = useCallback(() => {
    showModal(
      <Modal.Header>
        <h4 className="font-bold">Resource Details</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="mx-4 mt-2 mb-4 flex gap-4">
          <div className="flex">
            <div className="flex flex-col">
              <Heading type="h5" className="mb-1">
                Preview
              </Heading>
              <div className="border rounded border-gray-400 p-1">
                <ResourceContent className="w-[96px] h-[96px] rounded" type={type} src={src} title={title} />
              </div>
            </div>
          </div>
          <div className="flex flex-col basis-0 grow overflow-hidden">
            <Heading type="h5" className="mb-1">
              Information
            </Heading>
            <div className="flex flex-col">
              <div className="flex items-center">
                <Heading type="h6" className="font-bold w-[50px]">
                  Title:
                </Heading>
                <div className="ml-2 truncate" title={title}>
                  {title}
                </div>
              </div>
              <div className="flex items-center">
                <Heading type="h6" className="font-bold w-[50px]">
                  Type:
                </Heading>
                <div className="ml-2">{type}</div>
              </div>
              <div className="flex items-center">
                <Heading type="h6" className="font-bold w-[50px]">
                  Url:
                </Heading>
                <Input value={src} size="sm" className="mx-2 grow basis-0" inputClassName="rounded" readOnly />
                <Button title="Copy Url" className="rounded" onClick={handleClickCopyUrl}>
                  <i className="fa-solid fa-copy" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );
  }, [handleClickCopyUrl, showModal, src, title, type]);

  const handleClickRemove = useCallback(
    async e => {
      e.stopPropagation();
      const response = await showModal(
        <Modal.Header>
          <h4>Remove Resource</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="mx-4 my-2">
            <h4>Do you want to remove this item ?</h4>
          </div>
        </Modal.Body>,
        null,
        { placement: 'center', renderFooter: true }
      );

      if (response.result && id) {
        setRemoving(true);
        await mutate('SpaceRemoveResource', { resourceId: id });
        setRemoving(false);
        onRemove(id);
      }
    },
    [id, onRemove, showModal]
  );

  const handleMouseEnter = () => setHovered(true);

  const handleMouseLeave = () => setHovered(false);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={type !== 'plugin' ? onDragStart : undefined}
      draggable={type !== 'plugin'}
      className={classNames(
        'w-full flex relative border border-gray-300 select-none rounded-md overflow-hidden',
        { 'cursor-grabbing': type !== 'plugin' },
        className
      )}
      onClick={handleClick}
    >
      <ResourceContent type={type} src={src} title={title} metadata={metadata} />
      {hovered && (
        <div className="absolute top-1 right-1 bg-white rounded-full aspect-square flex items-center justify-center px-1 cursor-pointer">
          <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={handleClickRemove} />
        </div>
      )}
      <ResourceType type={type} />
      {removing && <ResourceUploadStatus processing={removing} />}
      <div
        className="absolute top-1 left-1 bg-white rounded-full aspect-square flex items-center justify-center px-1 hover:text-blue-400 cursor-pointer"
        title="Information"
      >
        <i className="fa-solid fa-circle-info" />
      </div>
    </div>
  );
};

Resource.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  file: PropTypes.object,
  type: PropTypes.oneOf(['image', 'video', 'document', 'plugin']),
  title: PropTypes.string,
  src: PropTypes.string,
  metadata: PropTypes.object,
  onUploaded: PropTypes.func,
  onUploadCancel: PropTypes.func,
  onRemove: PropTypes.func,
  onError: PropTypes.func
};

export default Resource;
