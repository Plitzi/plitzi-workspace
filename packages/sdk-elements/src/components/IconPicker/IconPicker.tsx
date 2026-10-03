import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';

type FontIcon = {
  styles: string[];
  label: string;
};

/** The Font Awesome prefix each of its styles is written with. */
const PREFIXES: Record<string, string> = { brands: 'fab', regular: 'far', solid: 'fas' };

type IconChoiceProps = {
  iconClass: string;
  title: string;
  selected: boolean;
  onPick: (iconClass: string) => void;
};

const IconChoice = ({ iconClass, title, selected, onPick }: IconChoiceProps) => {
  const handleClick = useCallback(() => onPick(iconClass), [iconClass, onPick]);

  return (
    <div
      className={clsx(
        'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md p-1 hover:bg-blue-200 hover:text-white',
        { 'bg-[#339af0] text-white': selected }
      )}
      onClick={handleClick}
      title={title}
    >
      <i className={iconClass} />
    </div>
  );
};

export type IconPickerProps = {
  /** The Font Awesome classes chosen, `'fas fa-flag'`. */
  value: string;
  onChange: (iconClass: string) => void;
};

/**
 * Font Awesome's catalogue, searchable and filtered by style — the one picker every element that draws an icon offers
 * (a `fontAwesome`, and a button's or a link's `icon`).
 */
const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const [icons, setIcons] = useState<Record<string, FontIcon>>({});
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchIcons = async () => {
      setLoading(true);
      const response = await fetch(
        'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/metadata/icons.json'
      );
      setIcons((await response.json()) as Record<string, FontIcon>);
      setLoading(false);
    };

    void fetchIcons();
  }, []);

  const choices = useMemo(
    () =>
      Object.entries(icons).flatMap(([name, { styles, label }]) =>
        label.toLowerCase().includes(filter.toLowerCase())
          ? styles
              .filter(style => type === '' || style === type)
              .map(style => ({ iconClass: `${PREFIXES[style] ?? 'fa'} fa-${name}`, title: `${label} - [${name}]` }))
          : []
      ),
    [icons, filter, type]
  );

  return (
    <div className="flex grow basis-0 flex-col gap-4">
      <Select value={type} placeholder="All" label="Icon Type" onChange={setType} size="xs">
        <option value="regular">Regular</option>
        <option value="solid">Solid</option>
        <option value="brands">Brands</option>
      </Select>
      <Input value={filter} placeholder="Search Icon..." onChange={setFilter} size="xs" />
      <div className="flex grow basis-0 flex-col overflow-auto py-2">
        <div className="flex flex-wrap items-center justify-center gap-1">
          {loading && <i className="fa-solid fa-sync fa-spin fa-3x" />}
          {!loading &&
            choices.map(choice => (
              <IconChoice
                key={choice.iconClass}
                iconClass={choice.iconClass}
                title={choice.title}
                selected={choice.iconClass === value}
                onPick={onChange}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default IconPicker;
