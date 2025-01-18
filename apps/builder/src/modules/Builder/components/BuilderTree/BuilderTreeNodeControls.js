// Packages
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';
import classNames from 'classnames';
import get from 'lodash/get';
import Icon from '@plitzi/plitzi-ui/Icon';
import { use, useCallback, useMemo } from 'react';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import useDataSource from '@plitzi/sdk-data-source/hooks/useDataSource';
import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';

// Alias
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';

// Relatives
import useBuilderElement from '../../hooks/useBuilderElement';

const BuilderTreeNodeControls = ({ id, hovered, selected }) => {
  const { builderSetElementVisibility } = use(BuilderSchemaContext);
  const { existsPopup, addPopup } = usePopup();
  const { builderHandler, builderElementPermissions } = use(BuilderContext);

  const dataSource = useDataSource({ id, mode: 'read' });
  const element = useBuilderElement(id);
  const { canDelete } = useMemo(() => {
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
    const { attributes, definition } = element;
    const bindingData = getBindingsDetails(dataSource, attributes, definition);

    return get(bindingData, 'definition.initialState.visibility', true);
  }, [element]);

  const handleClickTools = useCallback(
    e => {
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

  const handleClickVisibility = useCallback(() => {
    builderSetElementVisibility(id, !isVisible);
    // setHovered(null);
  }, [builderSetElementVisibility, id, isVisible]); // setHovered

  const handleClickDelete = useCallback(
    async e => {
      e.stopPropagation();
      builderHandler(EventBridgeTypes.SCHEMA_REMOVE_ELEMENT, id);
    },
    [builderHandler, id]
  );

  return (
    <div
      className={classNames('justify-end gap-2', {
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
            <Icon icon="fas fa-trash" title="Remove" onClick={handleClickDelete} intent="error" size="sm" />
          )}
        </>
      )}
    </div>
  );
};

export default BuilderTreeNodeControls;
