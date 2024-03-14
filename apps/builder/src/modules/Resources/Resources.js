// Packages
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Heading from '@plitzi/plitzi-ui-components/Heading';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import Resource from './ResourceManager/Resource';
import ResourceManager from './ResourceManager';

const Resources = () => {
  const { query } = useContext(NetworkContext);
  const [loading, setLoading] = useState(true);
  const [, /* hasNextPage */ setHasNextPage] = useState(false);
  const [resources, setResources] = useState([]);

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

  const handleUploaded = useCallback(() => {
    fetch('');
  }, [fetch]);

  useEffect(() => {
    fetch('');
  }, []);

  const uploadTypesMemo = useMemo(() => ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'mpeg', 'svg', 'webm'], []);

  return (
    <div className="w-full flex flex-col overflow-y-auto grow basis-0">
      <ResourceManager types={uploadTypesMemo} onUploaded={handleUploaded} />
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
