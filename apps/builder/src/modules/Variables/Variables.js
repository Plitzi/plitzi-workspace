// Packages
import React, { useCallback, useContext, useMemo, useState } from 'react';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';
import Heading from '@plitzi/plitzi-ui-components/Heading';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Relatives
import VariableForm from './models/VariableForm';
import Variable from './Variable';

/** @returns {React.ReactElement} */
const Variables = () => {
  const { showModal } = useModal();
  const {
    schemaAddVariable,
    schemaUpdateVariable,
    schemaRemoveVariable,
    schema: { variables }
  } = useContext(SchemaContext);
  const [filter, setFilter] = useState('');

  const handleChangeFilter = useCallback(e => setFilter(e.target.value), [setFilter]);

  const handleClickAddVariable = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Variable</h4>
      </Modal.Header>,
      <Modal.Body>
        <VariableForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name = 'variable', category = '', value = '', type = 'text' }
      } = response;
      schemaAddVariable({ name, category, value, type });
    }
  }, [showModal, schemaAddVariable]);

  const handleClickRemove = useCallback(name => schemaRemoveVariable(name), [schemaRemoveVariable]);

  const handleChange = useCallback(
    (name, value) => {
      schemaUpdateVariable({ name, value });
    },
    [schemaUpdateVariable]
  );

  const variablesFiltered = useMemo(
    () =>
      Object.values(variables).filter(variable => {
        return variable.name.toLowerCase().includes(filter.toLowerCase());
      }),
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
      <div className="px-4 my-2">
        <FormControl
          value={filter}
          type="text"
          placeholder="Search Variables"
          inputClassName="rounded"
          onChange={handleChangeFilter}
        />
      </div>
      <div className="flex flex-col px-4 my-2 gap-3">
        <div className="flex gap-2 mr-[30px]">
          <Heading type="h5" className="w-[100px]">
            Name
          </Heading>
          <Heading type="h5" className="grow px-2">
            Value
          </Heading>
        </div>
        {variablesFiltered.map((segment, key) => {
          const { name, category, type, value } = segment;

          return (
            <Variable
              key={key}
              name={name}
              category={category}
              type={type}
              value={value}
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
