import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import { useState, useEffect, useRef, useCallback, use, useMemo } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import ResourceContent from './ResourceContent';
import ResourceUploadStatus from './ResourceUploadStatus';
import ResourceName from '../Resource/ResourceName';

import type {
  BuilderNetworkContextValue,
  PluginManifest,
  ResourceFile,
  ResourceType as TResourceType,
  ResourceWithFile
} from '@plitzi/sdk-shared';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';

export type TemporalResourceProps = {
  className?: string;
  cdnIdentifier?: string;
  id?: string;
  file?: ResourceFile;
  type?: TResourceType;
  title?: string;
  metadata?: PluginManifest;
  onUploaded?: (resource: ResourceWithFile) => void;
  onUploadCancel?: (file: File) => void;
  onError?: (e: Error) => void;
};

const TemporalResource = ({
  cdnIdentifier = '',
  id = '',
  type = 'image',
  title = '',
  className = '',
  file,
  metadata,
  onUploaded,
  onError: onErrorProp,
  onUploadCancel
}: TemporalResourceProps) => {
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const [isUploaded, setIsUploaded] = useState(!!id);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressUpload, setProgressUpload] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { addToast } = useToast();
  const abortHandler = useRef<null | (() => void)>(null);
  const src = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  const onProgress = useCallback((ev: { loaded: number; total: number }) => {
    const progress = ev.loaded / ev.total;
    setProgressUpload(Math.round(progress * 100));
    if (progress === 1) {
      setProcessing(true);
    }
  }, []);

  const onAbortPossible = useCallback((abortHandlerInternal: () => void) => {
    abortHandler.current = abortHandlerInternal;
  }, []);

  const onError = useCallback(
    (e: Error) => {
      console.log(e);
      onErrorProp?.(e);
    },
    [onErrorProp]
  );

  const handleClickUpload = useCallback(async () => {
    if (!file) {
      addToast('File missing', {
        appeareance: 'info',
        autoDismiss: true,
        placement: 'top-right'
      });

      return;
    }

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
      { cdnIdentifier, resource: file, type, compression: type === 'plugin' ? 'gzip' : undefined },
      false,
      false,
      { customFetch: true, onProgress, onAbortPossible, onError }
    );

    if (response.error instanceof Error) {
      setError(response.error instanceof Error ? response.error.message : response.error);
      setProgressUpload(0);
    } else if (file.type === 'plugin') {
      setIsUploaded(true);
      onUploaded?.({ ...response.result, file, metadata: file.metadata } as ResourceWithFile);
    } else {
      setIsUploaded(true);
      onUploaded?.({ ...response.result, file } as ResourceWithFile);
    }

    setUploading(false);
    setProcessing(false);
    abortHandler.current = null;
  }, [addToast, cdnIdentifier, file, isUploaded, mutate, onAbortPossible, onError, onProgress, onUploaded, type]);

  useEffect(() => {
    return () => {
      if (abortHandler.current && uploading && !isUploaded) {
        abortHandler.current();
        setUploading(false);
        setProgressUpload(0);
        abortHandler.current = null;
      }
    };
  }, [isUploaded, uploading]);

  const handleClickCancelUpload = useCallback(() => {
    if (abortHandler.current && uploading && !isUploaded) {
      abortHandler.current();
      abortHandler.current = null;
      setUploading(false);
      setProgressUpload(0);
    }

    if (file) {
      onUploadCancel?.(file);
    }
  }, [uploading, isUploaded, onUploadCancel, file]);

  const handleMouseEnter = useCallback(() => setHovered(true), []);

  const handleMouseLeave = useCallback(() => setHovered(false), []);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={classNames(
        'relative flex w-full overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
    >
      <ResourceContent type={type} src={src} title={title} metadata={metadata} size={file?.size} />
      {file?.name && <ResourceName name={file.name} />}
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
          className="absolute bottom-1 left-1 flex items-center justify-center rounded-sm bg-white p-1 text-red-400"
          title={error}
        >
          <i className="fa-solid fa-triangle-exclamation" />
        </div>
      )}
    </div>
  );
};

export default TemporalResource;
