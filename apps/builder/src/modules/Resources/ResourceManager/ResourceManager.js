// Packages
import React, { useCallback, useState } from 'react';
import noop from 'lodash/noop';
import FileUpload from '@plitzi/plitzi-ui-components/FileUpload';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import classNames from 'classnames';

// Relatives
import TemporalResource from './TemporalResource';
import getPluginManifest from './helpers/getPluginManifest';

const defaultUploadTypes = ['jpg', 'jpeg', 'png'];

/**
 * @param {{
 *   className?: string;
 *   uploadTypes?: string[];
 *   mutate?: (data: any) => void;
 *   onUploaded?: (resource: any) => void;
 *   onUploadAdded?: (file: File) => boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const ResourceManager = props => {
  const { className, uploadTypes = defaultUploadTypes, mutate = noop, onUploaded = noop, onUploadAdded = noop } = props;
  const [files, setFiles] = useState([]);

  const handleChange = useCallback(
    async data => {
      const files = Array.from(data);
      const filesApproved = [];
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
            [file.resourceType] = type.split('/');
            break;

          case 'application/zip': {
            [file.resourceType] = type.split('/');
            const pluginManifest = await getPluginManifest(file);
            if (pluginManifest) {
              file.resourceType = 'plugin';
              file.metadata = pluginManifest;
            }

            break;
          }

          default:
        }

        if (onUploadAdded === noop || onUploadAdded(file)) {
          filesApproved.push(file);
        }
      }

      setFiles(state => [...state, ...filesApproved]);
    },
    [setFiles, onUploadAdded, getPluginManifest]
  );

  const handleResourceUploaded = useCallback(
    resource => {
      const { file } = resource;
      setFiles(state => state.filter(f => f !== file));
      onUploaded(resource);
    },
    [setFiles, onUploaded]
  );

  const handleResourceUploadCancelled = useCallback(
    file => {
      setFiles(state => state.filter(f => f !== file));
    },
    [setFiles]
  );

  return (
    <div className={classNames('w-full flex flex-col overflow-y-auto', className)}>
      <FileUpload
        multiple
        canDragAndDrop
        label="Select a resource file to upload"
        onChange={handleChange}
        onSelect={handleChange}
        types={uploadTypes}
        className="p-4 h-40 m-1 flex flex-col"
        maxSize={10240000}
      />
      {files && files.length > 0 && (
        <div className="flex flex-col px-2 mb-4">
          <Heading type="h5" className="mb-2">
            To Upload
          </Heading>
          <div className="grid gap-2 overflow-y-auto">
            {files
              .filter(file => !!file.resourceType)
              .map(file => (
                <TemporalResource
                  key={file.id}
                  file={file}
                  type={file.resourceType}
                  title={file.name}
                  metadata={file.metadata}
                  src={URL.createObjectURL(file)}
                  mutate={mutate}
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
