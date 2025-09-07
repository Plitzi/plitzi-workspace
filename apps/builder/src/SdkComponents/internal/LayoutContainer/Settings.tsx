import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

type SettingsProps = {
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'div', onUpdate }: SettingsProps) => {
  const handleChangeSubType = useCallback((value: string) => onUpdate?.('subType', value), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select value={subType} label="Container Tag" onChange={handleChangeSubType}>
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
      </Select>
    </div>
  );
};

export default Settings;
