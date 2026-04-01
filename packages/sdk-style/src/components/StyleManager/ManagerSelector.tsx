import Button from '@plitzi/plitzi-ui/Button';
import { get, set, isEmpty } from '@plitzi/plitzi-ui/helpers/lodash';
import useDisclosure from '@plitzi/plitzi-ui/hooks/useDisclosure';
import Input from '@plitzi/plitzi-ui/Input';
import Modal from '@plitzi/plitzi-ui/Modal';
import { produce } from 'immer';
import { useCallback, use, useMemo, useState, memo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import StyleSelectorTag from './StyleSelectorTag';
import SelectorForm from '../../models/SelectorForm';

import type { SelectorFormValues } from '../../models/SelectorForm';
import type { DisplayMode, Element, StyleItem } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type ManagerSelectorProps = {
  displayMode: DisplayMode;
  flatList: Element[];
  selected?: string;
  onSelect?: Dispatch<SetStateAction<StyleItem | undefined>>;
  selectors: StyleItem[];
};

const ManagerSelector = ({ displayMode, flatList, selectors, selected, onSelect }: ManagerSelectorProps) => {
  const [searchInput, setSearchInput] = useState('');
  const { builderHandler } = use(BuilderContext);
  const { components } = use(ComponentContext);
  const componentsNotAvailables = useMemo(
    () => selectors.filter(selector => !!selector.componentType).map(selector => selector.componentType as string),
    [selectors]
  );
  const finalSelectors = useMemo(() => {
    let selectorsParsed = selectors;
    if (!isEmpty(searchInput)) {
      selectorsParsed = selectors.filter(selector => selector.name.toLowerCase().includes(searchInput.toLowerCase()));
    }

    return selectorsParsed.sort((a, b) => Number(b.type === 'element') - Number(a.type === 'element'));
  }, [selectors, searchInput]);

  const handleChangeSearch = useCallback((value: string) => setSearchInput(value), [setSearchInput]);

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
      onSelect?.(state => (state?.name === selector ? undefined : selectors.find(s => s.name === selector)));
    },
    [onSelect, selectors]
  );

  const elementHasSelector = useCallback((element: Element, selector: string) => {
    if (!selector) {
      return [];
    }

    return Object.values(get(element, 'definition.styleSelectors', {})).find(styleSelector => {
      if (selector.includes(':')) {
        selector = get(selector.split(':'), '0', selector);
      }

      return styleSelector && selector && styleSelector.split(' ').includes(selector);
    });
  }, []);

  const handleCloseDeleteSelector = useCallback(
    (_e: MouseEvent | React.MouseEvent | undefined, value?: boolean, selector?: string) => {
      if (!value || !selector) {
        return;
      }

      const elementsAffected = flatList.filter(element => elementHasSelector(element, selector));
      elementsAffected.forEach(element => {
        builderHandler(
          'schemaUpdateElement',
          produce(element, draft => {
            Object.keys(element.definition.styleSelectors).forEach(styleSelector => {
              if (get(draft, `definition.styleSelectors.${styleSelector}`, '') === selector) {
                set(draft, `definition.styleSelectors.${styleSelector}`, '');
              }
            });
          })
        );
      });
      builderHandler('styleRemoveSelector', displayMode, selector);
      onSelect?.(undefined);
    },
    [builderHandler, displayMode, elementHasSelector, flatList, onSelect]
  );

  const [idDeleteSelector, openDeleteSelector, onOpenDeleteSelector, onCloseDeleteSelector] = useDisclosure<
    boolean,
    string
  >({ id: 'delete-selector', onClose: handleCloseDeleteSelector });

  const handleClickDelete = useCallback(
    (selector: string) => onOpenDeleteSelector(undefined, selector),
    [onOpenDeleteSelector]
  );

  const elementCounts = useMemo<Record<string, number>>(
    () =>
      finalSelectors.reduce(
        (acum, selector) => ({
          ...acum,
          [selector.name]: flatList.filter(element => elementHasSelector(element, selector.name)).length
        }),
        {}
      ),
    [finalSelectors, flatList, elementHasSelector]
  );

  const handleCloseModal = useCallback(() => void onCloseDeleteSelector(undefined, false), [onCloseDeleteSelector]);

  const handleSubmitModal = useCallback(() => void onCloseDeleteSelector(undefined, true), [onCloseDeleteSelector]);

  return (
    <div className="flex max-w-[350px] grow basis-0 flex-col gap-2 overflow-auto border-r border-gray-300 pt-2 pr-2">
      <Button intent="primary" size="sm" className="w-full" iconPlacement="before" onClick={onOpenAddSelector}>
        <Button.Icon icon="fas fa-tint" size="md" className="text-base" />
        New Selector
      </Button>
      <Input placeholder="Search Selector" value={searchInput} onChange={handleChangeSearch} size="xs" />
      <div className="flex grow basis-0 flex-col overflow-y-auto">
        {finalSelectors.map(selector => {
          const { name, type } = selector;

          return (
            <StyleSelectorTag
              key={name}
              id={name}
              active={name === selected}
              label={name}
              type={type}
              elementsCount={elementCounts[name]}
              onSelect={handleClickSelect}
              onDelete={handleClickDelete}
            />
          );
        })}
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
          <h4>Do you want to remove this item ?</h4>
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
