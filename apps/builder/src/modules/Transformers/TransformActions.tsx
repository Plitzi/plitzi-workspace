import Button from '@plitzi/plitzi-ui/Button';
import Select2 from '@plitzi/plitzi-ui/Select2';
import Switch from '@plitzi/plitzi-ui/Switch';
import { useMemo } from 'react';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ChangeEvent } from 'react';

export type TransformActionsProps = {
  mode?: 'html-tailwind' | 'webflow';
  disabled?: boolean;
  previewMode?: boolean;
  onChangeMode?: (mode?: Exclude<Option, OptionGroup>) => void;
  onChangePreviewMode?: (e: ChangeEvent<HTMLInputElement>) => void;
  onClickEraser?: () => void;
  onTransform?: () => void;
  onImport?: () => void;
};

const TransformActions = ({
  mode = 'html-tailwind',
  disabled,
  previewMode = true,
  onChangeMode,
  onChangePreviewMode,
  onClickEraser,
  onTransform,
  onImport
}: TransformActionsProps) => {
  const options = useMemo(
    () => [
      // { value: 'html', label: 'Html' },
      { value: 'html-tailwind', label: 'Html + Tailwind' },
      // { value: 'json', label: 'Json' },
      { value: 'webflow', label: 'Webflow' }
    ],
    []
  );

  return (
    <div className="flex items-center gap-2">
      <Switch
        label="Preview Mode"
        className={{ root: 'w-30', input: 'w-30 items-center' }}
        size="sm"
        checked={previewMode}
        onChange={onChangePreviewMode}
      />
      <Button size="sm" className="rounded-sm" title="Clean Up" onClick={onClickEraser}>
        <i className="fa-solid fa-eraser" />
      </Button>
      <Select2
        className="w-[150px] rounded-sm"
        size="sm"
        placeholder="Select mode"
        value={mode}
        onChange={onChangeMode}
        options={options}
        isSearchable={false}
        clearable={false}
      />
      <Button size="sm" className="rounded-sm" disabled={disabled} onClick={onTransform} title="Transform">
        {disabled ? 'Loading...' : 'Compile'}
      </Button>
      <Button size="sm" className="rounded-sm" disabled={disabled} onClick={onImport} title="Import">
        Import
      </Button>
    </div>
  );
};

export default TransformActions;
