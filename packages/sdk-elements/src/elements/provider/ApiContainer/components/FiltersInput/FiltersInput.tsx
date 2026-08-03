import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

export type ConnectorFilterValue = { field: string; operator: string; value: string };

export type FiltersInputProps = {
  value: ConnectorFilterValue[];
  /** Operator names the selected connector declares. An empty list means no connector is selected yet. */
  operators: string[];
  onChange: (filters: ConnectorFilterValue[]) => void;
};

const emptyFilter: ConnectorFilterValue = { field: '', operator: '', value: '' };

/**
 * Field / operator / value rows applied to the connector query.
 *
 * Deliberately not the `QueryBuilder` used for `when`: that produces nested groups and OR, and a connector manifest
 * executes a flat AND list of query parameters. Offering the richer editor would let an author build a query the
 * provider silently cannot run. These rows express exactly what the manifest can express.
 *
 * Values are templates resolved on the server, so `{{routeParams.slug}}` is what makes a page a detail page.
 */
const FiltersInput = ({ value, operators, onChange }: FiltersInputProps) => {
  const handleChangeRow = useCallback(
    (index: number, key: keyof ConnectorFilterValue) => (next: string) =>
      onChange(value.map((filter, i) => (i === index ? { ...filter, [key]: next } : filter))),
    [value, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => () => onChange(value.filter((_filter, i) => i !== index)),
    [value, onChange]
  );

  const handleAdd = useCallback(
    () => onChange([...value, { ...emptyFilter, operator: operators[0] ?? '' }]),
    [value, operators, onChange]
  );

  return (
    <div className="flex flex-col gap-2">
      <label>Filters</label>
      {value.map((filter, index) => (
        <div className="flex items-end gap-1" key={index}>
          <Input
            className="grow"
            value={filter.field}
            placeholder="field"
            onChange={handleChangeRow(index, 'field')}
            size="xs"
          />
          <Select value={filter.operator} onChange={handleChangeRow(index, 'operator')} size="xs">
            {operators.map(operator => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </Select>
          <Input
            className="grow"
            value={filter.value}
            placeholder="{{routeParams.slug}}"
            onChange={handleChangeRow(index, 'value')}
            size="xs"
          />
          <Button size="xs" onClick={handleRemove(index)} title="Remove filter">
            <Button.Icon icon="fa-solid fa-trash" />
          </Button>
        </div>
      ))}
      <Button size="xs" onClick={handleAdd} disabled={operators.length === 0}>
        Add Filter
      </Button>
      {operators.length === 0 && (
        <span className="text-xs text-gray-500">Select a connector to see the operators it supports.</span>
      )}
    </div>
  );
};

export default FiltersInput;
