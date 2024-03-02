// Packages
import React, { useCallback, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import set from 'lodash/set';
import noop from 'lodash/noop';
import { produce } from 'immer';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import Button from '@plitzi/plitzi-ui-components/Button';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import Input from '@plitzi/plitzi-ui-components/Input';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Alias
import BuilderContext from '@pmodules/Builder/BuilderContext';
import AppContext from '@pmodules/App/AppContext';

// Relatives
import SelectorForm from '../Models/SelectorForm';
import StyleSelectorTag from './StyleSelectorTag';
import { StyleSelectors } from '../StyleHelper';

const flatListDefault = [];
const selectorsDefault = [];

const ManagerSelector = props => {
  const { flatList = flatListDefault, selected, onSelect = noop } = props;
  let { selectors = selectorsDefault } = props;
  const { showModal } = useModal();
  const [searchInput, setSearchInput] = useState('');
  const { displayMode } = useContext(AppContext);
  const { builderHandler } = useContext(BuilderContext);
  const finalSelectors = useMemo(() => {
    if (selectors && !isEmpty(searchInput)) {
      selectors = selectors.filter(selector => selector.name?.toLowerCase().includes(searchInput.toLowerCase()));
    }

    return selectors;
  }, [selectors, searchInput]);

  const handleChangeSearch = useCallback(e => setSearchInput(e.target.value), [setSearchInput]);

  const handleClickAddSelector = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Selector</h4>
      </Modal.Header>,
      <Modal.Body>
        <SelectorForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name }
      } = response;

      builderHandler(EventBridgeTypes.STYLE_ADD_SELECTOR, displayMode, name, StyleSelectors.SELECTOR_CLASS);
    }
  }, [builderHandler]);

  const handleClickSelect = useCallback(
    selector => {
      if (selected === selector) {
        onSelect(null);
      } else {
        onSelect(selector);
      }
    },
    [selected, onSelect]
  );

  const elementHasSelector = useCallback((element, selector) => {
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
    async selector => {
      const elementsAffected = flatList.filter(element => elementHasSelector(element, selector));
      if (elementsAffected.length > 0) {
        const response = await showModal(
          <Modal.Header>
            <h4>Remove Selector</h4>
          </Modal.Header>,
          <Modal.Body>
            <h4 className="px-3 py-2">Do you want to remove this item ?</h4>
          </Modal.Body>,
          null,
          { placement: 'center', renderFooter: true }
        );

        if (!response.result) {
          return;
        }
      }

      elementsAffected.forEach(element => {
        builderHandler(
          EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
          produce(element, draft => {
            Object.keys(element.definition.styleSelectors).forEach(styleSelector => {
              if (get(draft, `definition.styleSelectors.${styleSelector}`, '') === selector) {
                set(draft, `definition.styleSelectors.${styleSelector}`, '');
              }
            });
          })
        );
      });

      builderHandler(EventBridgeTypes.STYLE_REMOVE_SELECTOR, selector);
      onSelect(undefined);
    },
    [flatList, onSelect, builderHandler]
  );

  const elementCounts = useMemo(
    () =>
      finalSelectors.reduce(
        (acum, selector) => ({
          ...acum,
          [selector.name]: flatList.filter(element => elementHasSelector(element, selector.name)).length
        }),
        {}
      ),
    [flatList, finalSelectors]
  );

  return (
    <div className="flex flex-col border-r border-gray-300 grow basis-0 overflow-auto max-w-[350px]">
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickAddSelector}
        className="px-4 py-3 bg-gray-600 text-white sticky top-0 z-10"
      >
        <i className="fas fa-tint fa-2x mr-4" />
        Add Selector
      </Button>
      <div className="m-2">
        <Input
          placeholder="Search Selector"
          value={searchInput}
          onChange={handleChangeSearch}
          className="mr-1"
          inputClassName="rounded"
        />
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
              onDelete={handleClickDelete}
            />
          );
        })}
      </div>
    </div>
  );
};

ManagerSelector.propTypes = {
  selectors: PropTypes.array,
  flatList: PropTypes.array,
  selected: PropTypes.string,
  onSelect: PropTypes.func
};

export default ManagerSelector;
