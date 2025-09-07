import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useMemo } from 'react';

// Relatives
import FilterCategory from './FilterCategory';

export type PluginsFilterProps = {
  filter: {
    name: {
      contains: string;
    };
    owner: {
      contains: string;
    };
  };
  onChange?: (value: string, key?: string) => void;
};

const PluginsFilter = ({ filter, onChange }: PluginsFilterProps) => {
  const handleChangeFilter = useCallback((value: string) => onChange?.(value), [onChange]);

  const handleClick = useCallback((value: string) => onChange?.(value, 'owner'), [onChange]);

  const icon = useMemo(
    () => <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-2 translate-y-[-50%]" />,
    []
  );

  return (
    <div className="flex w-full items-center justify-between">
      <div className="mr-10 flex grow overflow-hidden rounded-sm border border-gray-300">
        <FilterCategory active={filter.owner.contains === ''} id="" name="All Plugins" onClick={handleClick} />
        <FilterCategory active={filter.owner.contains === 'plitzi'} id="plitzi" name="Official" onClick={handleClick} />
      </div>
      <Input className="w-[200px]" placeholder="Search" onChange={handleChangeFilter} value={filter.name.contains}>
        <Input.Icon>{icon}</Input.Icon>
      </Input>
    </div>
  );
};

export default PluginsFilter;
