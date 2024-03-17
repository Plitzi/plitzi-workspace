// Packages
import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import FileUpload from '@plitzi/plitzi-ui-components/FileUpload';
import Heading from '@plitzi/plitzi-ui-components/Heading';

// Relatives
import TemporalResource from './TemporalResource';
import getPluginManifest from './helpers/getPluginManifest';

const defaultUploadTypes = ['jpg', 'jpeg', 'png'];

const ResourceManager = props => {
  const { uploadTypes = defaultUploadTypes, mutate = noop, onUploaded = noop, onUploadAdded = noop } = props;
  const [files, setFiles] = useState([]);

  const handleChange = useCallback(
    async data => {
      const files = Array.from(data);
      const filesApproved = [];
      for (const file of files) {
        file.id = Date.now() + Math.floor(Math.random() * 200);
        const { type } = file;
        switch (type.split('/')[0]) {
          case 'image':
          case 'video':
            [file.resourceType] = type.split('/');
            break;

          case 'application': {
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
    [setFiles]
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
    <div className="w-full flex flex-col overflow-y-auto">
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

ResourceManager.propTypes = {
  uploadTypes: PropTypes.array,
  mutate: PropTypes.func,
  onUploaded: PropTypes.func,
  onUploadAdded: PropTypes.func
};

export default ResourceManager;
