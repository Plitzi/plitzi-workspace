import Button from '@plitzi/plitzi-ui/Button';
import ContainerFloating, { useFloating } from '@plitzi/plitzi-ui/ContainerFloating';
import { get, pick, omit } from '@plitzi/plitzi-ui/helpers';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import clsx from 'clsx';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { inStylesheetOrder, overrideNote, overriddenProperties, selectorFormatter } from './SelectorHelper';
import SelectorItem from './SelectorItem';
import SelectorSuggestions, { suggestionsFor } from './SelectorSuggestions';
import StyleManager from '../StyleManager';

import type { StyleItem } from '@plitzi/sdk-shared';
import type { ChangeEvent, CSSProperties, KeyboardEvent, MouseEvent } from 'react';

export type SelectorValue = Pick<StyleItem, 'name' | 'type'>;

const STACKING_RULE =
  'Classes apply left to right, in the order the stylesheet lists them: where two set the same property, the one further right wins.';

export type SelectorProps = {
  className?: string;
  value?: string;
  selectors?: Record<string, StyleItem>;
  selector?: Pick<StyleItem, 'name' | 'type'>;
  componentType?: string;
  /** What a class's chip reads as instead of its name, by name (see `SelectorItem`'s `label`). */
  labels?: Record<string, string>;
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
  labels,
  disabled = false,
  onChange,
  onSelectorSelected,
  onAdd,
  onRemove
}: SelectorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
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
  // Shown in the order they win in — the stylesheet's — while every edit keeps addressing a class by where the element
  // writes it, so reading the order changes nothing that is stored.
  const orderedTags = useMemo(
    () =>
      inStylesheetOrder(
        tags.map((tag, position) => ({ ...tag, position })),
        Object.keys(selectors ?? {})
      ),
    [tags, selectors]
  );
  const overridden = useMemo(
    () =>
      overriddenProperties(
        orderedTags.map(({ name }) => name),
        selectors ?? {}
      ),
    [orderedTags, selectors]
  );
  const note = useMemo(
    () => overrideNote(selectorProp?.name.replace(/:.*/, ''), overridden),
    [selectorProp, overridden]
  );
  const selectorsAvailables = useMemo<StyleItem[]>(
    () => Object.values(omit(selectors ?? {}, value.split(' '))),
    [selectors, value]
  );

  const suggestions = useMemo(() => suggestionsFor(inputValue, selectorsAvailables), [inputValue, selectorsAvailables]);
  const optionsCount = suggestions.list.length + (suggestions.creates ? 1 : 0);

  const handleChangeInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setOpen(true);
      setInputValue(e.target.value);
      // What is typed is what Enter makes: the keys pick from the list only once they move into it.
      setHighlighted(-1);
    },
    [setOpen]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.focus();
    setOpen(true);
  }, [inputRef, setOpen]);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter': {
          if (highlighted >= 0) {
            e.preventDefault();
            if (suggestions.creates && highlighted === 0) {
              handleSuggestionsCreate({ name: suggestions.creates, type: 'class' });
            } else {
              const picked = suggestions.list.at(highlighted - (suggestions.creates ? 1 : 0));
              if (picked) {
                handleSuggestionsSelect(picked);
              }
            }

            setHighlighted(-1);

            break;
          }

          const { value: newValue } = e.currentTarget;
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
            e.currentTarget.blur();
            onSelectorSelected?.(tag);
          }

          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);

          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          setHighlighted(current => Math.max(current - 1, -1));

          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          setOpen(true);
          setHighlighted(current => Math.min(current + 1, optionsCount - 1));

          break;
        }

        case 'Escape': {
          e.stopPropagation();
          setInputValue('');
          setHighlighted(-1);
          setOpen(false);
          e.currentTarget.blur();

          break;
        }

        default:
          break;
      }
    },
    [
      tags,
      onAdd,
      onChange,
      onSelectorSelected,
      setOpen,
      highlighted,
      suggestions,
      optionsCount,
      handleSuggestionsCreate,
      handleSuggestionsSelect
    ]
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
          // Two columns — the selectors and the inspector — each wide enough to read without cutting a label.
          width: 720,
          height: 640
        });
      }
    },
    [addPopup, existsPopup]
  );

  const contentStyle = useMemo<CSSProperties>(() => ({ width: triggerRect?.width }), [triggerRect]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <ContainerFloating ref={triggerRef} className="w-full" open={open}>
        <ContainerFloating.Trigger className="w-full">
          <div
            className={clsx(
              'relative flex min-h-8 items-center gap-1 rounded-md border bg-white py-1 pr-1 pl-1 dark:bg-zinc-900',
              className,
              {
                'pointer-events-none cursor-not-allowed border-gray-200 opacity-60 dark:border-zinc-800': disabled,
                'focus-within:border-primary-500 focus-within:ring-primary-500/20 cursor-text border-gray-300 focus-within:ring-2 dark:border-zinc-700':
                  !disabled
              }
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
          >
            <div className="flex min-w-0 grow flex-wrap items-center gap-1">
              {tagComponent && (
                <SelectorItem
                  selector={tagComponent.name}
                  type={tagComponent.type}
                  editable={false}
                  active={tagComponent.name === selectorProp?.name.replace(/:.*/, '')}
                  onClick={handleClickSelector}
                />
              )}
              {orderedTags.map(({ position, ...tag }) => (
                <SelectorItem
                  key={`${position}_${tag.name}`}
                  selector={tag.name}
                  label={labels?.[tag.name]}
                  type={tag.type}
                  editable={tag.type !== 'element'}
                  active={tag.name === selectorProp?.name.replace(/:.*/, '')}
                  onAction={handleClickAction(position)}
                  onClick={handleClickSelector}
                  onChange={handleChangeItem(position)}
                />
              ))}
              <input
                ref={inputRef}
                className="min-w-20 grow basis-0 border-none bg-transparent px-1 py-0.5 text-xs text-inherit outline-hidden placeholder:text-zinc-400 focus:ring-transparent dark:placeholder:text-zinc-500"
                placeholder={orderedTags.length > 0 ? 'Add class…' : 'Add a class to style it…'}
                aria-label="Add a class"
                aria-expanded={open}
                aria-autocomplete="list"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                value={inputValue}
                onChange={handleChangeInput}
              />
            </div>
            <Button
              intent="secondary"
              size="custom"
              onClick={handleClickStyleManager}
              className="h-6 w-6 shrink-0 self-start rounded bg-transparent text-zinc-500 hover:bg-gray-100 hover:text-zinc-900 dark:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Open the Style Manager: every class and element default of the space"
            >
              <Button.Icon icon="fas fa-swatchbook" />
            </Button>
          </div>
        </ContainerFloating.Trigger>
        <ContainerFloating.Content style={contentStyle}>
          <SelectorSuggestions
            suggestions={suggestions}
            highlighted={highlighted}
            onSelect={handleSuggestionsSelect}
            onCreate={handleSuggestionsCreate}
          />
        </ContainerFloating.Content>
      </ContainerFloating>
      {orderedTags.length > 1 && (
        <div
          className="flex min-w-0 items-center gap-1.5 px-1 text-[11px] text-gray-500 dark:text-zinc-400"
          title={note ?? STACKING_RULE}
        >
          <i className="fas fa-circle-info shrink-0" title={STACKING_RULE} />
          <span className="truncate">{note ?? 'Left to right: the class further right wins where they overlap'}</span>
        </div>
      )}
    </div>
  );
};

export default memo(Selector);
