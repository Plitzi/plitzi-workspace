// Packages
import React, { useContext, useEffect, useMemo, useState } from 'react';
import FileUpload from '@plitzi/plitzi-ui-components/FileUpload';
import Heading from '@plitzi/plitzi-ui-components/Heading';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import Resource from './Resource';

const Resources = () => {
  const { query } = useContext(NetworkContext);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, /* hasNextPage */ setHasNextPage] = useState(false);
  const [resources, setResources] = useState([]);

  const handleChange = data => {
    const files = Array.from(data);
    files.forEach(file => {
      file.id = Date.now() + Math.floor(Math.random() * 200);
    });

    setFiles(state => [...state, ...files]);
  };

  const handleResourceUploaded = file => {
    setFiles(state => state.filter(f => f !== file));
    fetch('');
  };

  const handleResourceUploadCancelled = file => {
    setFiles(state => state.filter(f => f !== file));
  };

  const handleResourceRemoved = (/* id */) => {
    fetch('');
  };

  const fetch = async search => {
    setLoading(true);
    const result = await query(
      'SpaceResources',
      { filter: { name: { contains: search } }, pageSize: 30 },
      'network-only'
    );
    if (!(result instanceof Error)) {
      const { pageInfo, edges } = result;
      setResources(edges);
      setHasNextPage(pageInfo.hasNextPage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('');
  }, []);

  const uploadTypesMemo = useMemo(() => ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'mpeg', 'svg', 'webm'], []);

  return (
    <div className="w-full flex flex-col overflow-y-auto grow basis-0">
      <FileUpload
        multiple
        canDragAndDrop
        label="Select a resource file to upload"
        onChange={handleChange}
        onSelect={handleChange}
        types={uploadTypesMemo}
        className="p-4 h-40 m-1 flex flex-col"
        maxSize={10240000}
      />
      {files && files.length > 0 && (
        <div className="flex flex-col px-2 mb-4">
          <Heading type="h5" className="mb-2">
            To Upload
          </Heading>
          <div className="grid gap-2 overflow-y-auto">
            {files.map(file => (
              <Resource
                key={file.id}
                file={file}
                type={file.type.split('/')[0]}
                title={file.name}
                src={URL.createObjectURL(file)}
                onUploaded={handleResourceUploaded}
                onUploadCancel={handleResourceUploadCancelled}
              />
            ))}
          </div>
        </div>
      )}
      {!loading && resources && resources.length > 0 && (
        <div className="flex flex-col px-2">
          <Heading type="h5" className="mb-2">
            Uploaded
          </Heading>
          <div className="grid grid-cols-2 gap-2 pb-1 overflow-y-auto">
            {resources.map(resource => (
              <Resource
                key={resource.id}
                id={resource.id}
                type={resource.type.split('/')[0]}
                title={resource.name}
                src={resource.path}
                onRemove={handleResourceRemoved}
              />
            ))}
          </div>
        </div>
      )}
      {loading && (
        <div className="flex flex-col grow items-center justify-center">
          <i className="fa-solid fa-sync fa-spin fa-3x" title="Loading" />
        </div>
      )}
    </div>
  );
};

Resources.propTypes = {};

export default Resources;
