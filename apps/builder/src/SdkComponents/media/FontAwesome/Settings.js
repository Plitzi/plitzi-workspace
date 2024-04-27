// Packages
import React, { useEffect, useState, useMemo } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Select from '@plitzi/plitzi-ui-components/Select';
import Input from '@plitzi/plitzi-ui-components/Input';

/**
 * @param {{
 *   icon?: string;
 *   size?: 'fa-1x' | 'fa-2x' | 'fa-3x' | 'fa-4x';
 *   iconAnimation?: string;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { icon = '', size = 'fa-1x', iconAnimation = '', onUpdate = noop } = props;
  const [icons, setIcons] = useState({});
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const handleClick = item => () => onUpdate('icon', item);

  const iconsToRender = useMemo(
    () =>
      Object.keys(icons).map(ic => {
        const { styles, label } = icons[ic];
        if (!label.toLowerCase().includes(filter.toLowerCase())) {
          return [];
        }

        const iconsContent = [];
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
                'flex items-center justify-center p-2 cursor-pointer rounded-md hover:bg-blue-200 hover:text-white w-8 h-8',
                { 'bg-[#339af0] text-white': iconClass === icon }
              )}
              onClick={handleClick(iconClass)}
            >
              <i key={`${ic}-${iconStyle}`} className={classNames(iconClass)} title={`${label} - [${ic}]`} />
            </div>
          );
        });

        return iconsContent;
      }),
    [icon, icons, filter, type, size, handleClick]
  );

  const fetchIcons = async () => {
    setLoading(true);
    const response = await fetch('https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/metadata/icons.json');
    setIcons(await response.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchIcons();
  }, []);

  const handleChangeFilter = e => setFilter(e.target.value);

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeType = e => setType(e.target.value);

  return (
    <div className="flex flex-col grow basis-0">
      <div className="bg-[#339af0] px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">FONT AWESOME OPTIONS</h1>
      </div>
      <div className="flex flex-col px-4 py-2">
        <label className="mb-4">Icon Type</label>
        <Select value={type} placeholder="All" onChange={handleChangeType} className="w-full rounded-md">
          <option value="regular">Regular</option>
          <option value="solid">Solid</option>
          <option value="brands">Brands</option>
        </Select>
      </div>
      <div className="flex flex-col px-4 py-2">
        <label className="mb-4">Icon Animation</label>
        <Select
          value={iconAnimation}
          placeholder="None"
          onChange={handleChange('iconAnimation')}
          className="w-full rounded-md"
        >
          <option value="fa-beat">Beat</option>
          <option value="fa-fade">Fade</option>
          <option value="fa-beat-fade">Beat-Fade</option>
          <option value="fa-bounce">Bounce</option>
          <option value="fa-flip">Flip</option>
          <option value="fa-shake">Shake</option>
          <option value="fa-spin">Spin</option>
        </Select>
      </div>
      <div className="flex flex-col px-4 py-2">
        <label className="mb-4">Icon Size</label>
        <Select value={size} onChange={handleChange('size')} className="w-full rounded-md">
          <option value="fa-1x">1X</option>
          <option value="fa-2x">2X</option>
          <option value="fa-3x">3X</option>
          <option value="fa-4x">4X</option>
        </Select>
      </div>
      <div className="flex flex-col px-4 py-2">
        <Input value={filter} placeholder="Search Icon..." inputClassName="rounded" onChange={handleChangeFilter} />
      </div>
      <div className="flex flex-col px-2 py-2 grow basis-0 overflow-auto">
        <div className="flex flex-wrap gap-2 items-center justify-center">
          {loading && <i className="fa-solid fa-sync fa-spin fa-3x" />}
          {!loading && iconsToRender}
        </div>
      </div>
    </div>
  );
};

export default Settings;
