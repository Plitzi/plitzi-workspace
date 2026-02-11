import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import clsx from 'clsx';
import get from 'lodash-es/get';
import { use, useCallback, useMemo } from 'react';

import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';

import useBuilderElement from '../../hooks/useBuilderElement';
import BuilderElementTools from '../BuilderElementTools';

import type { MouseEvent } from 'react';

export type BuilderTreeNodeControlsProps = {
  id?: string;
  hovered?: boolean;
  selected?: boolean;
};

const BuilderTreeNodeControls = ({ id, hovered, selected }: BuilderTreeNodeControlsProps) => {
  const { builderSetElementVisibility } = use(BuilderSchemaContext);
  const { existsPopup, addPopup } = usePopup();
  const { showDialog } = useModal();
  const { builderHandler, builderElementPermissions } = use(BuilderContext);

  const dataSource = useDataSource({ id, mode: 'read' });
  const element = useBuilderElement(id);
  const { canDelete } = useMemo(() => {
    if (!element) {
      return { canDelete: false };
    }

    const {
      definition: { label, parentId, items, initialState }
    } = element;
    const { canDelete = true, canDragDrop = true } = builderElementPermissions(element);

    return {
      label,
      parentId,
      items,
      canDelete,
      canDragDrop,
      isVisible: get(initialState, 'visibility', true)
    };
  }, [element, builderElementPermissions]);
  const isVisible = useMemo(() => {
    if (!element) {
      return false;
    }

    const { attributes, definition } = element;
    const bindingData = getBindingsDetails(dataSource, attributes, definition);

    return get(bindingData, 'definition.initialState.visibility', true);
  }, [dataSource, element]);

  const handleClickTools = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (!existsPopup('element-tools')) {
        addPopup('element-tools', <BuilderElementTools />, {
          icon: <i className="fas fa-tools text-base" />,
          title: 'Tools',
          resizeHandles: ['se'],
          width: 350,
          placement: 'floating'
        });
      }
    },
    [existsPopup, addPopup]
  );

  const handleClickVisibility = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!id) {
        return;
      }

      builderSetElementVisibility(id, !isVisible);
      // setHovered(null);
    },
    [builderSetElementVisibility, id, isVisible]
  ); // setHovered

  const handleClickDelete = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Element</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Do you want to remove this item ?</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        id
      );

      if (response) {
        builderHandler('schemaRemoveElement', id);
      }
    },
    [builderHandler, id, showDialog]
  );

  return (
    <div
      className={clsx('justify-end gap-2', {
        flex: selected || !isVisible || hovered,
        hidden: !selected && isVisible && !hovered
      })}
    >
      <Icon
        icon={isVisible ? 'fas fa-eye' : 'fas fa-eye-slash'}
        title={isVisible ? 'Hide' : 'Unhide'}
        size="sm"
        onClick={handleClickVisibility}
      />
      {selected && (
        <>
          <Icon icon="fas fa-tools" title="Tools" onClick={handleClickTools} size="sm" />
          {canDelete && (
            <Icon icon="fas fa-trash" title="Remove" onClick={handleClickDelete} intent="danger" size="sm" />
          )}
        </>
      )}
    </div>
  );
};

export default BuilderTreeNodeControls;
