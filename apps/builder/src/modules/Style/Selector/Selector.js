// Packages
import React, { memo, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// Relatives
import SelectorTag from './SelectorTag';
import { selectorFormatter } from './SelectorHelper';
import { StyleSelectors, selectorToString, stringToSelector } from '../StyleHelper';

const Selector = props => {
  const { className = '', value, displayMode = 'desktop', disabled = false, onChange = noop } = props;
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const tags = useMemo(() => stringToSelector(value), [value]);
  const currentState = useMemo(() => tags.find(v => v.type === StyleSelectors.SELECTOR_STATE), [tags]);

  const handleChange = e => setInputValue(e.target.value);

  const handleChangeItem = position => value => {
    tags[position] = value;
    onChange(selectorToString(tags));
  };

  const handleClick = () => inputRef.current.focus();

  const handleClickRemove = position => () => {
    onChange(selectorToString(tags.filter((tag, i) => i !== position)));
  };

  const handleKeyDown = e => {
    switch (e.key) {
      case 'Enter': {
        const { value } = e.target;

        if (value !== '' && !tags.find(t => t === value)) {
          setInputValue('');
          const finalValue = selectorToString(
            [...tags, { value: selectorFormatter(value), type: StyleSelectors.SELECTOR_CLASS }].sort((tag1, tag2) => {
              if (tag2.type === StyleSelectors.SELECTOR_STATE) {
                return -1;
              }

              return 0;
            })
          );

          onChange(finalValue);
          e.target.blur();
        }

        break;
      }

      case 'Escape': {
        setInputValue('');
        e.target.blur();

        break;
      }

      default:
        break;
    }
  };

  const handleBlur = () => setInputValue('');

  const handleClickItem = item => e => {
    e.stopPropagation();
    const tagsTemp = tags.filter(tag => tag.type !== StyleSelectors.SELECTOR_STATE);
    if (item === 'none') {
      onChange(selectorToString(tagsTemp));
    } else {
      onChange(selectorToString([...tagsTemp, { value: item, type: StyleSelectors.SELECTOR_STATE }]));
    }
  };

  return (
    <div
      className={classNames('flex flex-wrap border border-gray-300 rounded relative pr-8 py-1 pl-1', className, {
        'bg-gray-100 pointer-events-none cursor-not-allowed': disabled,
        'cursor-pointer': !disabled
      })}
      onClick={handleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {displayMode && (
        <div className="m-0.5 px-2 py-1 flex justify-center items-center border border-gray-300 rounded">
          {displayMode === 'desktop' && <i className="fas fa-desktop" />}
          {displayMode === 'tablet' && <i className="fas fa-tablet-alt" />}
          {displayMode === 'mobile' && <i className="fas fa-mobile-alt" />}
        </div>
      )}
      {tags &&
        tags.map((tag, i) => (
          <SelectorTag
            key={`${i}-${tag.value}`}
            selector={tag.value}
            type={tag.type}
            onRemove={handleClickRemove(i)}
            onChange={handleChangeItem(i)}
          />
        ))}
      <input
        ref={inputRef}
        className="border-none bg-transparent w-0 text-inherit outline-none focus:min-w-[50px] focus:grow focus:ring-transparent min-h-0 px-1 text-xs py-0"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        value={inputValue}
        onChange={handleChange}
      />
      {tags.length > 0 && (
        <Dropdown className="right-0 top-0 bottom-0 absolute flex justify-center items-center mr-2">
          <Dropdown.Container>
            {['none', 'hover', 'focus', 'active'].map(item => {
              const isActive = (currentState && currentState.value === item) || (!currentState && item === 'none');

              return (
                <div
                  key={item}
                  onClick={handleClickItem(item)}
                  className={classNames('px-2 py-1 hover:bg-gray-100 select-none', { 'text-blue-400': isActive })}
                >
                  {item}
                </div>
              );
            })}
          </Dropdown.Container>
        </Dropdown>
      )}
    </div>
  );
};

Selector.propTypes = {
  className: PropTypes.string,
  value: PropTypes.string,
  disabled: PropTypes.bool,
  onChange: PropTypes.func,
  displayMode: PropTypes.oneOf(['desktop', 'tablet', 'mobile'])
};

export default memo(Selector);
