// Packages
import React, { memo, useCallback, use, useMemo, useRef, useState } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import get from 'lodash/get';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import Button from '@plitzi/plitzi-ui-components/Button';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';

// Alias
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';

// Relatives
import SelectorTag from './SelectorTag';
import { selectorFormatter } from './SelectorHelper';
import SelectorSuggestions from './SelectorSuggestions';
import StyleManager from '../StyleManager';

/**
 * @param {{
 *   className?: string;
 *   value?: string;
 *   selectorSelected?: object;
 *   displayMode?: 'desktop' | 'tablet' | 'mobile';
 *   disabled?: boolean;
 *   onChange?: (value: string) => void;
 *   onSelectorSelected?: (selector: object) => void;
 *   onSelectorAdded?: (selector: object, selectTag?: boolean, tag?: object) => void;
 *   onSelectorRemoved?: (selector: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
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
  const [popupOpened, setPopupOpened] = useState(false);
  const { style } = use(BuilderStyleContext);
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
      onSelectorSelected(state => {
        if (state && state?.name === selector?.name) {
          return undefined;
        }

        return selector;
      });
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
          onSelectorSelected(get(finalTags, '0'));
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

  const handleKeyDown = useCallback(
    e => {
      switch (e.key) {
        case 'Enter': {
          const { value: newValue } = e.target;
          if (newValue !== '' && !tags.find(tag => tag.name === newValue)) {
            setInputValue('');
            const tag = { name: selectorFormatter(newValue), type: 'class' };
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

          setTimeout(() => {
            inputRef.current.focus();
          }, 0);

          break;
        }

        case 'ArrowUp': {
          setPopupOpened(false);

          break;
        }

        case 'ArrowDown': {
          setPopupOpened(true);

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
    },
    [onSelectorAdded, onChange, tags]
  );

  const handleDropdownVisible = useCallback(visible => setPopupOpened(visible), []);

  const handleSuggestionsSelect = useCallback(
    tag => {
      setTimeout(() => setInputValue(''), 0);
      setPopupOpened(false);
      const finalValue = [...tags, tag].reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange(finalValue);
      onSelectorSelected(tag);
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
        addPopup('styleManager', <StyleManager />, {
          icon: <i className="fas fa-swatchbook text-base" />,
          title: 'Style Manager',
          resizeHandles: ['se'],
          allowLeftSide: true,
          allowRightSide: true,
          placement: 'floating',
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
          className={classNames('flex-wrap border border-gray-300 rounded relative p-1 gap-1 flex', className, {
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
                key={`${i}_${tag.name}`}
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

export default memo(Selector);
