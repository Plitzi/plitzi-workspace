import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { use, useCallback, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';

type SettingsProps = {
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
  folder?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'div', folder = '', onUpdate }: SettingsProps) => {
  const {
    contexts: { SchemaContext }
  } = usePlitziServiceContext();
  const {
    schema: { pageFolders }
  } = use(SchemaContext);

  const handleChangeSubType = useCallback((value: string) => onUpdate?.('subType', value), [onUpdate]);

  const handleChangeFolder = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onUpdate?.('folder', option?.value ?? ''),
    [onUpdate]
  );

  const pageFolderOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...pageFolders.map(({ id, name: folderName }) => ({ value: id, label: folderName }))
    ],
    [pageFolders]
  );

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
      <Select2
        label="Folder"
        value={folder}
        options={pageFolderOptions}
        placeholder="None"
        onChange={handleChangeFolder}
      />
    </div>
  );
};

export default Settings;
