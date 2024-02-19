// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import usePopup from '@plitzi/plitzi-ui-components/Popup/usePopup';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import { POPUP_PLACEMENT_RIGHT, POPUP_PLACEMENT_FLOATING } from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Alias
import TemplateForm from '@pmodules/Templates/Models/TemplateForm';
import TemplatesContext from '@pmodules/Templates/TemplatesContext';
import SegmentForm from '@pmodules/Segments/Models/SegmentForm';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

// Relatives
import OverlayButton from './OverlayButton';
import BuilderContext from '../../BuilderContext';
import BuilderElementTools from '../BuilderElementTools';
import BuilderHoveredContext from '../../contexts/BuilderHoveredContext';
import BuilderSchemaContext from '../../contexts/BuilderSchemaContext';
import BuilderStyleContext from '../../contexts/BuilderStyleContext';
import { BUILDER_MODE_NORMAL } from '../../BuilderProvider';
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import { emptyObject } from '../../../../helpers/utils';

const OverlayButtonContainer = props => {
  const {
    id = '',
    element,
    container = emptyObject,
    width = 250,
    hoverRemove = false,
    zoom = 1,
    onHoverRemove = noop
  } = props;
  const { width: containerWidth, height, x, y, innerHeight, innerWidth } = container;
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { existsPopup, addPopup } = usePopup();
  const { setHovered } = useContext(BuilderHoveredContext);
  const { elementSelected, setSelected } = useContext(BuilderSelectedContext);
  const builderTemplatesContext = useContext(TemplatesContext);
  const builderSegmentsContext = useContext(SegmentsContext);
  const {
    schema: { flat }
  } = useContext(BuilderSchemaContext);
  const { style } = useContext(BuilderStyleContext);
  const { builderHandler, builderElementPermissions, mode } = useContext(BuilderContext);
  const {
    definition: { items }
  } = element;

  const componentConfig = useMemo(() => builderElementPermissions(element), [element, builderElementPermissions]);

  const {
    canDelete = true,
    canTemplate = true,
    overlay: { theme = 'normal' }
  } = componentConfig;

  const handleMouseRemoveEnter = () => onHoverRemove(true);

  const handleMouseRemoveLeave = () => onHoverRemove(false);

  const handleClickRemove = useCallback(
    async e => {
      e.stopPropagation();
      if (id === elementSelected) {
        setSelected(undefined);
      }

      builderHandler(EventBridgeTypes.SCHEMA_REMOVE_ELEMENT, id);
    },
    [builderHandler, id, showModal, elementSelected, setSelected]
  );

  const handleClickProperties = useCallback(() => {
    if (!existsPopup('element-tools')) {
      const title = (
        <>
          <i className="fas fa-tools m-1 text-base" />
          Tools
        </>
      );
      addPopup('element-tools', <BuilderElementTools />, {
        resizeHandles: ['se'],
        width: 350,
        title,
        allowLeftSide: mode === BUILDER_MODE_NORMAL,
        allowRightSide: mode === BUILDER_MODE_NORMAL,
        placement: mode === BUILDER_MODE_NORMAL ? POPUP_PLACEMENT_FLOATING : POPUP_PLACEMENT_RIGHT
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickAsTemplate = async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      <Modal.Body>
        <TemplateForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name, description }
      } = response;
      builderTemplatesContext.elementAsTemplate(flat, style, name, description, element);
      addToast(
        <div>
          Template <b>{name}</b> Created
        </div>,
        {
          appeareance: 'success',
          autoDismiss: true,
          placement: 'top-right'
        }
      );
    }
  };

  const handleClickAsSegment = async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Segment</h4>
      </Modal.Header>,
      <Modal.Body>
        <SegmentForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name, description }
      } = response;
      builderSegmentsContext.elementAsSegment(flat, style, name, description, element);
      addToast(
        <div>
          Segment <b>{name}</b> Created
        </div>,
        {
          appeareance: 'success',
          autoDismiss: true,
          placement: 'top-right'
        }
      );
    }
  };

  const handleMouseEnter = useCallback(() => {
    setHovered(null);
  }, [setHovered]);

  const actionsPosition = useMemo(() => {
    // Inside
    if (y + height + 40 > innerHeight && y < 40 && containerWidth > width) {
      return 'bottom-inside';
    }

    // Top
    if (y + height + 40 > innerHeight) {
      if (containerWidth < width && innerWidth - x - containerWidth < width) {
        return 'top-right';
      }

      if (containerWidth < width && x + containerWidth < width) {
        return 'top-left';
      }

      return 'top';
    }

    // Bottom
    if (x - containerWidth / 2 < 0 && width > containerWidth) {
      return 'bottom-left';
    }

    if (x + containerWidth / 2 + width / 2 > innerWidth && width > containerWidth) {
      return 'bottom-right';
    }

    return 'bottom';
  }, [height, width, innerHeight, innerWidth, x, y, containerWidth, zoom]);

  const containerStyles = useMemo(() => {
    let transformOrigin = '';
    switch (actionsPosition) {
      case 'top':
        transformOrigin = 'bottom';
        break;

      case 'top-left':
        return { transform: `scale(${1 / zoom})`, transformOrigin: 'bottom left' };

      case 'top-right':
        return { transform: `scale(${1 / zoom})`, transformOrigin: 'bottom right' };

      case 'bottom':
        transformOrigin = 'top';
        break;

      case 'bottom-left':
        return { transform: `scale(${1 / zoom})`, transformOrigin: 'top left' };

      case 'bottom-right':
        return { transform: `scale(${1 / zoom})`, transformOrigin: 'top right' };

      case 'bottom-inside':
      default:
    }

    return { transform: `translateX(-50%) scale(${1 / zoom})`, transformOrigin };
  }, [actionsPosition, zoom]);

  return (
    <div
      className={classNames('overlay__button-container', {
        'button-container--bottom-inside': actionsPosition === 'bottom-inside',
        'button-container--top': actionsPosition === 'top',
        'button-container--top-right': actionsPosition === 'top-right',
        'button-container--top-left': actionsPosition === 'top-left',
        'button-container--bottom-right': actionsPosition === 'bottom-right',
        'button-container--bottom-left': actionsPosition === 'bottom-left',
        'button-container--bottom': actionsPosition === 'bottom'
      })}
      style={containerStyles}
      onMouseEnter={handleMouseEnter}
    >
      <OverlayButton title="Tools" theme={theme} isRemoving={hoverRemove} onClick={handleClickProperties}>
        <i className="fas fa-tools" />
      </OverlayButton>
      {!!items && canTemplate && (
        <OverlayButton title="Save as template" theme={theme} isRemoving={hoverRemove} onClick={handleClickAsTemplate}>
          <i className="fas fa-cube" />
        </OverlayButton>
      )}
      {!!items && canTemplate && (
        <OverlayButton title="Save as segment" theme={theme} isRemoving={hoverRemove} onClick={handleClickAsSegment}>
          <i className="fa-solid fa-puzzle-piece" />
        </OverlayButton>
      )}
      {canDelete && (
        <OverlayButton
          title="Remove"
          theme={theme}
          isRemoving
          onMouseEnter={handleMouseRemoveEnter}
          onMouseLeave={handleMouseRemoveLeave}
          onClick={handleClickRemove}
        >
          <i className="fas fa-trash-alt" />
        </OverlayButton>
      )}
    </div>
  );
};

OverlayButtonContainer.propTypes = {
  id: PropTypes.string,
  width: PropTypes.number,
  container: PropTypes.object,
  element: PropTypes.object,
  hoverRemove: PropTypes.bool,
  zoom: PropTypes.number,
  onHoverRemove: PropTypes.func
};

export default OverlayButtonContainer;
