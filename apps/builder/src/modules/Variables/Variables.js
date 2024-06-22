// Packages
import React, { useCallback, use, useMemo, useState } from 'react';
import get from 'lodash/get';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import VariableForm from './models/VariableForm';
import Variable from './Variable';

/** @returns {React.ReactElement} */
const Variables = () => {
  const { showModal } = useModal();
  const { addToast } = useToast();
  const {
    schemaAddVariable,
    schemaUpdateVariable,
    schemaRemoveVariable,
    schema: { variables }
  } = use(SchemaContext);
  const { environment } = use(NetworkContext);
  const { routeParams, queryParams, hostname } = use(NavigationContext);
  const [filter, setFilter] = useState('');
  const whenData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );

  const handleChangeFilter = useCallback(e => setFilter(e.target.value), [setFilter]);

  const handleClickAddVariable = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Variable</h4>
      </Modal.Header>,
      <Modal.Body className="max-h-[500px] overflow-y-auto">
        <VariableForm className="p-3" whenData={whenData} isNewRecord />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const { name, category, value, type, subValues } = get(response, 'data', {});
      if (!variables.find(variable => variable.name === name)) {
        schemaAddVariable({ name, category, value, type, subValues });
      } else {
        addToast(
          <span>
            Variable with the name <b>{name}</b> already exists
          </span>,
          { appeareance: 'warning', autoDismiss: true, placement: 'top-right' }
        );
      }
    }
  }, [showModal, schemaAddVariable, variables, routeParams, queryParams, hostname, addToast]);

  const handleClickRemove = useCallback(name => schemaRemoveVariable(name), [schemaRemoveVariable]);

  const handleChange = useCallback((name, values) => schemaUpdateVariable({ name, ...values }), [schemaUpdateVariable]);

  const variablesFiltered = useMemo(
    () => Object.values(variables).filter(variable => variable.name.toLowerCase().includes(filter.toLowerCase())),
    [variables, filter]
  );

  return (
    <div className="segments flex flex-col">
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickAddVariable}
        className="rounded-none px-4 py-3 bg-gray-600 text-white"
      >
        <i className="fa-solid fa-swatchbook fa-2x mr-4 text-white" />
        Add Variable
      </Button>
      <div className="p-2">
        <FormControl
          value={filter}
          type="text"
          placeholder="Search Variables"
          inputClassName="rounded"
          onChange={handleChangeFilter}
        />
      </div>
      <div className="flex flex-col px-2 my-2 gap-2">
        {variablesFiltered.map(segment => {
          const { name, type, value, category, subValues } = segment;

          return (
            <Variable
              key={name}
              name={name}
              category={category}
              type={type}
              value={value}
              subValues={subValues}
              whenData={whenData}
              onChange={handleChange}
              onRemove={handleClickRemove}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Variables;
