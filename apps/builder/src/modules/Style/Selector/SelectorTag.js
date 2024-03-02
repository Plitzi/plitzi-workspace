// Packages
import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import Contenteditable from '@plitzi/plitzi-ui-components/ContentEditable';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// Relatives
import { selectorFormatter } from './SelectorHelper';
import { StyleSelectors } from '../StyleHelper';
import { makeId } from '../../../helpers/utils';

const SelectorTag = props => {
  const {
    selector = '',
    type = StyleSelectors.SELECTOR_CLASS,
    editable = true,
    active = false,
    onClick = noop,
    onChange = noop,
    onAction = noop
  } = props;
  const [editMode, setEditMode] = useState(false);
  const [value, setValue] = useState(selector);
  const [isVisible, setIsVisible] = useState(false);

  const handleClick = useCallback(
    e => {
      if (editable) {
        e.stopPropagation();
      }

      if (!active) {
        onClick(selector);
      }
    },
    [editable, active, onClick, selector]
  );

  const handleClickDuplicate = useCallback(
    () => onAction('duplicate', { name: `${selector}-${makeId(4)}`, type }),
    [selector, type, onChange]
  );

  const handleClickRemove = useCallback(() => onAction('remove'), [onAction]);

  const handleClickDelete = useCallback(() => onAction('delete'), [onAction]);

  const handleClickType = useCallback(e => {
    e.stopPropagation();
    if (!editable) {
      return;
    }

    setEditMode(false);
  }, []);

  const handleChange = useCallback(
    value => {
      console.log(value);
      setValue(value);
      onChange({ name: selectorFormatter(value), type });
    },
    [value, setValue, type, onChange]
  );

  const handleDropVisible = useCallback(isVisible => setIsVisible(isVisible), []);

  return (
    <div
      className={classNames('group px-1 relative flex items-center rounded text-white select-none', {
        'bg-blue-400': type === 'class' && active,
        'bg-green-500': type === 'state' && active,
        'bg-purple-500': type === 'parent' && active,
        'bg-pink-500': type === 'element' && active,
        'bg-yellow-500': type === 'id' && active,
        'bg-gray-500': !active
      })}
    >
      <div
        className={classNames('px-1 my-1 rounded bg-white capitalize font-bold text-xs', {
          'text-blue-400': type === 'class' && active,
          'text-green-500': type === 'state' && active,
          'text-purple-500': type === 'parent' && active,
          'text-pink-500': type === 'element' && active,
          'text-yellow-500': type === 'id' && active,
          'text-gray-400': !active,
          'py-1 mr-1': editMode
        })}
        title={type}
        onClick={handleClickType}
      >
        {type[0]}
      </div>
      <div onClick={handleClick}>
        {editable && (
          <Contenteditable
            className="px-1.5 text-xs truncate"
            value={selector}
            onChange={handleChange}
            openMode="doubleClick"
          />
        )}
        {!editable && <div className="px-1.5 text-xs truncate">{selector}</div>}
      </div>
      <Dropdown
        className={classNames('absolute right-0 text-xs px-1 rounded-r h-full', {
          'hidden group-hover:flex': !isVisible,
          flex: isVisible,
          'bg-blue-400': type === 'class' && active,
          'bg-green-500': type === 'state' && active,
          'bg-purple-500': type === 'parent' && active,
          'bg-pink-500': type === 'element' && active,
          'bg-yellow-500': type === 'id' && active,
          'bg-gray-500': !active
        })}
        onContainerVisible={handleDropVisible}
        backgroundDisabled
      >
        <Dropdown.Container className="text-gray-700">
          <div className="py-1 bg-gray-50">
            <div className="font-bold mb-1 px-2">Actions</div>
            <ul className="flex flex-col gap-1 px-2">
              <li onClick={handleClickDuplicate} className="hover:bg-gray-200 px-2 py-1 rounded">
                Duplicate
              </li>
              <li onClick={handleClickRemove} className="hover:bg-gray-200 px-2 py-1 rounded">
                Remove
              </li>
              <li onClick={handleClickDelete} className="text-red-400 hover:bg-gray-200 px-2 py-1 rounded">
                Delete
              </li>
            </ul>
            <div className="bg-gray-300 h-[1px] w-full my-2" />
            <div className="font-bold mb-1 px-2">States</div>
            <ul className="flex flex-col gap-1 px-2">
              <li className="hover:bg-gray-200 px-2 py-1 rounded">Hover</li>
              <li className="hover:bg-gray-200 px-2 py-1 rounded">Active</li>
              <li className="hover:bg-gray-200 px-2 py-1 rounded">Focus</li>
            </ul>
          </div>
        </Dropdown.Container>
      </Dropdown>
      {editable && editMode && (
        <div className="ml-1 flex flex-col justify-around rounded bg-blue-400 text-white">
          <Button
            intent="custom"
            size="custom"
            onClick={handleClickRemove}
            className="bg-red-400 hover:bg-red-500 h-full w-full rounded-none px-1"
          >
            <i className="fas fa-times" />
          </Button>
        </div>
      )}
    </div>
  );
};

SelectorTag.propTypes = {
  selector: PropTypes.string,
  type: PropTypes.string,
  active: PropTypes.bool,
  editable: PropTypes.bool,
  onChange: PropTypes.func,
  onClick: PropTypes.func,
  onAction: PropTypes.func,
  onState: PropTypes.func
};

export default SelectorTag;
