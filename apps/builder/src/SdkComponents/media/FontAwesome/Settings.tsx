import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import classNames from 'classnames';
import { useEffect, useState, useMemo, useCallback } from 'react';

import type { ReactNode } from 'react';

type SettingsProps = {
  icon?: string;
  size?: 'fa-1x' | 'fa-2x' | 'fa-3x' | 'fa-4x';
  iconAnimation?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

type FontIcon = {
  styles: string[];
  label: string;
};

const Settings = ({ icon = '', size = 'fa-1x', iconAnimation = '', onUpdate }: SettingsProps) => {
  const [icons, setIcons] = useState<Record<string, FontIcon>>({});
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const handleClick = useCallback((item: string) => () => onUpdate?.('icon', item), [onUpdate]);

  const iconsToRender = useMemo(
    () =>
      Object.keys(icons).map(ic => {
        const { styles, label } = icons[ic];
        if (!label.toLowerCase().includes(filter.toLowerCase())) {
          return [];
        }

        const iconsContent: ReactNode[] = [];
        styles.forEach(icStyle => {
          if (type !== '' && icStyle !== type) {
            return;
          }

          let iconStyle = 'fa';
          switch (icStyle) {
            case 'brands':
              iconStyle = 'fab';

              break;
            case 'regular':
              iconStyle = 'far';

              break;
            case 'solid':
              iconStyle = 'fas';

              break;
            default:
          }

          const iconClass = `${iconStyle} fa-${ic}`;

          iconsContent.push(
            <div
              key={iconClass}
              className={classNames(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md p-2 hover:bg-blue-200 hover:text-white',
                { 'bg-[#339af0] text-white': iconClass === icon }
              )}
              onClick={handleClick(iconClass)}
            >
              <i key={`${ic}_${iconStyle}`} className={iconClass} title={`${label} - [${ic}]`} />
            </div>
          );
        });

        return iconsContent;
      }),
    [icon, icons, filter, type, handleClick]
  );

  const fetchIcons = async () => {
    setLoading(true);
    const response = await fetch('https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/metadata/icons.json');
    setIcons((await response.json()) as Record<string, FontIcon>);
    setLoading(false);
  };

  useEffect(() => {
    void fetchIcons();
  }, []);

  const handleChangeFilter = useCallback((value: string) => setFilter(value), []);

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeType = useCallback((value: string) => setType(value), []);

  return (
    <div className="flex grow basis-0 flex-col gap-4 py-2">
      <Select value={type} placeholder="All" label="Icon Type" onChange={handleChangeType}>
        <option value="regular">Regular</option>
        <option value="solid">Solid</option>
        <option value="brands">Brands</option>
      </Select>
      <Select label="Icon Animation" value={iconAnimation} placeholder="None" onChange={handleChange('iconAnimation')}>
        <option value="fa-beat">Beat</option>
        <option value="fa-fade">Fade</option>
        <option value="fa-beat-fade">Beat-Fade</option>
        <option value="fa-bounce">Bounce</option>
        <option value="fa-flip">Flip</option>
        <option value="fa-shake">Shake</option>
        <option value="fa-spin">Spin</option>
      </Select>
      <Select value={size} label="Icon Size" onChange={handleChange('size')}>
        <option value="fa-1x">1X</option>
        <option value="fa-2x">2X</option>
        <option value="fa-3x">3X</option>
        <option value="fa-4x">4X</option>
      </Select>
      <Input value={filter} placeholder="Search Icon..." onChange={handleChangeFilter} />
      <div className="flex grow basis-0 flex-col overflow-auto px-2 py-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {loading && <i className="fa-solid fa-sync fa-spin fa-3x" />}
          {!loading && iconsToRender}
        </div>
      </div>
    </div>
  );
};

export default Settings;
