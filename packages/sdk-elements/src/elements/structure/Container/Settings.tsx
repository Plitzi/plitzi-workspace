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
    | 'dd'
    | 'li'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6';
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
        <option value="li">LI</option>
        <option value="h1">H1 (heading with parts)</option>
        <option value="h2">H2 (heading with parts)</option>
        <option value="h3">H3 (heading with parts)</option>
        <option value="h4">H4 (heading with parts)</option>
        <option value="h5">H5 (heading with parts)</option>
        <option value="h6">H6 (heading with parts)</option>
      </Select>
    </div>
  );
};

export default Settings;
