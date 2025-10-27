import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import ResourceCdnForm from './Models/ResourceCdnForm';
import ResourcesCdn from './ResourcesCdn';

import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';

const Resources = () => {
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const { showModal } = useModal();
  const { data, isLoading, mutate: mutateCdns } = useGraphQL('SpaceCdns');

  const [collapsedCache, setCollapsedCache] = useStorage<Record<string, boolean | undefined>>(
    'builder-state.resources.cdn.collapsedCache',
    {}
  );

  const handleChangeCollapse = useCallback(
    (id: string, isCollapsed: boolean) => setCollapsedCache(state => ({ ...state, [id]: isCollapsed })),
    [setCollapsedCache]
  );

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
    if (!responseMutation.success) {
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
            <ResourcesCdn
              key={i}
              identifier={cdn.identifier}
              name={cdn.name}
              prefix={`${cdn.domain}/${cdn.prefix}/assets`}
              isCollapsed={collapsedCache[cdn.identifier] ?? true}
              onCollapse={handleChangeCollapse}
            />
          ))}
        </div>
      )}
      {isLoading && (
        <div className="flex grow flex-col items-center justify-center">
          <Icon icon="fa-solid fa-sync fa-spin fa-3x" title="Loading" />
        </div>
      )}
    </div>
  );
};

export default Resources;
