import Button from '@plitzi/plitzi-ui/Button';
import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import useDisclosure from '@plitzi/plitzi-ui/hooks/useDisclosure';
import Modal from '@plitzi/plitzi-ui/Modal';
import { useCallback, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import SpaceCredentialForm, { credentialDataOf } from '@pmodules/Space/Models/SpaceCredentialForm';

import ModalBody from './ModalBody';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { SpaceCredentialFormValues } from '@pmodules/Space/Models/SpaceCredentialForm';
import type { MouseEvent, ReactNode } from 'react';

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
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const [selected, setSelected] = useState(selectedProp);
  const [creating, setCreating] = useState(false);
  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  // A caller that restricts the list restricts what it can use, so a credential created from here is offered only the
  // kinds it will accept rather than one it would immediately grey out.
  const handleClickNewCredential = useCallback(() => setCreating(true), []);

  const handleCloseForm = useCallback(() => setCreating(false), []);

  const [id, open, onOpen, onClose] = useDisclosure();
  const { data = [], mutate } = useGraphQL(open ? 'SpaceCredentials' : null, data => data?.SpaceCredentials.edges, {});

  useDidUpdateEffect(() => {
    if (open) {
      setSelected(selectedProp);
    }
  }, [selectedProp, open]);

  const handleSubmitForm = useCallback(
    async (_e: MouseEvent | undefined, values: SpaceCredentialFormValues) => {
      const response = await mutateNetwork('SpaceAddCredential', {
        name: values.name,
        provider: values.provider,
        data: credentialDataOf(values)
      });
      if (!response.success) {
        return;
      }

      void mutate();
      setCreating(false);
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
      setCreating(false);
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
          {creating && (
            <SpaceCredentialForm providers={providersSupported} onSubmit={handleSubmitForm} onClose={handleCloseForm} />
          )}
          {!creating && (
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
        {!creating && (
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
