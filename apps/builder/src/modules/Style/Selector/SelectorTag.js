// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Contenteditable from '@plitzi/plitzi-ui-components/ContentEditable';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// Relatives
import { selectorFormatter } from './SelectorHelper';
import { StyleSelectors } from '../StyleHelper';
import { makeId } from '../../../helpers/utils';

const SelectorTag = props => {
  const {
    className = '',
    selector = '',
    type = StyleSelectors.SELECTOR_CLASS,
    editable = true,
    active = false,
    onClick = noop,
    onChange = noop,
    onAction = noop
  } = props;
  const { value, state } = useMemo(() => {
    if (selector.includes(':')) {
      const [value, state] = selector.split(':');

      return { value, state };
    }

    return { value: selector, state: '' };
  }, [selector]);
  const [isVisible, setIsVisible] = useState(false);

  const handleClick = useCallback(
    e => {
      if (editable) {
        e.stopPropagation();
      }

      onClick({ name: selector, type });
    },
    [editable, active, onClick, selector, type]
  );

  const handleClickDuplicate = useCallback(
    () => onAction('duplicate', { name: `${selector}-${makeId(4)}`, type }),
    [selector, type, onChange]
  );

  const handleClickRemove = useCallback(() => onAction('remove'), [onAction]);

  // const handleClickDelete = useCallback(() => onAction('delete'), [onAction]);

  const handleChange = useCallback(
    value => {
      if (state) {
        onChange({ name: `${selectorFormatter(value)}:${state}`, type });
      } else {
        onChange({ name: selectorFormatter(value), type });
      }
    },
    [value, type, onChange, state]
  );

  useEffect(() => {
    if (!active && state) {
      onChange({ name: selectorFormatter(value), type }, false);
    }
  }, [active]);

  const handleDropVisible = useCallback(isVisible => setIsVisible(isVisible), []);

  const handleClickNone = useCallback(() => onChange({ name: selectorFormatter(value), type }), [onChange]);

  const handleClickHover = useCallback(() => {
    onChange({ name: `${selectorFormatter(value)}:hover`, type });
  }, [onChange]);

  const handleClickActive = useCallback(
    () => onChange({ name: `${selectorFormatter(value)}:active`, type }),
    [onChange]
  );

  const handleClickFocus = useCallback(() => onChange({ name: `${selectorFormatter(value)}:focus`, type }), [onChange]);

  return (
    <div
      className={classNames(
        'group px-1 relative flex items-center rounded text-white select-none cursor-pointer',
        className,
        {
          'bg-blue-400': type === 'class' && active,
          'bg-green-500': type === 'state' && active,
          'bg-purple-500': type === 'parent' && active,
          'bg-pink-500': type === 'element' && active,
          'bg-yellow-500': type === 'id' && active,
          'bg-gray-500': !active
        }
      )}
      onClick={handleClick}
    >
      <div
        className={classNames('px-1 my-1 rounded bg-white capitalize font-bold text-xs', {
          'text-blue-400': type === 'class' && active,
          'text-green-500': type === 'state' && active,
          'text-purple-500': type === 'parent' && active,
          'text-pink-500': type === 'element' && active,
          'text-yellow-500': type === 'id' && active,
          'text-gray-400': !active
        })}
        title={type}
      >
        {type[0]}
      </div>
      <div className="mx-1.5">
        {editable && (
          <Contenteditable
            className={classNames('text-xs truncate group-hover:mr-3', {})}
            value={selector}
            onChange={handleChange}
            openMode="doubleClick"
          />
        )}
        {!editable && <div className="text-xs truncate">{selector}</div>}
      </div>
      <Dropdown
        className={classNames('absolute right-0 text-xs px-1 rounded-r h-full', {
          'hidden group-hover:flex': !isVisible && editable,
          flex: isVisible && editable,
          hidden: !editable,
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
              {/* <li onClick={handleClickDelete} className="text-red-400 hover:bg-gray-200 px-2 py-1 rounded">
                Delete
              </li> */}
            </ul>
            <div className="bg-gray-300 h-[1px] w-full my-2" />
            <div className="font-bold mb-1 px-2">States</div>
            <ul className="flex flex-col gap-1 px-2">
              <li className="flex items-center hover:bg-gray-200 px-2 py-1 rounded gap-1" onClick={handleClickNone}>
                {state === '' && <i className="fa-solid fa-check text-green-500" />}
                None
              </li>
              <li className="flex items-center hover:bg-gray-200 px-2 py-1 rounded gap-1" onClick={handleClickHover}>
                {state === 'hover' && <i className="fa-solid fa-check text-green-500" />}
                Hover
              </li>
              <li className="flex items-center hover:bg-gray-200 px-2 py-1 rounded gap-1" onClick={handleClickActive}>
                {state === 'active' && <i className="fa-solid fa-check text-green-500" />}
                Active
              </li>
              <li className="flex items-center hover:bg-gray-200 px-2 py-1 rounded gap-1" onClick={handleClickFocus}>
                {state === 'focus' && <i className="fa-solid fa-check text-green-500" />}
                Focus
              </li>
            </ul>
          </div>
        </Dropdown.Container>
      </Dropdown>
    </div>
  );
};

SelectorTag.propTypes = {
  className: PropTypes.string,
  selector: PropTypes.string,
  type: PropTypes.string,
  active: PropTypes.bool,
  editable: PropTypes.bool,
  onChange: PropTypes.func,
  onClick: PropTypes.func,
  onAction: PropTypes.func
};

export default SelectorTag;
