import Button from '@plitzi/plitzi-ui/Button';
import useDisclosure from '@plitzi/plitzi-ui/hooks/useDisclosure';
import Input from '@plitzi/plitzi-ui/Input';
import Modal from '@plitzi/plitzi-ui/Modal';
import { produce } from 'immer';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import set from 'lodash/set';
import { useCallback, use, useMemo, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

import StyleSelectorTag from './StyleSelectorTag';
import SelectorForm from '../SelectorForm';

import type { Element, StyleItem } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type ManagerSelectorProps = {
  flatList: Element[];
  selected?: string;
  onSelect?: Dispatch<SetStateAction<string | undefined>>;
  selectors: StyleItem[];
};

const ManagerSelector = ({ flatList, selectors, selected, onSelect }: ManagerSelectorProps) => {
  const [searchInput, setSearchInput] = useState('');
  const { builderHandler } = use(BuilderContext);
  const { displayMode } = use(BuilderStyleContext);
  const finalSelectors = useMemo(() => {
    if (!isEmpty(searchInput)) {
      return selectors.filter(selector => selector.name.toLowerCase().includes(searchInput.toLowerCase()));
    }

    return selectors;
  }, [selectors, searchInput]);

  const handleChangeSearch = useCallback((value: string) => setSearchInput(value), [setSearchInput]);

  const handleCloseAddSelector = useCallback(
    (values?: { name: string }) => {
      if (values) {
        const { name } = values;
        builderHandler('styleAddSelector', displayMode, name, 'class');
      }
    },
    [builderHandler, displayMode]
  );

  const [idAddSelector, openAddSelector, onOpenAddSelector, onCloseAddSelector] = useDisclosure<{ name: string }>({
    id: 'add-selector',
    onClose: handleCloseAddSelector
  });

  const handleClickSelect = useCallback(
    (selector: string) => {
      onSelect?.(state => (state === selector ? undefined : selector));
    },
    [onSelect]
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
    (value?: boolean, selector?: string) => {
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
      builderHandler('styleRemoveSelector', selector);
      onSelect?.(undefined);
    },
    [builderHandler, elementHasSelector, flatList, onSelect]
  );

  const [idDeleteSelector, openDeleteSelector, onOpenDeleteSelector, onCloseDeleteSelector] = useDisclosure<
    boolean,
    string
  >({ id: 'delete-selector', onClose: handleCloseDeleteSelector });

  const handleClickDelete = useCallback((selector: string) => onOpenDeleteSelector(selector), [onOpenDeleteSelector]);

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

  const handleCloseModal = useCallback(() => void onCloseDeleteSelector(false), [onCloseDeleteSelector]);

  const handleSubmitModal = useCallback(() => void onCloseDeleteSelector(true), [onCloseDeleteSelector]);

  return (
    <div className="flex max-w-[350px] grow basis-0 flex-col gap-2 overflow-auto border-r border-gray-300 pt-2 pr-2">
      <Button intent="primary" size="sm" className="w-full" iconPlacement="before" onClick={onOpenAddSelector}>
        <Button.Icon icon="fas fa-tint" size="md" className="text-base" />
        New Selector
      </Button>
      <Input placeholder="Search Selector" value={searchInput} onChange={handleChangeSearch} />
      <div className="flex grow basis-0 flex-col overflow-y-auto">
        {finalSelectors.map(selector => {
          const { name, type } = selector;

          return (
            <StyleSelectorTag
              key={name}
              id={name}
              onSelect={handleClickSelect}
              active={name === selected}
              label={name}
              type={type}
              elementsCount={elementCounts[name]}
              onDelete={handleClickDelete}
            />
          );
        })}
      </div>
      <Modal id={idAddSelector} open={openAddSelector} onClose={onCloseAddSelector}>
        <Modal.Header>
          <h4>Add Selector</h4>
        </Modal.Header>
        <Modal.Body>
          <SelectorForm onSubmit={onCloseAddSelector} onClose={onCloseAddSelector} />
        </Modal.Body>
      </Modal>
      <Modal id={idDeleteSelector} open={openDeleteSelector} onClose={onCloseDeleteSelector}>
        <Modal.Header>
          <h4>Remove Selector</h4>
        </Modal.Header>
        <Modal.Body>
          <h4 className="px-3 py-2">Do you want to remove this item ?</h4>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button onClick={handleSubmitModal}>Submit</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ManagerSelector;
