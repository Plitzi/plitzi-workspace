// Packages
import React, { useState, useEffect, useRef, useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import ResourceUploadStatus from './ResourceUploadStatus';
import ResourceContent from './ResourceContent';
import ResourceType from './ResourceType';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   file?: object;
 *   type?: 'image' | 'video' | 'document' | 'application' | 'plugin';
 *   title?: string;
 *   src?: string;
 *   metadata?: object;
 *   mutate?: (data: any) => void;
 *   onUploaded?: (resource: any) => void;
 *   onUploadCancel?: (file: File) => void;
 *   onError?: (e: Error) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TemporalResource = props => {
  const {
    id = '',
    type = 'image',
    src = '',
    title = '',
    className = '',
    file,
    metadata = emptyObject,
    mutate = noop,
    onUploaded = noop,
    onError: onErrorProp = noop,
    onUploadCancel = noop
  } = props;
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
      { resource: file, type, compression: type === 'plugin' ? 'gzip' : undefined },
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
    } else if (type === 'plugin') {
      setIsUploaded(true);
      onUploaded({ ...response, file, metadata: file.metadata });
    } else {
      setIsUploaded(true);
      onUploaded({ ...response, file });
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

  const handleMouseEnter = () => setHovered(true);

  const handleMouseLeave = () => setHovered(false);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={classNames(
        'w-full flex relative border border-gray-300 select-none rounded-md overflow-hidden',
        className
      )}
    >
      <ResourceContent type={type} src={src} title={title} metadata={metadata} size={file.size} />
      <ResourceType type={type} />
      {file?.name && (
        <div className="absolute bottom-0 left-0 bg-gray-300 p-1 rounded-tr flex items-center text-xs px-2 truncate max-w-[200px] overflow-hidden">
          <div className="truncate" title={file.name}>
            {file.name}
          </div>
        </div>
      )}
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
};

export default TemporalResource;
