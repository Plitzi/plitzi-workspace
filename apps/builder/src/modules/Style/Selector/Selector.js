// Packages
import React, { memo, useCallback, useContext, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import get from 'lodash/get';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import Button from '@plitzi/plitzi-ui-components/Button';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import usePopup from '@plitzi/plitzi-ui-components/Popup/usePopup';
import { POPUP_PLACEMENT_FLOATING } from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Monorepo
import { StyleSelectors } from '@plitzi/sdk-style/StyleHelper';

// Alias
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';

// Relatives
import SelectorTag from './SelectorTag';
import { selectorFormatter } from './SelectorHelper';
import SelectorSuggestions from './SelectorSuggestions';
import StyleManager from '../StyleManager';

const Selector = props => {
  const {
    className = '',
    value = '',
    selectorSelected,
    displayMode = 'desktop',
    disabled = false,
    onChange = noop,
    onSelectorSelected = noop,
    onSelectorAdded = noop
    // onSelectorRemoved = noop
  } = props;
  const inputRef = useRef();
  const [inputValue, setInputValue] = useState('');
  const { style } = useContext(BuilderStyleContext);
  const { existsPopup, addPopup } = usePopup();
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
      onSelectorSelected(selector);
    },
    [onSelectorSelected]
  );

  const handleChangeItem =
    position =>
    (value, selectTag = true) => {
      const finalValue = [...tags.filter((tag, i) => i !== position), value]
        .filter(tag => !!tag?.name)
        .reduce((acum, tag) => `${acum} ${tag.name}`, '')
        .trim();

      onSelectorAdded(value);
      onChange(finalValue);
      if (selectTag) {
        onSelectorSelected(value);
      }
    };

  const handleChangeItemState = useCallback(
    tag => tagState => {
      if (!tagState) {
        onSelectorSelected(tag);

        return;
      }

      const tempTag = { name: `${tag.name}:${tagState}`, type: 'state' };
      onSelectorAdded(tempTag);
      onSelectorSelected(tempTag);
    },
    [onSelectorAdded, onSelectorSelected]
  );

  const handleClickAction = position => (action, value) => {
    switch (action) {
      case 'remove': {
        const finalTags = tags.filter((tag, i) => i !== position);
        const finalValue = finalTags.reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
        if (selectorSelected && tags[position].name === selectorSelected.name) {
          onSelectorSelected(get(finalTags, '0.name', ''));
        }

        onChange(finalValue);
        break;
      }

      case 'duplicate': {
        const finalValue = [...tags, value]
          .filter(tag => !!tag?.name)
          .reduce((acum, tag) => `${acum} ${tag.name}`, '')
          .trim();

        onSelectorAdded(value, true, get(tags, `${position}`));
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
          const tag = { name: selectorFormatter(value), type: StyleSelectors.SELECTOR_CLASS };
          const finalValue = [...tags, tag]
            .filter(tag => !!tag?.name)
            .reduce((acum, tag) => `${acum} ${tag.name}`, '')
            .trim();

          onSelectorAdded(tag);
          onChange(finalValue);
          setPopupOpened(false);
          e.target.blur();
          onSelectorSelected(tag);
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
      onSelectorSelected(tag.name);
    },
    [tags, onChange, onSelectorSelected]
  );

  const handleSuggestionsCreate = useCallback(
    tag => {
      setTimeout(() => setInputValue(''), 0);
      setPopupOpened(false);
      const finalValue = [...tags, tag].reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange(finalValue);
      onSelectorAdded(tag);
      onSelectorSelected(tag.name);
    },
    [tags, onChange, onSelectorSelected]
  );

  const handleClickStyleManager = useCallback(
    e => {
      e.preventDefault();
      e.stopPropagation();
      if (!existsPopup('styleManager')) {
        const title = (
          <>
            <i className="fas fa-swatchbook m-1 text-base" />
            Style Manager
          </>
        );
        addPopup('styleManager', <StyleManager />, {
          resizeHandles: ['se'],
          title,
          allowLeftSide: true,
          allowRightSide: true,
          placement: POPUP_PLACEMENT_FLOATING,
          width: 600
        });
      }
    },
    [addPopup, existsPopup]
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
      <Dropdown.Content className={classNames('w-full', { 'z-[51]': popupOpened })}>
        <div
          className={classNames('flex flex-wrap border border-gray-300 rounded relative p-1 gap-1 flex', className, {
            'bg-gray-100 pointer-events-none cursor-not-allowed': disabled,
            'cursor-pointer': !disabled
          })}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <Button
            intent="custom"
            size="custom"
            onClick={handleClickStyleManager}
            className="hover:bg-gray-200 border border-gray-300 rounded h-6 w-6 text-gray-500"
            title="Style Manager"
          >
            <i className="fas fa-swatchbook" />
          </Button>
          {tags &&
            tags.map((tag, i) => (
              <SelectorTag
                key={`${i}-${tag.name}`}
                selector={tag.name}
                type={tag.type}
                active={tag.name === selectorSelected?.name.replace(/:.*/, '')}
                onAction={handleClickAction(i)}
                onClick={handleClickSelector}
                onChange={handleChangeItem(i)}
                onChangeState={handleChangeItemState(tag)}
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
        {popupOpened && (
          <SelectorSuggestions
            selector={inputValue}
            selectors={selectorsAvailables}
            onSelect={handleSuggestionsSelect}
            onCreate={handleSuggestionsCreate}
          />
        )}
      </Dropdown.Container>
    </Dropdown>
  );
};

Selector.propTypes = {
  className: PropTypes.string,
  value: PropTypes.string,
  selectorSelected: PropTypes.object,
  disabled: PropTypes.bool,
  displayMode: PropTypes.oneOf(['desktop', 'tablet', 'mobile']),
  onChange: PropTypes.func,
  onSelectorSelected: PropTypes.func,
  onSelectorAdded: PropTypes.func,
  onSelectorRemoved: PropTypes.func
};

export default memo(Selector);
