// Packages
import Button from '@plitzi/plitzi-ui/Button';
import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
// import { usePopup } from '@plitzi/plitzi-ui/Popup';
import classNames from 'classnames';
import get from 'lodash/get';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { selectorFormatter } from './SelectorHelper';
import SelectorSuggestions from './SelectorSuggestions';
import SelectorTag from './SelectorTag';
// import StyleManager from '../StyleManager';

import type { Style, StyleItem } from '@plitzi/sdk-shared';
import type { ChangeEvent, Dispatch, KeyboardEvent, SetStateAction } from 'react';

export type SelectorValue = Pick<StyleItem, 'name' | 'type'>;

export type SelectorProps = {
  className?: string;
  value?: string;
  selectorSelected?: Pick<StyleItem, 'name' | 'type'>;
  displayMode?: 'desktop' | 'tablet' | 'mobile';
  disabled?: boolean;
  style: Style;
  onSelectorSelected?: Dispatch<SetStateAction<SelectorValue | undefined>>;
  onAdd?: (selector: SelectorValue, isDuplicated: boolean, originalSelector?: SelectorValue) => void;
  onChange?: (value: string) => void;
  onRemove?: (selector: string) => void;
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
  onAdd
  // onRemove
}: SelectorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [popupOpened, setPopupOpened] = useState(false);
  // const { existsPopup, addPopup } = usePopup('floating');
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

        onAdd?.(value, false);
        onChange?.(finalValue);
        if (selectTag) {
          onSelectorSelected?.(value);
        }
      },
    [tags, onAdd, onChange, onSelectorSelected]
  );

  const handleChangeItemState = useCallback(
    (tag: SelectorValue) => (tagState: string) => {
      if (!tagState) {
        onSelectorSelected?.(tag);

        return;
      }

      const tempTag: Pick<StyleItem, 'name' | 'type'> = { name: `${tag.name}:${tagState}`, type: 'state' };
      onAdd?.(tempTag, false);
      onSelectorSelected?.(tempTag);
    },
    [onAdd, onSelectorSelected]
  );

  const handleClickAction = useCallback(
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

          onAdd?.(value, true, get(tags, `${position}`));
          onChange?.(finalValue);
          break;
        }

        case 'delete': {
          // onRemove(value.name);
          break;
        }

        default:
          break;
      }
    },
    [tags, selectorSelected, onChange, onSelectorSelected, onAdd]
  );

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

            onAdd?.(tag, false);
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
    [tags, onAdd, onChange, onSelectorSelected]
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
      onAdd?.(tag, false);
      onSelectorSelected?.(tag);
    },
    [tags, onChange, onAdd, onSelectorSelected]
  );

  // const handleClickStyleManager = useCallback(
  //   (e: MouseEvent) => {
  //     e.preventDefault();
  //     e.stopPropagation();
  //     if (!existsPopup?.('styleManager')) {
  //       addPopup?.('styleManager', <StyleManager />, {
  //         icon: <i className="fas fa-swatchbook text-base" />,
  //         title: 'Style Manager',
  //         resizeHandles: ['se'],
  //         allowLeftSide: true,
  //         allowRightSide: true,
  //         placement: 'floating',
  //         width: 600
  //       });
  //     }
  //   },
  //   [addPopup, existsPopup]
  // );

  return (
    <ContainerFloating
      className="w-full"
      // showIcon={false}
      // classNameBackground=""
      popupOpened={popupOpened}
      disabled
      onContainerVisible={handleDropdownVisible}
      backgroundDisabled
    >
      <ContainerFloating.Content className={classNames('w-full', { 'z-[51]': popupOpened })}>
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
            // onClick={handleClickStyleManager}
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
      </ContainerFloating.Content>
      <ContainerFloating.Container>
        <SelectorSuggestions
          selector={inputValue}
          selectors={selectorsAvailables}
          onSelect={handleSuggestionsSelect}
          onCreate={handleSuggestionsCreate}
        />
      </ContainerFloating.Container>
    </ContainerFloating>
  );
};

export default memo(Selector);
