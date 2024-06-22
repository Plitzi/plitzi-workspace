// Packages
import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import omit from 'lodash/omit';
import Button from '@plitzi/plitzi-ui-components/Button';
import QueryBuilderFormatter from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderFormatter';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import VariableForm from './models/VariableForm';

const subValuesDefault = [];

/**
 * @param {{
 *   name?: string;
 *   category?: string;
 *   value?: string;
 *   type?: string;
 *   subValues?: [{ value: string; when: object }];
 *   whenData?: object;
 *   onChange?: (name: string, value: string) => void;
 *   onRemove: (name: string) => void;
 *   onParentRefresh?: (identifier: string, segment: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Variable = props => {
  const {
    name = 'variable',
    value = '',
    type = 'text',
    category = '',
    subValues = subValuesDefault,
    whenData = emptyObject,
    onChange = noop,
    onRemove = noop
  } = props;
  const [editMode, setEditMode] = useState(false);
  const hasSubValues = subValues && subValues?.length > 0;
  const whenString = useMemo(() => {
    if (!subValues || subValues.length === 0) {
      return 'None';
    }

    const strs = subValues.map(subValue => QueryBuilderFormatter(subValue.when));
    if (strs && strs.length > 0) {
      return strs.join(', ');
    }

    return 'None';
  }, [hasSubValues]);

  const handleClickRemove = useCallback(() => {
    onRemove(name);
  }, [onRemove, name]);

  const handleClickUpdate = useCallback(() => {
    setEditMode(true);
  }, [onChange, name]);

  const handleClickSubmit = useCallback(
    values => {
      onChange(name, omit(values, ['name']));
      setEditMode(false);
    },
    [onChange, name, setEditMode]
  );

  const handleClickCancel = useCallback(() => setEditMode(false), [setEditMode]);

  if (editMode) {
    return (
      <div className="border border-gray-300 rounded p-2">
        <VariableForm
          name={name}
          category={category}
          type={type}
          value={value}
          subValues={subValues}
          whenData={whenData}
          onSubmit={handleClickSubmit}
          onClose={handleClickCancel}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 border px-1 border-gray-300 rounded">
      <i
        className={classNames('fa-solid fa-circle-info text-xs', { visible: hasSubValues, invisible: !hasSubValues })}
        title={`Condition: ${whenString}`}
      />
      <div className="flex gap-1 grow py-1">
        <div className="flex grow basis-0 min-w-0 items-center text-sm bold" title={name}>
          <div className="truncate font-bold">{name}</div>
        </div>
        <div className="flex grow basis-0 min-w-0 text-sm gap-1" title={value}>
          <div className="truncate">{value}</div>
        </div>
      </div>
      <div className="flex group-hover:visible invisible">
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickUpdate}
          title="Update"
          className="px-1 py-1 hover:text-blue-400 text-xs"
        >
          <i className="fas fa-pen" />
        </Button>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickRemove}
          title="Remove"
          className="text-red-400 hover:text-red-500 px-1 py-1 text-xs"
        >
          <i className="fas fa-trash-alt" />
        </Button>
      </div>
    </div>
  );
};

export default Variable;
