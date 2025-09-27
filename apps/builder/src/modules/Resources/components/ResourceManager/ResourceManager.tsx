import FileUpload from '@plitzi/plitzi-ui/FileUpload';
import Heading from '@plitzi/plitzi-ui/Heading';
import classNames from 'classnames';
import { useCallback, useState } from 'react';

import getPluginManifest from './helpers/getPluginManifest';
import TemporalResource from './TemporalResource';

import type { ResourceFile, ResourceWithFile } from '../../types';

const defaultUploadTypes = ['jpg', 'jpeg', 'png'];

export type ResourceManagerProps = {
  className?: string;
  cdnIdentifier?: string;
  uploadTypes?: string[];
  onUploaded?: (resource: ResourceWithFile) => void;
  onUploadAdded?: (file: ResourceFile) => boolean;
};

const ResourceManager = ({
  className,
  cdnIdentifier,
  uploadTypes = defaultUploadTypes,
  onUploaded,
  onUploadAdded
}: ResourceManagerProps) => {
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleError = useCallback((error?: string) => setError(error), []);

  const handleChange = useCallback(
    async (data?: File[]) => {
      if (!data) {
        return;
      }

      const files: ResourceFile[] = data as ResourceFile[];
      const filesApproved: ResourceFile[] = [];
      for (const file of files) {
        file.id = Date.now() + Math.floor(Math.random() * 200);
        const { type } = file;
        switch (type) {
          case 'image/gif':
          case 'image/bmp':
          case 'image/x-ms-bmp':
          case 'image/jpg':
          case 'image/jpeg':
          case 'image/png':
          case 'image/webp':
          case 'video/webm':
          case 'video/mp4':
          case 'video/mpeg':
          case 'image/svg+xml':
          case 'application/json':
            [file.resourceType] = type.split('/') as [ResourceFile['resourceType']];
            break;

          case 'application/zip': {
            [file.resourceType] = type.split('/') as [ResourceFile['resourceType']];
            const pluginManifest = await getPluginManifest(file);
            if (pluginManifest) {
              file.resourceType = 'plugin';
              file.metadata = pluginManifest;
            }

            break;
          }

          default:
        }

        if (onUploadAdded?.(file)) {
          filesApproved.push(file);
        }
      }

      setFiles(state => [...state, ...filesApproved]);
    },
    [setFiles, onUploadAdded]
  );

  const handleResourceUploaded = useCallback(
    (resource: ResourceWithFile) => {
      const { file } = resource;
      setFiles(state => state.filter(f => f !== file));
      onUploaded?.(resource);
    },
    [setFiles, onUploaded]
  );

  const handleResourceUploadCancelled = useCallback(
    (file: File) => {
      setFiles(state => state.filter(f => f !== file));
    },
    [setFiles]
  );

  return (
    <div className={classNames('flex w-full flex-col overflow-y-auto', className)}>
      <FileUpload
        multiple
        canDragAndDrop
        onChange={handleChange}
        onError={handleError}
        error={error}
        types={uploadTypes}
        className="border-primary-500 mb-2 h-40 p-4"
        size="sm"
        maxSize={10240000}
      />
      {files.length > 0 && (
        <div className="mb-4 flex flex-col px-2">
          <Heading as="h5" className="mb-2">
            To Upload
          </Heading>
          <div className="grid gap-2 overflow-y-auto">
            {files
              .filter(file => !!(file.resourceType as string))
              .map(file => (
                <TemporalResource
                  key={file.id}
                  cdnIdentifier={cdnIdentifier}
                  file={file}
                  type={file.resourceType}
                  title={file.name}
                  metadata={file.metadata}
                  src={URL.createObjectURL(file)}
                  onUploaded={handleResourceUploaded}
                  onUploadCancel={handleResourceUploadCancelled}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceManager;
