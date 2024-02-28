// Packages
import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { flushSync } from 'react-dom';
import Button from '@plitzi/plitzi-ui-components/Button';
import Input from '@plitzi/plitzi-ui-components/Input';

// Relatives
import { selectorFormatter } from './SelectorHelper';
import { StyleSelectors } from '../StyleHelper';

const SelectorTag = props => {
  const {
    selector = '',
    type = StyleSelectors.SELECTOR_CLASS,
    editable = true,
    onChange = noop,
    onRemove = noop
  } = props;
  const [editMode, setEditMode] = useState(false);
  const inputRef = useRef(null);
  const [value, setValue] = useState(selector);

  const handleClick = e => {
    e.stopPropagation();
    if (!editable) {
      return;
    }

    if (![StyleSelectors.SELECTOR_STATE].includes(type)) {
      flushSync(() => {
        setEditMode(true);
      });
      inputRef.current.focus();
    }
  };

  const handleClickInput = e => {
    e.stopPropagation();
  };

  const handleClickRemove = e => {
    e.stopPropagation();
    onRemove(e);
  };

  const handleKeyDown = e => {
    e.stopPropagation();
    if (!editable) {
      return;
    }

    switch (e.key) {
      case 'Enter': {
        const { value } = e.target;

        if (value !== '' && selector !== value) {
          onChange({ value: selectorFormatter(e.target.value), type });
          e.target.blur();
        }

        break;
      }

      case 'Escape': {
        setEditMode(false);
        setValue(selector);

        break;
      }

      default:
        break;
    }
  };

  const handleClickType = useCallback(e => {
    e.stopPropagation();
    if (!editable) {
      return;
    }

    setEditMode(false);
  }, []);

  const handleBlur = useCallback(() => {
    if (!editable) {
      return;
    }

    setValue(selector);
  }, []);

  const handleChange = e => setValue(e.target.value);

  return (
    <div
      className={classNames(
        'group m-1 px-1 relative flex items-center justify-center rounded text-white overflow-hidden select-none',
        {
          'bg-blue-400': type === 'class',
          'bg-green-500': type === 'state',
          'bg-purple-500': type === 'parent',
          'bg-pink-500': type === 'element',
          'bg-yellow-500': type === 'id'
        }
      )}
    >
      <div
        className={classNames('px-1 my-1 rounded bg-white capitalize font-bold text-xs', {
          'text-blue-400': type === 'class',
          'text-green-500': type === 'state',
          'text-purple-500': type === 'parent',
          'text-pink-500': type === 'element',
          'text-yellow-500': type === 'id',
          'py-1 mr-1': editMode
        })}
        title={type}
        onClick={handleClickType}
      >
        {type[0]}
      </div>
      {!editMode && (
        <div className="px-1.5 text-xs truncate" onClick={handleClick} title={selector}>
          {selector}
        </div>
      )}
      {editMode && (
        <Input
          size="custom"
          type="text"
          className="flex min-w-0"
          inputClassName="my-1 rounded text-xs px-2 py-1 text-gray-700 border-none leading-[9px] focus:ring-transparent focus:outline-none"
          ref={inputRef}
          value={value}
          onClick={handleClickInput}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      )}

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
  editable: PropTypes.bool,
  onRemove: PropTypes.func,
  onChange: PropTypes.func
};

export default SelectorTag;
