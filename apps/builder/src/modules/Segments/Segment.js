// Packages
import React, { useCallback, use } from 'react';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui/Button';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
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
  const { showModal } = useModal();
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
        <Modal.Body>
          <SegmentForm identifier={identifier} name={name} description={description} />
        </Modal.Body>,
        null,
        { placement: 'center', renderFooter: false }
      );

      if (response.result) {
        const {
          data: { identifier, name, description }
        } = response;

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
      const response = await showModal(
        <Modal.Header>
          <h4>Remove Segment</h4>
        </Modal.Header>,
        <Modal.Body className="p-4">
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        null,
        { placement: 'center', renderFooter: true }
      );

      if (response.result) {
        segmentsRemove(id);
        onParentRefresh(identifier);
      }
    },
    [id, identifier, segmentsRemove, showModal, onParentRefresh]
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
      <Modal.Body>
        <PublishForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );
    if (response.result) {
      const result = await mutate('SegmentPublish', { ...response.data, contextId: id });
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
    <Flex className="group cursor-grabbing my-2 first:mt-0" gap={2} items="center" draggable onDragStart={onDragStart}>
      <Icon icon="fa-solid fa-diamond" intent="primaryActive" />
      <div className="flex flex-col basis-0 grow overflow-hidden">
        <div className="group-hover:text-primary-400 font-bold truncate">{name}</div>
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
