import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import BuilderPopup from '@pmodules/Builder/BuilderPopup';
import useDragElement from '@pmodules/Elements/hooks/useDragElement';

import PublishForm from './models/PublishForm';
import SegmentForm from './models/SegmentForm';
import SegmentsContext from './SegmentsContext';

import type { NetworkContextValue, SchemaVariable, Segment as TSegment } from '@plitzi/sdk-shared';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { MouseEvent } from 'react';

export type SegmentProps = {
  id?: string;
  identifier?: string;
  name?: string;
  description?: string;
  variables?: SchemaVariable[];
  onParentRefresh?: (identifier: string, segment?: TSegment) => void;
};

const Segment = ({
  id = '',
  identifier = '',
  name = '',
  description = '',
  variables = [],
  onParentRefresh
}: SegmentProps) => {
  const { showModal, showDialog } = useModal();
  const { addToast } = useToast();
  const { existsPopup, addPopup } = usePopup();
  const { segmentGet, segmentsRemove, segmentsUpdate } = use(SegmentsContext);
  const { mutate } = use(NetworkContext) as NetworkContextValue<QueriesMap, MutationsMap>;
  const { onDragStart } = useDragElement({
    type: 'reference',
    attributes: { referenceType: 'segment', referenceId: identifier },
    variables
  });

  const handleClickUpdateSegment = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showModal<{ name: string; identifier: string; description: string }>(
        <Modal.Header>
          <h4>Update Segment</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <SegmentForm
              onSubmit={onSubmit}
              onClose={onClose}
              identifier={identifier}
              name={name}
              description={description}
            />
          </Modal.Body>
        )
      );

      if (response) {
        const { identifier, name, description } = response;
        const segment = await segmentGet(identifier);
        if (!segment) {
          return;
        }

        const newSegment = {
          ...segment,
          identifier,
          definition: { ...segment.definition, name, description }
        };
        segmentsUpdate(newSegment);
        onParentRefresh?.(identifier, newSegment);
      }
    },
    [showModal, identifier, name, description, segmentGet, segmentsUpdate, onParentRefresh]
  );

  const handleClickRemove = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Segment</h4>
        </Modal.Header>,
        <Modal.Body className="p-4">
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        undefined,
        id
      );

      if (response) {
        segmentsRemove(id);
        onParentRefresh?.(identifier);
      }
    },
    [id, identifier, segmentsRemove, showDialog, onParentRefresh]
  );

  const handleClickBuilder = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const segment = await segmentGet(identifier);
      if (!existsPopup('segmentBuilder') && segment) {
        addPopup('segmentBuilder', <BuilderPopup segmentIdentifier={identifier} />, {
          icon: <i className="fa-solid fa-puzzle-piece text-base" />,
          title: `Segment - ${name}`,
          resizeHandles: ['se'],
          width: 800,
          height: 500,
          allowRightSide: false,
          allowExternal: false,
          placement: 'floating'
        });
      }
    },
    [addPopup, existsPopup, identifier, name, segmentGet]
  );

  const handleClickPublish = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Make Snapshot</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <PublishForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );
    if (response) {
      const result = await mutate('SegmentPublish', { ...response, contextId: id });
      if (result as typeof result | undefined) {
        addToast(
          <span>
            Snapshot <b>{`${result.environment}:${result.revision}`}</b> Created Successfully
          </span>,
          {
            appeareance: 'success',
            autoDismiss: true,
            placement: 'top-right'
          }
        );
      }
    }
  }, [id, addToast, mutate, showModal]);

  return (
    <Flex className="group my-2 cursor-grabbing first:mt-0" gap={2} items="center" draggable onDragStart={onDragStart}>
      <Icon icon="fa-solid fa-diamond" intent="primaryActive" />
      <div className="flex grow basis-0 flex-col overflow-hidden">
        <div className="group-hover:text-primary-400 truncate font-bold">{name}</div>
      </div>
      <div className="hidden group-hover:flex">
        <Icon
          icon="fas fa-pen"
          onClick={handleClickUpdateSegment}
          title="Update"
          size="sm"
          cursor="pointer"
          className="px-1"
        />
        <Icon
          icon="fa-solid fa-puzzle-piece"
          onClick={handleClickBuilder}
          title="Open Builder"
          size="sm"
          cursor="pointer"
          className="px-1"
        />
        <Icon
          icon="fa-solid fa-rocket"
          onClick={handleClickPublish}
          title="Make Snapshot"
          size="sm"
          cursor="pointer"
          className="px-1"
        />
        <Icon
          icon="fas fa-trash-alt"
          onClick={handleClickRemove}
          title="Remove"
          size="sm"
          cursor="pointer"
          intent="danger"
          className="px-1"
        />
      </div>
    </Flex>
  );
};

export default Segment;
