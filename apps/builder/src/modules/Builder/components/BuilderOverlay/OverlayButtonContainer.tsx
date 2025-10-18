import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import { useCallback, use, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import SegmentForm from '@pmodules/Segments/models/SegmentForm';
import TemplateForm from '@pmodules/Templates/Models/TemplateForm';
import TemplatesContext from '@pmodules/Templates/TemplatesContext';

import OverlayButton from './OverlayButton';
import BuilderElementTools from '../BuilderElementTools';

import type { OverlayRect } from './BuilderOverlayHelper';
import type { Element, SegmentsContextValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type OverlayButtonContainerProps = {
  id?: string;
  element: Element;
  container?: OverlayRect;
  width?: number;
  hoverRemove?: boolean;
  zoom?: number;
  onHoverRemove?: (hoverRemove: boolean) => void;
};

const OverlayButtonContainer = ({
  id = '',
  element,
  container,
  width = 250,
  hoverRemove = false,
  zoom = 1,
  onHoverRemove
}: OverlayButtonContainerProps) => {
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { existsPopup, addPopup } = usePopup();
  const { setHovered } = use(BuilderHoveredContext);
  const { elementSelected, setSelected } = use(BuilderSelectedContext);
  const builderTemplatesContext = use(TemplatesContext);
  const builderSegmentsContext = use(SegmentsContext) as SegmentsContextValue<'builder'>;
  const { schema } = use(BuilderSchemaContext);
  const { style } = use(BuilderStyleContext);
  const { builderHandler, builderElementPermissions, mode } = use(BuilderContext);
  const {
    definition: { items }
  } = element;

  const componentConfig = useMemo(() => builderElementPermissions(element), [element, builderElementPermissions]);

  const { canDelete = true, canTemplate = true } = componentConfig;

  const handleMouseRemoveEnter = useCallback(() => onHoverRemove?.(true), [onHoverRemove]);

  const handleMouseRemoveLeave = useCallback(() => onHoverRemove?.(false), [onHoverRemove]);

  const handleClickRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (id === elementSelected) {
        setSelected(undefined);
      }

      builderHandler('schemaRemoveElement', id);
    },
    [builderHandler, id, elementSelected, setSelected]
  );

  const handleClickProperties = useCallback(() => {
    if (!existsPopup('element-tools')) {
      addPopup('element-tools', <BuilderElementTools />, {
        icon: <i className="fas fa-tools text-base" />,
        title: 'Tools',
        resizeHandles: ['se'],
        width: 350,
        allowLeftSide: mode === 'normal',
        allowRightSide: mode === 'normal',
        placement: mode === 'normal' ? 'floating' : 'right'
      });
    }
  }, [addPopup, existsPopup, mode]);

  const handleClickAsTemplate = async () => {
    const response = await showModal<{ name: string; description?: string }>(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <TemplateForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      const { name, description } = response;
      void builderTemplatesContext.elementAsTemplate(schema, style, name, description ?? '', element);
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
    const response = await showModal<{ name: string; description: string }>(
      <Modal.Header>
        <h4>Add Segment</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <SegmentForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      const { name, description } = response;
      void builderSegmentsContext.elementAsSegment(schema, style, name, description, element);
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

  const handleMouseEnter = useCallback(() => setHovered(undefined), [setHovered]);

  const actionsPosition = useMemo(() => {
    if (!container) {
      return 'bottom';
    }

    const { width: containerWidth, height, x, y, innerHeight, innerWidth } = container;
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
  }, [container, width]);

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
      <OverlayButton title="Tools" isRemoving={hoverRemove} onClick={handleClickProperties}>
        <i className="fas fa-tools" />
      </OverlayButton>
      {!!items && canTemplate && (
        <OverlayButton title="Save as template" isRemoving={hoverRemove} onClick={handleClickAsTemplate}>
          <i className="fas fa-cube" />
        </OverlayButton>
      )}
      {!!items && canTemplate && (
        <OverlayButton title="Save as segment" isRemoving={hoverRemove} onClick={handleClickAsSegment}>
          <i className="fa-solid fa-puzzle-piece" />
        </OverlayButton>
      )}
      {canDelete && (
        <OverlayButton
          title="Remove"
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

export default OverlayButtonContainer;
