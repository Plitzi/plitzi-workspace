import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

type SettingsProps = {
  subType?:
    | 'div'
    | 'header'
    | 'footer'
    | 'nav'
    | 'main'
    | 'section'
    | 'article'
    | 'aside'
    | 'address'
    | 'figure'
    | 'dl'
    | 'dt'
    | 'dd';
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'div', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="ContainerTag" value={subType} onChange={handleChange('subType')} size="xs">
        <option value="div">Div</option>
        <option value="header">Header</option>
        <option value="footer">Footer</option>
        <option value="nav">Nav</option>
        <option value="main">Main</option>
        <option value="section">Section</option>
        <option value="article">Article</option>
        <option value="aside">Aside</option>
        <option value="address">Address</option>
        <option value="figure">Figure</option>
        <option value="dl">DL</option>
        <option value="dt">DT</option>
        <option value="dd">DD</option>
      </Select>
    </div>
  );
};

export default Settings;
