import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use } from 'react';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import NetworkContext from '@pmodules/Network/NetworkContext';

import ResourceCdnForm from './Models/ResourceCdnForm';
import ResourcesCdn from './ResourcesCdn';

const Resources = () => {
  const { mutate } = use(NetworkContext);
  const { showModal } = useModal();
  const { data, isLoading, mutate: mutateCdns } = useGraphQL('SpaceCdns');

  const handleClickAddCdn = useCallback(async () => {
    const response = await showModal<{
      name: string;
      domain: string;
      provider?: 's3' | 'r2';
      region?: string;
      endpoint?: string;
      bucketName?: string;
    }>(
      <Modal.Header>
        <h4>Add CDN Provider</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <ResourceCdnForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (!response) {
      return;
    }

    const { name, domain, provider, region, endpoint, bucketName } = response;

    const responseMutation = await mutate('SpaceAddCdn', { name, domain, provider, region, endpoint, bucketName });
    if (!responseMutation || responseMutation instanceof Error) {
      return;
    }

    void mutateCdns();
  }, [mutate, mutateCdns, showModal]);

  return (
    <div className="flex w-full grow basis-0 flex-col gap-4 overflow-y-auto">
      <Flex gap={2} direction="column">
        <Button size="sm" onClick={handleClickAddCdn} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          Add CDN Provider
        </Button>
        {/* <Input placeholder="Search" value={filter} onChange={handleChange} label="">
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input> */}
      </Flex>
      {!isLoading && (
        <div className="flex flex-col gap-4">
          {data?.SpaceCdns.edges.map((cdn, i) => (
            <ResourcesCdn key={i} identifier={cdn.identifier} name={cdn.name} />
          ))}
        </div>
      )}
      {isLoading && (
        <div className="flex grow flex-col items-center justify-center">
          <i className="fa-solid fa-sync fa-spin fa-3x" title="Loading" />
        </div>
      )}
    </div>
  );

  // return (
  //   <div className="flex w-full grow basis-0 flex-col overflow-y-auto">
  //     <ResourceManager
  //       className="shrink-0"
  //       uploadTypes={uploadTypes}
  //       onUploaded={handleUploaded}
  //       onUploadAdded={handleUploadAdded}
  //     />
  //     {!loading && finalResources.length > 0 && (
  //       <div className="flex min-h-[200px] grow basis-0 flex-col overflow-y-auto px-2">
  //         <Heading as="h5" className="mb-2">
  //           Uploaded
  //         </Heading>
  //         <div className="grid grid-cols-2 gap-2 overflow-y-auto pb-1">
  //           {finalResources.map(resource => (
  //             <Resource
  //               className={classNames({ 'col-span-2': resource.type === 'plugin' })}
  //               key={resource.id}
  //               id={resource.id}
  //               type={resource.type}
  //               title={resource.name}
  //               src={resource.path}
  //               metadata={resource.type === 'plugin' ? resource.metadata : undefined}
  //               onRemove={handleResourceRemoved(resource)}
  //             />
  //           ))}
  //         </div>
  //       </div>
  //     )}
  //     {loading && (
  //       <div className="flex grow flex-col items-center justify-center">
  //         <i className="fa-solid fa-sync fa-spin fa-3x" title="Loading" />
  //       </div>
  //     )}
  //   </div>
  // );
};

export default Resources;
