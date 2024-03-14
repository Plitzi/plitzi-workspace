// Packages
import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import Button from '@plitzi/plitzi-ui-components/Button';
import Input from '@plitzi/plitzi-ui-components/Input';

// Alias
import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import ResourceUploadStatus from './ResourceUploadStatus';
import ResourceContent from './ResourceContent';
import ResourceType from './ResourceType';

const Resource = props => {
  const {
    id = '',
    type = 'image',
    src = '',
    title = '',
    className = '',
    file,
    onUploaded = noop,
    onError: onErrorProp = noop,
    onUploadCancel = noop,
    onRemove = noop
  } = props;
  const { onDragStart } = useDragElement({ type, attributes: { src } });
  const { mutate } = useContext(NetworkContext);
  const { showModal } = useModal();
  const [isUploaded, setIsUploaded] = useState(!!id);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressUpload, setProgressUpload] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState(undefined);
  const { addToast } = useToast();
  const abortHandler = useRef(null);

  const onProgress = ev => {
    const progress = ev.loaded / ev.total;
    setProgressUpload(Math.round(progress * 100));
    if (progress === 1) {
      setProcessing(true);
    }
  };

  const onAbortPossible = abortHandlerInternal => {
    abortHandler.current = abortHandlerInternal;
  };

  const onError = e => {
    console.log(e);
    onErrorProp(e);
  };

  const handleClickUpload = async () => {
    if (isUploaded) {
      addToast('Resource already uploaded', {
        appeareance: 'info',
        autoDismiss: true,
        placement: 'top-right'
      });

      return;
    }

    setUploading(true);
    const response = await mutate(
      'SpaceAddResource',
      {
        resource: file
      },
      false,
      false,
      {
        customFetch: true,
        onProgress,
        onAbortPossible,
        onError
      }
    );

    if (response instanceof Error) {
      setError(response);
      setProgressUpload(0);
    } else {
      setIsUploaded(true);
      onUploaded(file);
    }

    setUploading(false);
    setProcessing(false);
    abortHandler.current = null;
  };

  useEffect(() => {
    return () => {
      if (abortHandler.current && uploading && !isUploaded) {
        abortHandler.current();
        setUploading(false);
        setProgressUpload(0);
        abortHandler.current = null;
      }
    };
  }, [abortHandler.current, isUploaded]);

  const handleClickCancelUpload = useCallback(() => {
    if (abortHandler.current && uploading && !isUploaded) {
      abortHandler.current();
      abortHandler.current = null;
      setUploading(false);
      setProgressUpload(0);
    }

    onUploadCancel(file);
  }, [abortHandler.current, file, isUploaded, onUploadCancel, setUploading, setProgressUpload]);

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

      if (response.result && isUploaded && id) {
        setProcessing(true);
        await mutate('SpaceRemoveResource', { resourceId: id });
        setProcessing(false);
        onRemove(id);
      }
    },
    [id, isUploaded, onRemove, showModal]
  );

  const handleMouseEnter = () => setHovered(true);

  const handleMouseLeave = () => setHovered(false);

  if (!isUploaded) {
    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={classNames(
          'w-full flex relative border border-gray-300 select-none rounded-md overflow-hidden',
          className
        )}
      >
        <ResourceContent type={type} src={src} title={title} />
        <ResourceType type={type} />
        {(uploading || processing || hovered) && (
          <ResourceUploadStatus
            isUploaded={isUploaded}
            processing={processing}
            progressUpload={progressUpload}
            onUpload={handleClickUpload}
            onCancel={handleClickCancelUpload}
          />
        )}
        {error && (
          <div
            className="absolute bottom-1 left-1 bg-white p-1 rounded text-red-400 flex items-center justify-center"
            title={error}
          >
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={onDragStart}
      draggable
      className={classNames(
        'w-full flex relative border border-gray-300 select-none rounded-md overflow-hidden cursor-grabbing',
        className
      )}
      onClick={handleClick}
    >
      <ResourceContent type={type} src={src} title={title} />
      {hovered && (
        <div className="absolute top-1 right-1 bg-white rounded-full aspect-square flex items-center justify-center px-1 cursor-pointer">
          <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={handleClickRemove} />
        </div>
      )}
      <ResourceType type={type} />
      <div
        className="absolute top-1 left-1 bg-white rounded-full aspect-square flex items-center justify-center px-1 hover:text-blue-400 cursor-pointer"
        title="Information"
      >
        <i className="fa-solid fa-circle-info" />
      </div>
      {(uploading || processing) && (
        <ResourceUploadStatus
          isUploaded={isUploaded}
          processing={processing}
          progressUpload={progressUpload}
          onUpload={handleClickUpload}
          onCancel={handleClickCancelUpload}
        />
      )}
      {error && (
        <div
          className="absolute bottom-1 left-1 bg-white p-1 rounded text-red-400 flex items-center justify-center"
          title={error}
        >
          <i className="fa-solid fa-triangle-exclamation" />
        </div>
      )}
    </div>
  );
};

Resource.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  file: PropTypes.object,
  type: PropTypes.oneOf(['image', 'video', 'document']),
  title: PropTypes.string,
  src: PropTypes.string,
  onUploaded: PropTypes.func,
  onUploadCancel: PropTypes.func,
  onRemove: PropTypes.func,
  onError: PropTypes.func
};

export default Resource;
