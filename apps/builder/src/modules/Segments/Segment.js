// Packages
import React, { useCallback, use } from 'react';
import noop from 'lodash/noop';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import Icon from '@plitzi/plitzi-ui/Icon';
import Flex from '@plitzi/plitzi-ui/Flex';

// Alias
import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import BuilderPopup from '@pmodules/Builder/BuilderPopup';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import SegmentForm from './models/SegmentForm';
import SegmentsContext from './SegmentsContext';
import PublishForm from './models/PublishForm';

/**
 * @param {{
 *   id?: string;
 *   identifier?: string;
 *   name?: string;
 *   description?: string;
 *   variables?: object[];
 *   onParentRefresh?: (identifier: string, segment: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Segment = props => {
  const { id = '', identifier = '', name = '', description = '', variables = [], onParentRefresh = noop } = props;
  const { showModal, showDialog } = useModal();
  const { addToast } = useToast();
  const { existsPopup, addPopup } = usePopup();
  const { segmentGet, segmentsRemove, segmentsUpdate } = use(SegmentsContext);
  const { mutate } = use(NetworkContext);
  const { onDragStart } = useDragElement({
    type: 'reference',
    attributes: { referenceType: 'segment', referenceId: identifier },
    variables
  });

  const handleClickUpdateSegment = useCallback(
    async e => {
      e.stopPropagation();
      const response = await showModal(
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
        const newSegment = { ...segment, identifier, definition: { ...segment.definition, name, description } };
        segmentsUpdate(newSegment);
        onParentRefresh(identifier, newSegment);
      }
    },
    [identifier, showModal, name, description, segmentGet, onParentRefresh]
  );

  const handleClickRemove = useCallback(
    async e => {
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
        onParentRefresh(identifier);
      }
    },
    [id, identifier, segmentsRemove, showDialog, onParentRefresh]
  );

  const handleClickBuilder = useCallback(
    async e => {
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
      if (result) {
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
