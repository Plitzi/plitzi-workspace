// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import debounce from 'lodash/debounce';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Button from '@plitzi/plitzi-ui-components/Button';
/**
 * @param {{
 *   name?: string;
 *   category?: string;
 *   value?: string;
 *   type?: string;
 *   onChange?: (name: string, value: string) => void;
 *   onRemove: (name: string) => void;
 *   onParentRefresh?: (identifier: string, segment: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Variable = props => {
  const { name = 'variable', value = '', type = 'text', onChange = noop, onRemove = noop } = props;
  const [editMode, setEditMode] = useState(true);
  const [valueInternal, setValueInternal] = useState(value);

  useEffect(() => {
    setValueInternal(value);
  }, [value]);

  const handleClickRemove = useCallback(() => {
    onRemove(name);
  }, [onRemove, name]);

  const handleMouseEnter = useCallback(() => setEditMode(true), []);

  const handleMouseLeave = useCallback(() => setEditMode(false), []);

  const debounceChange = useMemo(() => debounce(onChange, 250), [onChange]);

  const handleChange = useCallback(
    e => {
      setValueInternal(e.target.value);
      debounceChange(name, e.target.value);
    },
    [onChange, name, value]
  );

  return (
    <div className="flex items-center gap-2 " onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="flex gap-1 grow items-center">
        <div className="w-[100px] truncate text-sm" title={name}>
          {name}
        </div>
        <FormControl
          type={type}
          size="sm"
          value={valueInternal}
          className="grow basis-0"
          onChange={handleChange}
          inputClassName={classNames('rounded', { 'border-transparent': !editMode })}
        />
      </div>
      <div className={classNames('flex', { invisible: !editMode, visible: editMode })}>
        <Button
          intent="custom"
          size="custom"
          onClick={handleClickRemove}
          title="Remove"
          className="text-red-400 hover:text-red-500 px-1 py-2"
        >
          <i className="fas fa-trash-alt" />
        </Button>
      </div>
    </div>
  );
};

export default Variable;
