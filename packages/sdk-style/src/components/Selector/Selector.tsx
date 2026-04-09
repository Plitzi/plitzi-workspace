// Packages
import Button from '@plitzi/plitzi-ui/Button';
import ContainerFloating, { useFloating } from '@plitzi/plitzi-ui/ContainerFloating';
import { get, pick, omit } from '@plitzi/plitzi-ui/helpers';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import clsx from 'clsx';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { selectorFormatter } from './SelectorHelper';
import SelectorItem from './SelectorItem';
import SelectorSuggestions from './SelectorSuggestions';
import StyleManager from '../StyleManager';

import type { StyleItem } from '@plitzi/sdk-shared';
import type { ChangeEvent, CSSProperties, KeyboardEvent, MouseEvent, RefObject } from 'react';

export type SelectorValue = Pick<StyleItem, 'name' | 'type'>;

export type SelectorProps = {
  className?: string;
  value?: string;
  selectors?: Record<string, StyleItem>;
  selector?: Pick<StyleItem, 'name' | 'type'>;
  componentType?: string;
  disabled?: boolean;
  onSelectorSelected?: (selector?: SelectorValue) => void;
  onAdd?: (selector: SelectorValue, isDuplicated: boolean, originalSelector?: SelectorValue) => void;
  onChange?: (value: string) => void;
  onRemove?: (selector: SelectorValue) => void;
};

const Selector = ({
  className = '',
  value = '',
  selectors,
  selector: selectorProp,
  componentType,
  disabled = false,
  onChange,
  onSelectorSelected,
  onAdd,
  onRemove
}: SelectorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen, , triggerRef, triggerRect] = useFloating({ disabled });
  const { existsPopup, addPopup } = usePopup('floating');
  const tagComponent = useMemo(
    () =>
      Object.values(selectors ?? {}).find(
        selector => selector.type === 'element' && selector.componentType === componentType
      ),
    [componentType, selectors]
  );
  const tags = useMemo<SelectorValue[]>(() => {
    return Object.values(pick(selectors ?? {}, value.split(' '))).map(tag => pick(tag, ['name', 'type']));
  }, [selectors, value]);
  const selectorsAvailables = useMemo<StyleItem[]>(
    () => Object.values(omit(selectors ?? {}, value.split(' '))),
    [selectors, value]
  );

  const handleChangeInput = useCallback(
    (e: ChangeEvent) => {
      setOpen((e.target as HTMLInputElement).value.length > 0);
      setInputValue((e.target as HTMLInputElement).value);
    },
    [setOpen]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.focus();
    setOpen(inputValue.length > 0);
  }, [inputRef, inputValue, setOpen]);

  const handleClickSelector = useCallback(
    (selector: SelectorValue) => onSelectorSelected?.(selector),
    [onSelectorSelected]
  );

  const handleChangeItem = useCallback(
    (position: number) =>
      (value: SelectorValue, selectTag = true) => {
        const finalValue = [...tags.filter((_tag, i) => i !== position), value]
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

  const handleClickAction = useCallback(
    (position: number) => (action: 'duplicate' | 'remove' | 'delete', value?: SelectorValue) => {
      switch (action) {
        case 'remove':
        case 'delete': {
          const finalTags = tags.filter((_tag, i) => i !== position);
          const finalValue = finalTags.reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
          if (selectorProp && tags[position].name === selectorProp.name) {
            onSelectorSelected?.(get(finalTags, '0'));
          }

          onChange?.(finalValue);
          if (action === 'delete') {
            onRemove?.(tags[position]);
          }

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

        default:
          break;
      }
    },
    [tags, selectorProp, onChange, onSelectorSelected, onAdd, onRemove]
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
            setOpen(false);
            (e.target as HTMLInputElement).blur();
            onSelectorSelected?.(tag);
          }

          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);

          break;
        }

        case 'ArrowUp': {
          setOpen(false);

          break;
        }

        case 'ArrowDown': {
          setOpen(true);

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
    [tags, onAdd, onChange, onSelectorSelected, setOpen]
  );

  const handleSuggestionsSelect = useCallback(
    (tag: SelectorValue) => {
      setTimeout(() => setInputValue(''), 0);
      setOpen(false);
      const finalValue = [...tags, tag].reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange?.(finalValue);
      onSelectorSelected?.(tag);
    },
    [tags, onChange, onSelectorSelected, setOpen]
  );

  const handleSuggestionsCreate = useCallback(
    (tag: SelectorValue) => {
      setTimeout(() => setInputValue(''), 0);
      setOpen(false);
      const finalValue = [...tags, tag].reduce((acum, tag) => `${acum} ${tag.name}`, '').trim();
      onChange?.(finalValue);
      onAdd?.(tag, false);
      onSelectorSelected?.(tag);
    },
    [tags, onChange, onAdd, onSelectorSelected, setOpen]
  );

  const handleClickStyleManager = useCallback(
    (e: MouseEvent) => {
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

  const contentStyle = useMemo<CSSProperties>(() => ({ width: triggerRect?.width }), [triggerRect]);
  const tagsToRender = tagComponent ? [tagComponent, ...tags] : tags;

  return (
    <ContainerFloating ref={triggerRef as RefObject<HTMLDivElement>} className="w-full" open={open}>
      <ContainerFloating.Trigger className="w-full">
        <div
          className={clsx(
            'bg-grayviolet-200 relative flex flex-wrap gap-1 rounded-sm p-1 dark:bg-zinc-800',
            className,
            {
              'pointer-events-none cursor-not-allowed bg-gray-100 dark:bg-zinc-900': disabled,
              'cursor-pointer': !disabled
            }
          )}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <Button
            intent="secondary"
            size="custom"
            onClick={handleClickStyleManager}
            className="h-7 w-7 rounded-sm bg-white dark:bg-zinc-700 dark:text-zinc-200"
            title="Style Manager"
          >
            <Button.Icon icon="fas fa-swatchbook" />
          </Button>
          {tagsToRender.map((tag, i) => (
            <SelectorItem
              key={`${i}_${tag.name}`}
              selector={tag.name}
              type={tag.type}
              editable={tag.type !== 'element'}
              active={tag.name === selectorProp?.name.replace(/:.*/, '')}
              onAction={handleClickAction(tagComponent ? i - 1 : i)}
              onClick={handleClickSelector}
              onChange={handleChangeItem(tagComponent ? i - 1 : i)}
            />
          ))}
          <input
            ref={inputRef}
            className="flex min-h-0 w-0 border-none bg-transparent px-1 py-0 text-xs text-inherit outline-hidden focus:min-w-[50px] focus:grow focus:ring-transparent"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={inputValue}
            onChange={handleChangeInput}
          />
        </div>
      </ContainerFloating.Trigger>
      <ContainerFloating.Content style={contentStyle}>
        <SelectorSuggestions
          selector={inputValue}
          selectors={selectorsAvailables}
          onSelect={handleSuggestionsSelect}
          onCreate={handleSuggestionsCreate}
        />
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default memo(Selector);
