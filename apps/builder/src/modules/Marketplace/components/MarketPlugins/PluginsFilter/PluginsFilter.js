// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';

// Relatives
import FilterCategory from './FilterCategory';

/**
 * @param {{
 *   filter: object;
 *   onChange?: (value: string, key: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PluginsFilter = props => {
  const { filter, onChange = noop } = props;

  const handleChangeFilter = useCallback(e => onChange(e.target.value), [onChange]);

  const handleClick = useCallback(value => onChange(value, 'owner'), [onChange]);

  const icon = useMemo(
    () => <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-2 translate-y-[-50%]" />,
    []
  );

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex grow border border-gray-300 mr-10 rounded overflow-hidden">
        <FilterCategory active={filter.owner.contains === ''} id="" name="All Plugins" onClick={handleClick} />
        <FilterCategory active={filter.owner.contains === 'plitzi'} id="plitzi" name="Official" onClick={handleClick} />
      </div>
      <Input
        className="w-[200px]"
        placeholder="Search"
        onChange={handleChangeFilter}
        inputClassName="rounded pl-8"
        value={filter.name.contains}
        icon={icon}
      />
    </div>
  );
};

export default PluginsFilter;
