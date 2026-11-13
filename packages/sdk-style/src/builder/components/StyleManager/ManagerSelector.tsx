import Button from '@plitzi/plitzi-ui/Button';
import { isEmpty } from '@plitzi/plitzi-ui/helpers/lodash';
import useDisclosure from '@plitzi/plitzi-ui/hooks/useDisclosure';
import Input from '@plitzi/plitzi-ui/Input';
import Modal from '@plitzi/plitzi-ui/Modal';
import clsx from 'clsx';
import { produce } from 'immer';
import { useCallback, use, useMemo, useState, memo } from 'react';

import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import StyleSelectorTag from './StyleSelectorTag';
import useWindowedList from '../../hooks/useWindowedList';
import SelectorForm from '../../models/SelectorForm';
import { ancestorRemovals, unusedAncestors } from '../StyleInspector/helpers';

import type { SelectorFormValues } from '../../models/SelectorForm';
import type { DisplayMode, Element, Schema, StyleItem } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type ManagerSelectorProps = {
  displayMode: DisplayMode;
  flat: Schema['flat'];
  flatList: Element[];
  selected?: string;
  onSelect?: Dispatch<SetStateAction<StyleItem | undefined>>;
  selectors?: Record<string, StyleItem>;
};

/** The class a selector names, without the state written after it (`card:hover`): what an element lists. */
const classOf = (selector: string): string => selector.split(':')[0];

/** Whether any of the element's selectors lists the class. */
const wears = (element: Element, selector: string): boolean => {
  const name = classOf(selector);

  return !!name && Object.values(element.definition.styleSelectors).some(classes => classes.split(' ').includes(name));
};

/** What the list shows: every selector, the classes, the element types' defaults, or the classes no element wears. */
type ListFilter = 'all' | 'classes' | 'elements' | 'unused';

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'classes', label: 'Classes' },
  { id: 'elements', label: 'Elements' },
  { id: 'unused', label: 'Unused' }
];

/** A row of the list: a section's head, a group's (a prefix the classes share), or a selector. */
type ListItem =
  | { kind: 'section'; key: string; title: string; count: number }
  | { kind: 'group'; key: string; prefix: string; count: number; open: boolean }
  | { kind: 'row'; key: string; selector: StyleItem };

const HEIGHT: Record<ListItem['kind'], number> = { section: 28, group: 28, row: 32 };

/** Past this many classes, they are listed by the prefix they share — `adm-`, `lp-` — each folded until opened. */
const GROUPED_FROM = 40;

/** A prefix fewer classes share is no group of its own: they are listed under Other, folded too. */
const GROUP_MIN = 5;

/** The group of the classes no prefix of enough of them gathers. */
const OTHER = 'Other';

/** The prefix a class is grouped under: what its name says before its first dash, or none for a name with none. */
const prefixOf = (name: string): string | undefined => {
  const dash = name.indexOf('-');

  return dash > 0 ? name.slice(0, dash + 1) : undefined;
};

