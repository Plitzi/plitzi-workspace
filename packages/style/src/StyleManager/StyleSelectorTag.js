// Packages
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';

// Relatives
import SelectorTag from '../Selector/SelectorTag';

const StyleSelectorTag = props => {
  const {
    id,
    label = 'Selector',
    active = false,
    elementsCount = 0,
    type = 'class',
    onSelect = noop,
    onDelete = noop
  } = props;

  const handleClickSelect = useCallback(() => onSelect(id), [id, onSelect]);

  const handleClickDelete = useCallback(
    e => {
      e.stopPropagation();
      onDelete(id);
    },
    [id, onDelete]
  );

  return (
    <div
      className={classNames('group-1 flex justify-between items-center border-t border-gray-300 cursor-pointer p-1', {
        'hover:bg-gray-200': !active,
        'bg-gray-200': active
      })}
      onClick={handleClickSelect}
    >
      <SelectorTag editable={false} selector={label} type={type} />
      <div className="flex">
        <div className={classNames('mr-1', { flex: active, 'hidden group-1-hover:flex': !active })}>
          <Button
            intent="custom"
            size="custom"
            className="text-red-400 hover:text-red-500 px-1"
            onClick={handleClickDelete}
          >
            <i className="fas fa-trash" />
          </Button>
        </div>
        {elementsCount > 0 && (
          <div className="flex items-center justify-center rounded bg-blue-400 text-white px-1.5">{elementsCount}</div>
        )}
      </div>
    </div>
  );
};

StyleSelectorTag.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string,
  active: PropTypes.bool,
  type: PropTypes.string,
  elementsCount: PropTypes.number,
  onDelete: PropTypes.func,
  onSelect: PropTypes.func
};

export default StyleSelectorTag;
