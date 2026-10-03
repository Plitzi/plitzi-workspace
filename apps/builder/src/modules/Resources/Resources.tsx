import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import ResourcesCdn from './components/ResourcesCdn';
import ResourceCdnForm from './Models/ResourceCdnForm';

import type { ResourceCdnFormValues } from './Models/ResourceCdnForm';

const Resources = () => {
  const { mutate } = useBuilderNetwork();
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
    const response = await showModal<ResourceCdnFormValues>(
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

    const { name, provider, endpoint, bucketName, region, visibility, domain } = response;
    const responseMutation = await mutate('SpaceAddCdn', {
      name,
      provider,
      endpoint,
      buckets: [{ bucketName, region, visibility, domain }]
    });
    if (!responseMutation.success) {
      return;
    }

    void mutateCdns();
  }, [mutate, mutateCdns, showModal]);

  const handleChange = useCallback(() => void mutateCdns(), [mutateCdns]);

  const handleRemove = useCallback(() => void mutateCdns(), [mutateCdns]);

  return (
    <div className="flex w-full grow basis-0 flex-col gap-4 overflow-y-auto p-2">
      <Flex gap={2} direction="column">
        <Button size="sm" onClick={handleClickAddCdn} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          Add CDN Provider
        </Button>
      </Flex>
      {!isLoading && (
        <div className="flex flex-col gap-4">
          {data?.SpaceCdns.edges.map(cdn => (
            <ResourcesCdn
              key={cdn.identifier}
              cdn={cdn}
              isCollapsed={collapsedCache[cdn.identifier] ?? true}
              onCollapse={handleChangeCollapse}
              onChange={handleChange}
              onRemove={handleRemove}
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