const ManagerSelector = ({ displayMode, flat, flatList, selectors, selected, onSelect }: ManagerSelectorProps) => {
  const selectorsArr = useMemo(() => Object.values(selectors ?? {}), [selectors]);
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [checkedSelectors, setCheckedSelectors] = useState<string[]>([]);
  const { builderHandler } = use(BuilderContext);
  const [platform] = useBuilderStore('style.platform');
  const { components } = use(ComponentContext);
  const componentsNotAvailables = useMemo(
    () => selectorsArr.filter(selector => !!selector.componentType).map(selector => selector.componentType as string),
    [selectorsArr]
  );
  const searched = useMemo(() => {
    let selectorsParsed = selectorsArr;
    if (!isEmpty(searchInput)) {
      selectorsParsed = selectorsArr.filter(selector =>
        selector.name.toLowerCase().includes(searchInput.toLowerCase())
      );
    }

    return [...selectorsParsed].sort((a, b) => {
      const aNumber = Number(a.type === 'element');
      const bNumber = Number(b.type === 'element');

      return aNumber === bNumber ? a.name.localeCompare(b.name) : bNumber - aNumber;
    });
  }, [selectorsArr, searchInput]);

  // One pass over the elements, each class counted once per element that wears it: a filter per selector read every
  // element 1,900 times over on the website.
  const elementCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const element of flatList) {
      const worn = new Set(
        Object.values(element.definition.styleSelectors).flatMap(classes => classes.split(' ').filter(Boolean))
      );
      worn.forEach(name => {
        counts[name] = (counts[name] ?? 0) + 1;
      });
    }

    return Object.fromEntries(selectorsArr.map(selector => [selector.name, counts[classOf(selector.name)] ?? 0]));
  }, [selectorsArr, flatList]);

  /** What each filter keeps of what is searched — the list shown, and the count beside each filter. */
  const byFilter = useMemo<Record<ListFilter, StyleItem[]>>(() => {
    const classes = searched.filter(selector => selector.type !== 'element');

    return {
      all: searched,
      classes,
      elements: searched.filter(selector => selector.type === 'element'),
      unused: classes.filter(selector => elementCounts[selector.name] === 0)
    };
  }, [searched, elementCounts]);
  const finalSelectors = byFilter[filter];
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const items = useMemo<ListItem[]>(() => {
    const rows = (list: StyleItem[]): ListItem[] =>
      list.map(selector => ({ kind: 'row', key: selector.name, selector }));
    // Grouped when long and nothing is searched: a search shows its matches whole.
    const grouped = (list: StyleItem[]): ListItem[] => {
      if (list.length < GROUPED_FROM || searchInput) {
        return rows(list);
      }

      const groups = new Map<string, StyleItem[]>();
      const loose: StyleItem[] = [];
      for (const selector of list) {
        const prefix = prefixOf(selector.name);
        if (prefix) {
          groups.set(prefix, [...(groups.get(prefix) ?? []), selector]);
        } else {
          loose.push(selector);
        }
      }

      const group = (prefix: string, members: StyleItem[]): ListItem[] => {
        const open = openGroups.has(prefix);

        return [
          { kind: 'group', key: `group:${prefix}`, prefix, count: members.length, open },
          ...(open ? rows(members) : [])
        ];
      };
      const gathered = [...groups.entries()].filter(([, members]) => members.length >= GROUP_MIN);
      const other = [...loose, ...[...groups.values()].filter(members => members.length < GROUP_MIN).flat()].sort(
        (a, b) => a.name.localeCompare(b.name)
      );

      return [
        ...gathered.sort(([a], [b]) => a.localeCompare(b)).flatMap(([prefix, members]) => group(prefix, members)),
        ...(other.length > 0 ? group(OTHER, other) : [])
      ];
    };

    if (filter !== 'all') {
      return filter === 'elements' ? rows(finalSelectors) : grouped(finalSelectors);
    }

    return [
      ...(byFilter.elements.length > 0
        ? [
            {
              kind: 'section' as const,
              key: 'section:elements',
              title: 'Element defaults',
              count: byFilter.elements.length
            },
            ...rows(byFilter.elements)
          ]
        : []),
      ...(byFilter.classes.length > 0
        ? [
            { kind: 'section' as const, key: 'section:classes', title: 'Classes', count: byFilter.classes.length },
            ...grouped(byFilter.classes)
          ]
        : [])
    ];
  }, [filter, byFilter, finalSelectors, searchInput, openGroups]);
  const heights = useMemo(() => items.map(item => HEIGHT[item.kind]), [items]);
  const windowed = useWindowedList(heights);

  const handleToggleGroup = useCallback(
    (prefix: string) => () =>
      setOpenGroups(current => {
        const next = new Set(current);
        if (!next.delete(prefix)) {
          next.add(prefix);
        }

        return next;
      }),
    []
  );

  const handleChangeSearch = useCallback((value: string) => setSearchInput(value), [setSearchInput]);
  const handleFilter = useCallback((next: ListFilter) => () => setFilter(next), []);

  const handleCloseAddSelector = useCallback(
    (_e: MouseEvent | React.MouseEvent | undefined, values?: SelectorFormValues) => {
      if (!values) {
        return;
      }

      if (values.mode === 'default') {
        const { name } = values;
        builderHandler('styleAddSelector', displayMode, name, 'class', undefined, undefined, {
          styleSelector: undefined,
          componentType: undefined
        });
      } else {
        const { componentType } = values;
        builderHandler('styleAddSelector', displayMode, componentType, 'element', undefined, undefined, {
          styleSelector: undefined,
          componentType
        });
      }
    },
    [builderHandler, displayMode]
  );

  const [idAddSelector, openAddSelector, onOpenAddSelector, onCloseAddSelector] = useDisclosure<SelectorFormValues>({
    id: 'add-selector',
    onClose: handleCloseAddSelector
  });

  const handleClickSelect = useCallback(
    (selector: string) => {
      onSelect?.(state => (state?.name === selector ? undefined : selectorsArr.find(s => s.name === selector)));
    },
    [onSelect, selectorsArr]
  );

  const handleCloseDeleteSelector = useCallback(
    (_e: MouseEvent | React.MouseEvent | undefined, value?: boolean, selectorsToDelete?: string[]) => {
      if (!value || !selectorsToDelete || selectorsToDelete.length === 0) {
        return;
      }

      const toDelete = new Set(selectorsToDelete);
      const classesDeleted = new Set(selectorsToDelete.map(classOf));
      // A class goes from every list that names it and the others stay: an element wearing `card primary` keeps `card`.
      const elementsUpdated = flatList
        .filter(element => selectorsToDelete.some(selector => wears(element, selector)))
        .map(element =>
          produce(element, draft => {
            const { styleSelectors } = draft.definition;
            for (const [styleSelector, classes] of Object.entries(styleSelectors)) {
              styleSelectors[styleSelector] = classes
                .split(' ')
                .filter(name => name && !classesDeleted.has(name))
                .join(' ');
            }
          })
        );

      if (elementsUpdated.length > 0) {
        builderHandler('schemaUpdateElements', elementsUpdated);
      }

      builderHandler('styleRemoveSelectors', displayMode, selectorsToDelete);
      setCheckedSelectors(prev => prev.filter(selector => !toDelete.has(selector)));
      onSelect?.(state => (state && toDelete.has(state.name) ? undefined : state));
    },
    [builderHandler, displayMode, flatList, onSelect]
  );

  const [idDeleteSelector, openDeleteSelector, onOpenDeleteSelector, onCloseDeleteSelector, , deleteState] =
    useDisclosure<boolean, string[]>({ id: 'delete-selector', onClose: handleCloseDeleteSelector });

  const handleClickDelete = useCallback(
    (selector: string) => onOpenDeleteSelector(undefined, [selector]),
    [onOpenDeleteSelector]
  );

  const handleToggleCheck = useCallback(
    (selector: string) =>
      setCheckedSelectors(prev => (prev.includes(selector) ? prev.filter(s => s !== selector) : [...prev, selector])),
    []
  );

  const handleClearChecked = useCallback(() => setCheckedSelectors([]), []);

  const handleCheckUnused = useCallback(
    () => setCheckedSelectors(byFilter.unused.map(selector => selector.name)),
    [byFilter.unused]
  );

  const handleDeleteChecked = useCallback(
    () => onOpenDeleteSelector(undefined, checkedSelectors),
    [onOpenDeleteSelector, checkedSelectors]
  );

  const deleteCount = Array.isArray(deleteState) ? deleteState.length : 0;

  // Per selector: the ancestors it has rules under, and the ones no element it dresses sits inside
  const ancestorHealth = useMemo<Record<string, { count: number; unused: Set<string> }>>(
    () =>
      Object.fromEntries(
        selectorsArr.map(selector => [
          selector.name,
          {
            count: new Set(Object.values(selector.attributes).flatMap(block => Object.keys(block.ancestors ?? {})))
              .size,
            unused: unusedAncestors(flat, selector)
          }
        ])
      ),
    [flat, selectorsArr]
  );

  const unusedTotal = useMemo(
    () => Object.values(ancestorHealth).reduce((total, { unused }) => total + unused.size, 0),
    [ancestorHealth]
  );

  const unusedLabel = `${unusedTotal} unused ancestor ${unusedTotal === 1 ? 'rule' : 'rules'}`;

  // Rules under an ancestor nothing sits inside never match: dropped at every breakpoint, the rest left alone
  const handleRemoveUnusedAncestors = useCallback(() => {
    for (const [name, { unused }] of Object.entries(ancestorHealth)) {
      for (const removal of ancestorRemovals(platform, name, unused)) {
        builderHandler('styleUpdateSelector', removal.displayMode, name, undefined, undefined, {
          styleSelector: removal.styleSelector,
          styleAncestor: removal.styleAncestor,
          componentType: platform[removal.displayMode][name].componentType
        });
      }
    }
  }, [ancestorHealth, builderHandler, platform]);

  const handleCloseModal = useCallback(() => void onCloseDeleteSelector(undefined, false), [onCloseDeleteSelector]);

  const handleSubmitModal = useCallback(() => void onCloseDeleteSelector(undefined, true), [onCloseDeleteSelector]);

  return (
    <div className="flex w-[300px] shrink-0 flex-col gap-2 overflow-hidden border-r border-gray-300 bg-gray-50/70 px-2 pt-2 dark:border-zinc-700 dark:bg-zinc-950/40">
      <div className="flex items-center gap-1.5">
        <div className="grow">
          <Input
            placeholder="Search selectors"
            aria-label="Search selectors"
            value={searchInput}
            onChange={handleChangeSearch}
            size="xs"
            clearable
          >
            <Input.Icon icon="fa-solid fa-magnifying-glass" />
          </Input>
        </div>
        <Button intent="primary" size="xs" iconPlacement="before" title="New selector" onClick={onOpenAddSelector}>
          <Button.Icon icon="fa-solid fa-plus" />
          New
        </Button>
      </div>
      <div className="flex gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-zinc-800/70" role="tablist">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={clsx(
              'flex grow cursor-pointer items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium',
              {
                'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50': filter === id,
                'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100': filter !== id
              }
            )}
            onClick={handleFilter(id)}
          >
            {label}
            <span
              className={clsx('tabular-nums', {
                'text-amber-600 dark:text-amber-400': id === 'unused' && byFilter.unused.length > 0,
                'opacity-60': !(id === 'unused' && byFilter.unused.length > 0)
              })}
            >
              {byFilter[id].length}
            </span>
          </button>
        ))}
      </div>
      {unusedTotal > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
          <span className="text-xs text-amber-800 dark:text-amber-200">
            <i className="fas fa-sitemap mr-1.5 text-[10px]" />
            {unusedLabel}
          </span>
          <Button size="xs" onClick={handleRemoveUnusedAncestors}>
            Clean up
          </Button>
        </div>
      )}
      {filter === 'unused' && byFilter.unused.length > 0 && checkedSelectors.length === 0 && (
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>No element wears these classes.</span>
          <Button size="xs" onClick={handleCheckUnused}>
            Select all
          </Button>
        </div>
      )}
      {checkedSelectors.length > 0 && (
        <div className="bg-secondary-50 dark:bg-secondary-900/30 flex items-center justify-between gap-2 rounded-md px-2 py-1">
          <span className="text-xs text-zinc-600 dark:text-zinc-300">{checkedSelectors.length} selected</span>
          <div className="flex gap-1">
            <Button size="xs" onClick={handleClearChecked}>
              Clear
            </Button>
            <Button intent="danger" size="xs" iconPlacement="before" onClick={handleDeleteChecked}>
              <Button.Icon icon="fas fa-trash" />
              Delete
            </Button>
          </div>
        </div>
      )}
      <div
        ref={windowed.ref}
        className="-mx-1 flex grow basis-0 flex-col overflow-y-auto px-1 pb-2"
        onScroll={windowed.onScroll}
      >
        <div style={{ height: windowed.before }} className="shrink-0" />
        {items.slice(windowed.start, windowed.end).map(item => {
          if (item.kind === 'section') {
            return (
              <h6
                key={item.key}
                className="flex h-7 shrink-0 items-center justify-between px-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400"
              >
                {item.title}
                <span className="font-normal tabular-nums">{item.count}</span>
              </h6>
            );
          }

          if (item.kind === 'group') {
            return (
              <button
                key={item.key}
                type="button"
                aria-expanded={item.open}
                className="flex h-7 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-1.5 text-left text-xs text-zinc-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={handleToggleGroup(item.prefix)}
              >
                <i
                  className={clsx(
                    'fa-solid w-4 text-center text-[9px] text-zinc-400 dark:text-zinc-500',
                    item.open ? 'fa-chevron-down' : 'fa-chevron-right'
                  )}
                />
                <span className={clsx('grow truncate', { 'font-mono': item.prefix !== OTHER })}>
                  {item.prefix === OTHER ? OTHER : `${item.prefix}…`}
                </span>
                <span className="text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">{item.count}</span>
              </button>
            );
          }

          const { name, type } = item.selector;

          return (
            <StyleSelectorTag
              key={item.key}
              id={name}
              active={name === selected}
              checked={checkedSelectors.includes(name)}
              selecting={checkedSelectors.length > 0}
              label={name}
              type={type}
              elementsCount={elementCounts[name]}
              ancestorsCount={ancestorHealth[name].count}
              unusedAncestorsCount={ancestorHealth[name].unused.size}
              onSelect={handleClickSelect}
              onDelete={handleClickDelete}
              onToggleCheck={handleToggleCheck}
            />
          );
        })}
        <div style={{ height: windowed.after }} className="shrink-0" />
        {finalSelectors.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {searchInput
              ? 'No selector matches the search.'
              : filter === 'unused'
                ? 'Every class is worn by an element.'
                : 'No selectors yet: make one with New.'}
          </p>
        )}
      </div>
      <Modal id={idAddSelector} open={openAddSelector} onClose={onCloseAddSelector} size="sm">
        <Modal.Header>
          <h4>Add Selector</h4>
        </Modal.Header>
        <Modal.Body>
          <SelectorForm
            componentsNotAvailables={componentsNotAvailables}
            components={components.current}
            onSubmit={onCloseAddSelector}
            onClose={onCloseAddSelector}
          />
        </Modal.Body>
      </Modal>
      <Modal id={idDeleteSelector} open={openDeleteSelector} onClose={onCloseDeleteSelector}>
        <Modal.Header>
          <h4>Remove Selector</h4>
        </Modal.Header>
        <Modal.Body>
          {deleteCount > 1 && <h4>Do you want to remove these {deleteCount} items ?</h4>}
          {deleteCount <= 1 && <h4>Do you want to remove this item ?</h4>}
        </Modal.Body>
        <Modal.Footer justify="end">
          <Button onClick={handleCloseModal} size="sm">
            Cancel
          </Button>
          <Button onClick={handleSubmitModal} size="sm">
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default memo(ManagerSelector);
