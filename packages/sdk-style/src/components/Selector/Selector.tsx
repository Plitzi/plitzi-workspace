// Packages
import Button from '@plitzi/plitzi-ui/Button';
import Dropdown from '@plitzi/plitzi-ui/Dropdown';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import classNames from 'classnames';
import get from 'lodash/get';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { selectorFormatter } from './SelectorHelper';
import SelectorSuggestions from './SelectorSuggestions';
import SelectorTag from './SelectorTag';
import StyleManager from '../StyleManager';

import type { Style, StyleItem } from '@plitzi/sdk-shared';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

export type SelectorValue = Pick<StyleItem, 'name' | 'type'>;

export type SelectorProps = {
  className?: string;
  value?: string;
  selectorSelected?: Pick<StyleItem, 'name' | 'type'>;
  displayMode?: 'desktop' | 'tablet' | 'mobile';
  disabled?: boolean;
  style: Style;
  onChange?: (value: string) => void;
  onSelectorSelected?: (selector: SelectorValue | ((state?: SelectorValue) => SelectorValue | undefined)) => void;
  onSelectorAdded?: (selector: SelectorValue, selectTag?: boolean, tag?: object) => void;
  onSelectorRemoved?: (selector: string) => void;
};

const Selector = ({
  className = '',
  value = '',
  selectorSelected,
  displayMode = 'desktop',
  disabled = false,
  style,
  onChange,
  onSelectorSelected,
  onSelectorAdded
  // onSelectorRemoved
}: SelectorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [popupOpened, setPopupOpened] = useState(false);
  const { existsPopup, addPopup } = usePopup('floating');
  const tags = useMemo<SelectorValue[]>(
    () =>
      Object.values(pick(get(style, `platform.${displayMode}`), value.split(' '))).map(tag =>
        pick(tag, ['name', 'type'])
      ),
    [style, displayMode, value]
  );
  const selectorsAvailables = useMemo<StyleItem[]>(
    () => Object.values(omit(get(style, `platform.${displayMode}`), value.split(' '))),
    [style, displayMode, value]
  );

  const handleChange = useCallback((e: ChangeEvent) => {
    setPopupOpened((e.target as HTMLInputElement).value.length > 0);
    setInputValue((e.target as HTMLInputElement).value);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.focus();
    setPopupOpened(inputValue.length > 0);
  }, [inputRef, inputValue]);

  const handleClickSelector = useCallback(
    (selector: SelectorValue) => {
      onSelectorSelected?.(state => {
        if (state && state.name === selector.name) {
          return undefined;
        }

        return selector;
      });
    },
    [onSelectorSelected]
  );

  const handleChangeItem = useCallback(
    (position: number) =>
      (value: SelectorValue, selectTag = true) => {
        const finalValue = [...tags.filter((tag, i) => i !== position), value]
          .filter(tag => !!tag.name)
          .reduce((acum, tag) => `${acum} ${tag.name}`, '')
          .trim();

        onSelectorAdded?.(value);
        onChange?.(finalValue);
        if (selectTag) {
          onSelectorSelected?.(value);
        }
      },
    [tags, onSelectorAdded, onChange, onSelectorSelected]
  );

  const handleChangeItemState = useCallback(
    (tag: SelectorValue) => (tagState: string) => {
      if (!tagState) {
        onSelectorSelected?.(tag);

        return;
      }

      const tempTag: Pick<StyleItem, 'name' | 'type'> = { name: `${tag.name}:${tagState}`, type: 'state' };
      onSelectorAdded?.(tempTag);
      onSelectorSelected?.(tempTag);
    },
    [onSelectorAdded, onSelectorSelected]
  );

  const handleClickAction =
    (position: number) => (action: 'duplicate' | 'remove' | 'delete', value?: SelectorValue) => {
      switch (action) {
        case 'remove': {
          const finalTags = tags.filter((tag, i) => i !== position);
          const finalValue = finalTags.reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
          if (selectorSelected && tags[position].name === selectorSelected.name) {
            onSelectorSelected?.(get(finalTags, '0'));
          }

          onChange?.(finalValue);
          break;
        }

        case 'duplicate': {
          if (!value) {
            break;
          }

          const finalValue = [...tags, value]
            .filter(tag => !!tag.name)
            .reduce((acum, tag) => `${acum} ${tag.name}`, '')
            .trim();

          onSelectorAdded?.(value, true, get(tags, `${position}`));
          onChange?.(finalValue);
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
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter': {
          const { value: newValue } = e.target as HTMLInputElement;
          if (newValue !== '' && !tags.find(tag => tag.name === newValue)) {
            setInputValue('');
            const tag: Pick<StyleItem, 'name' | 'type'> = { name: selectorFormatter(newValue), type: 'class' };
            const finalValue = [...tags, tag]
              .filter(tag => !!tag.name)
              .reduce((acum, tag) => `${acum} ${tag.name}`, '')
              .trim();

            onSelectorAdded?.(tag);
            onChange?.(finalValue);
            setPopupOpened(false);
            (e.target as HTMLInputElement).blur();
            onSelectorSelected?.(tag);
          }

          setTimeout(() => {
            inputRef.current?.focus();
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
          (e.target as HTMLInputElement).blur();

          break;
        }

        default:
          break;
      }
    },
    [tags, onSelectorAdded, onChange, onSelectorSelected]
  );

  const handleDropdownVisible = useCallback((visible: boolean) => setPopupOpened(visible), []);

  const handleSuggestionsSelect = useCallback(
    (tag: SelectorValue) => {
      setTimeout(() => setInputValue(''), 0);
      setPopupOpened(false);
      const finalValue = [...tags, tag].reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange?.(finalValue);
      onSelectorSelected?.(tag);
    },
    [tags, onChange, onSelectorSelected]
  );

  const handleSuggestionsCreate = useCallback(
    (tag: SelectorValue) => {
      setTimeout(() => setInputValue(''), 0);
      setPopupOpened(false);
      const finalValue = [...tags, tag].reduce<string>((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange?.(finalValue);
      onSelectorAdded?.(tag);
      onSelectorSelected?.(tag);
    },
    [tags, onChange, onSelectorAdded, onSelectorSelected]
  );

  const handleClickStyleManager = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!existsPopup?.('styleManager')) {
        addPopup?.('styleManager', <StyleManager />, {
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
          className={classNames('flex-wrap border border-gray-300 rounded-sm relative p-1 gap-1 flex', className, {
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
            className="hover:bg-gray-200 border border-gray-300 rounded-sm h-6 w-6 text-gray-500"
            title="Style Manager"
          >
            <i className="fas fa-swatchbook" />
          </Button>
          {tags.map((tag, i) => (
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
            className="border-none bg-transparent w-0 text-inherit outline-hidden focus:min-w-[50px] focus:grow focus:ring-transparent min-h-0 px-1 text-xs py-0 flex"
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
