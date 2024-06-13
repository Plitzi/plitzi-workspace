// Packages
import React, { useCallback, use } from 'react';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import usePopup from '@plitzi/plitzi-ui-components/Popup/usePopup';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Alias
import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import { REFERENCE_TYPE_SEGMENT } from '@pmodules/Elements/ElementConstants';
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
 *   onParentRefresh?: (identifier: string, segment: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Segment = props => {
  const { id = '', identifier = '', name = '', description = '', onParentRefresh = noop } = props;
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { existsPopup, addPopup } = usePopup();
  const { segmentGet, segmentsRemove, segmentsUpdate } = use(SegmentsContext);
  const { mutate } = use(NetworkContext);
  const { onDragStart } = useDragElement({
    type: 'reference',
    attributes: { referenceType: REFERENCE_TYPE_SEGMENT, referenceId: identifier }
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
      if (!existsPopup('segment-builder') && segment) {
        const title = (
          <>
            <i className="fa-solid fa-puzzle-piece m-1 text-base" />
            Segment - {name}
          </>
        );
        addPopup('segment-builder', <BuilderPopup segmentIdentifier={identifier} />, {
          resizeHandles: ['se'],
          width: 800,
          height: 500,
          title,
          allowRightSide: false,
          allowExternal: false,
          placement: 'POPUP_PLACEMENT_FLOATING'
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
    <div className="group flex items-center cursor-grabbing my-2 first:mt-0" draggable onDragStart={onDragStart}>
      <div className="w-11 h-11 flex items-center justify-center bg-blue-400 rounded mr-3">
        <i className="fa-solid fa-puzzle-piece fa-2x text-white" />
      </div>
      <div className="flex flex-col basis-0 grow overflow-hidden">
        <div className="group-hover:text-blue-400 font-bold truncate">{name}</div>
        <div className="text-sm">{description}</div>
      </div>
      <div className="hidden group-hover:flex">
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickUpdateSegment}
          title="Update"
          className="px-1 py-2 mr-2 hover:text-blue-400"
        >
          <i className="fas fa-pen" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickBuilder}
          title="Open Builder"
          className="px-1 py-2 mr-2 hover:text-blue-400"
        >
          <i className="fa-solid fa-puzzle-piece" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickPublish}
          title="Make Snapshot"
          className="px-1 py-2 mr-2 hover:text-blue-400"
        >
          <i className="fa-solid fa-rocket" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickRemove}
          title="Remove"
          className="text-red-400 hover:text-red-500 px-1 py-2"
        >
          <i className="fas fa-trash-alt" />
        </Button>
      </div>
    </div>
  );
};

export default Segment;
