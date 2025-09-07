import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo, useState } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NetworkContext from '@pmodules/Network/NetworkContext';

import VariableForm from './models/VariableForm';
import Variable from './Variable';

import type { SchemaVariable } from '@plitzi/sdk-shared';

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

  const handleChangeFilter = useCallback((value: string) => setFilter(value), [setFilter]);

  const handleClickAddVariable = useCallback(async () => {
    const response = await showModal<SchemaVariable>(
      <Modal.Header>
        <h4>Add Variable</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body className="max-h-[500px] overflow-y-auto">
          <VariableForm onSubmit={onSubmit} onClose={onClose} whenData={whenData} isNewRecord />
        </Modal.Body>
      )
    );

    if (response) {
      const { name, category, value, type, subValues } = response;
      if (!variables?.find(variable => variable.name === name)) {
        void schemaAddVariable?.({ name, category, value, type, subValues });
      } else {
        addToast(
          <span>
            Variable with the name <b>{name}</b> already exists
          </span>,
          { appeareance: 'warning', autoDismiss: true, placement: 'top-right' }
        );
      }
    }
  }, [showModal, whenData, variables, schemaAddVariable, addToast]);

  const handleClickRemove = useCallback((name: string) => schemaRemoveVariable?.(name), [schemaRemoveVariable]);

  const handleChange = useCallback(
    (name: string, values: Omit<SchemaVariable, 'name'>) => schemaUpdateVariable?.({ ...values, name }),
    [schemaUpdateVariable]
  );

  const variablesFiltered = useMemo(
    () => Object.values(variables ?? []).filter(variable => variable.name.toLowerCase().includes(filter.toLowerCase())),
    [variables, filter]
  );

  return (
    <div className="segments flex w-full flex-col gap-3">
      <Flex gap={2} direction="column">
        <Button size="sm" onClick={handleClickAddVariable} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          New Variable
        </Button>
        <Input placeholder="Search Variables" value={filter} onChange={handleChangeFilter} label="">
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </Flex>
      <div className="h-px bg-gray-200" />
      <div className="flex flex-col gap-1">
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
