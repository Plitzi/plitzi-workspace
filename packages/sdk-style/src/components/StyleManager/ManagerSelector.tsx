import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import { produce } from 'immer';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import set from 'lodash/set';
import { useCallback, use, useMemo, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';

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
  const { showModal } = useModal();
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

  const handleClickAddSelector = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Selector</h4>
      </Modal.Header>,
      <Modal.Body>
        <SelectorForm />
      </Modal.Body>,
      undefined,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name }
      } = response;

      builderHandler('styleAddSelector', displayMode, name, 'class');
    }
  }, [builderHandler, displayMode, showModal]);

  const handleClickSelect = useCallback(
    (selector: string) => {
      if (selected === selector) {
        onSelect?.(undefined);
      } else {
        onSelect?.(selector);
      }
    },
    [selected, onSelect]
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

  const handleClickDelete = useCallback(
    async (selector: string) => {
      const elementsAffected = flatList.filter(element => elementHasSelector(element, selector));
      if (elementsAffected.length > 0) {
        const response = await showModal(
          <Modal.Header>
            <h4>Remove Selector</h4>
          </Modal.Header>,
          <Modal.Body>
            <h4 className="px-3 py-2">Do you want to remove this item ?</h4>
          </Modal.Body>,
          undefined,
          { placement: 'center', renderFooter: true }
        );

        if (!response.result) {
          return;
        }
      }

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
    [flatList, builderHandler, onSelect, elementHasSelector, showModal]
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

  return (
    <div className="flex flex-col border-r border-gray-300 grow basis-0 overflow-auto max-w-[350px]">
      <Button
        intent="custom"
        size="custom"
        onClick={void handleClickAddSelector}
        className="px-4 py-3 bg-gray-600 text-white sticky top-0 z-10"
      >
        <i className="fas fa-tint fa-2x mr-4" />
        Add Selector
      </Button>
      <div className="m-2">
        <Input placeholder="Search Selector" value={searchInput} onChange={handleChangeSearch} />
      </div>
      <div className="flex flex-col grow basis-0 overflow-y-auto">
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
              onDelete={void handleClickDelete}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ManagerSelector;
