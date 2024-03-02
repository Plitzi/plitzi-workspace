// Packages
import React, { memo, useCallback, useContext, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import get from 'lodash/get';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// Alias
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';

// Relatives
import SelectorTag from './SelectorTag';
import { selectorFormatter } from './SelectorHelper';
import { StyleSelectors } from '../StyleHelper';
import SelectorSuggestions from './SelectorSuggestions';

const Selector = props => {
  const {
    className = '',
    value = '',
    displayMode = 'desktop',
    disabled = false,
    onChange = noop,
    onSelectorSelected = noop,
    onSelectorAdded = noop
    // onSelectorRemoved = noop
  } = props;
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const { style } = useContext(BuilderStyleContext);
  const tags = useMemo(
    () =>
      Object.values(pick(get(style, `platform.${displayMode}`), value.split(' '))).map(tag =>
        pick(tag, ['name', 'type'])
      ),
    [value, style]
  );
  const selectorsAvailables = useMemo(
    () => Object.values(omit(get(style, `platform.${displayMode}`), value.split(' '))),
    [style, displayMode]
  );
  const [selectorSelected, setSelectorSelected] = useState(get(tags, '0.name', ''));
  const [popupOpened, setPopupOpened] = useState(false);

  const handleChange = useCallback(e => {
    setPopupOpened(e.target.value.length > 0);
    setInputValue(e.target.value);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current.focus();
    setPopupOpened(inputValue.length > 0);
  }, [inputRef, inputValue]);

  const handleClickSelector = useCallback(
    selector => {
      setSelectorSelected(selector);
      onSelectorSelected(selector);
    },
    [onSelectorSelected]
  );

  const handleChangeItem = position => value => {
    const finalValue = [...tags.filter((tag, i) => i !== position), value]
      .filter(tag => !!tag?.name)
      .reduce((acum, tag) => `${acum} ${tag.name}`, '')
      .trim();

    onSelectorAdded(value.name);
    onChange(finalValue);
  };

  const handleClickAction = position => (action, value) => {
    switch (action) {
      case 'remove': {
        const finalTags = tags.filter((tag, i) => i !== position);
        const finalValue = finalTags.reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
        if (tags[position].name === selectorSelected) {
          setSelectorSelected(get(finalTags, '0.name', ''));
        }

        onChange(finalValue);
        break;
      }

      case 'duplicate': {
        const finalValue = [...tags, value]
          .filter(tag => !!tag?.name)
          .reduce((acum, tag) => `${acum} ${tag.name}`, '')
          .trim();

        onSelectorAdded(value.name, true, get(tags, `${position}.name`, ''));
        onChange(finalValue);
        break;
      }

      case 'delete': {
        // onSelectorRemoved(value.name);
        break;
      }

      default:
        break;
    }
  };

  const handleKeyDown = e => {
    switch (e.key) {
      case 'Enter': {
        const { value } = e.target;

        if (value !== '' && !tags.find(tag => tag.name === value)) {
          setTimeout(() => setInputValue(''), 0);
          const finalValue = [...tags, { name: selectorFormatter(value), type: StyleSelectors.SELECTOR_CLASS }]
            .filter(tag => !!tag?.name)
            .reduce((acum, tag) => `${acum} ${tag.name}`, '')
            .trim();

          onSelectorAdded(value);
          onChange(finalValue);
          setPopupOpened(false);
          e.target.blur();
          if (!selectorSelected) {
            setSelectorSelected(value);
          }
        }

        break;
      }

      case 'Escape': {
        e.stopPropagation();
        setInputValue('');
        e.target.blur();

        break;
      }

      default:
        break;
    }
  };

  const handleDropdownVisible = useCallback(visible => setPopupOpened(visible), []);

  const handleSuggestionsSelect = useCallback(
    tag => {
      setTimeout(() => setInputValue(''), 0);
      setPopupOpened(false);
      const finalValue = [...tags, tag].reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange(finalValue);
      setSelectorSelected(tag.name);
    },
    [tags, onChange, selectorSelected]
  );

  const handleSuggestionsCreate = useCallback(
    tag => {
      setTimeout(() => setInputValue(''), 0);
      setPopupOpened(false);
      const finalValue = [...tags, tag].reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange(finalValue);
      onSelectorAdded(tag.name);
      setSelectorSelected(tag.name);
    },
    [tags, onChange, selectorSelected]
  );

  return (
    <Dropdown
      className="w-full"
      showIcon={false}
      popupOpened={popupOpened}
      disabled
      onContainerVisible={handleDropdownVisible}
      backgroundDisabled
      classNameBackground=""
    >
      <Dropdown.Content className="w-full z-[51]">
        <div
          className={classNames('flex flex-wrap border border-gray-300 rounded relative p-1 gap-1 flex', className, {
            'bg-gray-100 pointer-events-none cursor-not-allowed': disabled,
            'cursor-pointer': !disabled
          })}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          {tags &&
            tags.map((tag, i) => (
              <SelectorTag
                key={`${i}-${tag.value}`}
                selector={tag.name}
                type={tag.type}
                active={tag.name === selectorSelected}
                onAction={handleClickAction(i)}
                onClick={handleClickSelector}
                onChange={handleChangeItem(i)}
              />
            ))}
          <input
            ref={inputRef}
            className="border-none bg-transparent w-0 text-inherit outline-none focus:min-w-[50px] focus:grow focus:ring-transparent min-h-0 px-1 text-xs py-0 flex"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={inputValue}
            onChange={handleChange}
          />
        </div>
      </Dropdown.Content>
      <Dropdown.Container>
        <SelectorSuggestions
          selector={inputValue}
          selectors={selectorsAvailables}
          onSelect={handleSuggestionsSelect}
          onCreate={handleSuggestionsCreate}
        />
      </Dropdown.Container>
    </Dropdown>
  );
};

Selector.propTypes = {
  className: PropTypes.string,
  value: PropTypes.string,
  disabled: PropTypes.bool,
  displayMode: PropTypes.oneOf(['desktop', 'tablet', 'mobile']),
  onChange: PropTypes.func,
  onSelectorSelected: PropTypes.func,
  onSelectorAdded: PropTypes.func,
  onSelectorRemoved: PropTypes.func
};

export default memo(Selector);
