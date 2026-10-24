import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { ChartProps } from './Chart';

type SettingsProps = Omit<ChartProps, 'ref' | 'className' | 'items'> & {
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  kind = 'bar',
  labelField = 'label',
  valueField = 'value',
  label = '',
  format = 'number',
  showValues = false,
  height = 240,
  emptyText = 'No data yet',
  onUpdate
}: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);
  const handleChangeHeight = useCallback(
    (value: string) => onUpdate?.('height', Math.max(80, Math.round(Number(value) || 0))),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Select value={kind} label="Kind" onChange={update.text('kind')} size="xs">
        <option value="bar">Bars</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="donut">Donut</option>
      </Select>
      <Input value={label} label="Name (read aloud)" onChange={update.text('label')} />
      <Input value={labelField} label="Label Field" onChange={update.text('labelField')} />
      <Input value={valueField} label="Value Field" onChange={update.text('valueField')} />
      <Select value={format} label="Values" onChange={update.text('format')} size="xs">
        <option value="number">1,284</option>
        <option value="percent">42%</option>
        <option value="compact">1.3K</option>
      </Select>
      {kind !== 'donut' && (
        <Checkbox checked={showValues} onChange={update.checked('showValues')} label="Show Values" />
      )}
      <Input value={String(height)} type="number" label="Height (px)" onChange={handleChangeHeight} />
      <Input value={emptyText} label="When Empty" onChange={update.text('emptyText')} />
    </div>
  );
};

export default Settings;
