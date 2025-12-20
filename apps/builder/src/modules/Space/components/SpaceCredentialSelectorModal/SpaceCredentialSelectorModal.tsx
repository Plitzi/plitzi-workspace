import Button from '@plitzi/plitzi-ui/Button';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import useDisclosure from '@plitzi/plitzi-ui/hooks/useDisclosure';
import Modal from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import SpaceCredentialForm from '@pmodules/Space/Models/SpaceCredentialForm';

import ModalBody from './ModalBody';

import type { BuilderNetworkContextValue, SpaceCredential, SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { spaceCredentialFormSchema } from '@pmodules/Space/Models/SpaceCredentialForm';
import type { MouseEvent, ReactNode } from 'react';
import type z from 'zod';

export type SpaceCredentialSelectorModalProps = {
  className?: string;
  children?: ReactNode;
  selected?: string;
  providersSupported?: SpaceCredentialProvider[];
  onSelect?: (identifier: string) => void;
};

const SpaceCredentialSelectorModal = ({
  providersSupported,
  children,
  className,
  selected: selectedProp,
  onSelect
}: SpaceCredentialSelectorModalProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const [selected, setSelected] = useState(selectedProp);
  const [newCredential, setNewCredential] = useState<
    Omit<SpaceCredential, 'identifier' | 'createdAt' | 'updatedAt'> | undefined
  >(undefined);
  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleClickNewCredential = useCallback(() => {
    setNewCredential({ name: '', provider: 'r2', inUse: false, usedIn: [] });
  }, []);

  const handleCloseForm = useCallback(() => setNewCredential(undefined), []);

  const [id, open, onOpen, onClose] = useDisclosure();
  const { data = [], mutate } = useGraphQL(open ? 'SpaceCredentials' : null, data => data?.SpaceCredentials.edges, {});

  useDidUpdateEffect(() => {
    if (open) {
      setSelected(selectedProp);
    }
  }, [selectedProp, open]);

  const handleSubmitForm = useCallback(
    async (_e: MouseEvent | undefined, values: z.infer<typeof spaceCredentialFormSchema>) => {
      const response = await mutateNetwork('SpaceAddCredential', {
        name: values.name,
        provider: values.provider,
        data:
          values.provider === 'r2' || values.provider === 's3'
            ? { accessKeyId: values.accessKeyId, secretAccessKey: values.secretAccessKey }
            : values.fields
      });
      if (!response.success) {
        return;
      }

      void mutate();
      setNewCredential(undefined);
    },
    [mutate, mutateNetwork]
  );

  const handleSubmitModal = useCallback(
    (e: MouseEvent) => {
      onSelect?.(selected as string);
      void onClose(e);
    },
    [onClose, onSelect, selected]
  );

  const handleSelectCredential = useCallback((identifier: string) => setSelected(identifier), []);

  const handleRemoveCredential = useCallback(
    async (identifier: string) => {
      const response = await mutateNetwork('SpaceRemoveCredential', { identifier });
      if (!response.success) {
        return;
      }

      void mutate();
      setNewCredential(undefined);
    },
    [mutate, mutateNetwork]
  );

  return (
    <>
      <div className={className} onClick={onOpen}>
        {children}
      </div>
      <Modal onClick={handleClick} onClose={onClose} id={id} open={open} size="sm" className={{ card: 'w-125' }}>
        <Modal.Header>
          <Modal.HeaderIcon icon="fa-solid fa-key" />
          Space Credentials
        </Modal.Header>
        <Modal.Body gap={4}>
          {newCredential && <SpaceCredentialForm onSubmit={handleSubmitForm} onClose={handleCloseForm} />}
          {!newCredential && (
            <ModalBody
              providersSupported={providersSupported}
              credentials={data}
              credentialSelected={selected}
              onClickAddCredential={handleClickNewCredential}
              onSelectCredential={handleSelectCredential}
              onRemoveCredential={handleRemoveCredential}
            />
          )}
        </Modal.Body>
        {!newCredential && (
          <Modal.Footer justify="end">
            <Button onClick={(e: MouseEvent) => void onClose(e)} size="sm">
              Cancel
            </Button>
            <Button disabled={!selected || selected === selectedProp} onClick={handleSubmitModal} size="sm">
              Submit
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
};

export default SpaceCredentialSelectorModal;
