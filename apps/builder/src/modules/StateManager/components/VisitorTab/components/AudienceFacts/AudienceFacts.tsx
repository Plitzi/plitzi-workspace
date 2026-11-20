import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { VisitorDevice } from '@plitzi/sdk-shared/audiences';
import type { ChangeEvent } from 'react';

const FOLLOWS_CANVAS = 'canvas';

const isDevice = (value: string): value is VisitorDevice =>
  value === 'mobile' || value === 'tablet' || value === 'desktop';

/**
 * What the canvas's visitor is for the space's audiences — the device, the language, whether they came before — each
 * left to what the builder says by itself until chosen: the device the canvas is sized as, the editor's language.
 */
const AudienceFacts = () => {
  const [[simulation, visitor]] = useBuilderStore(['visitorSimulation', 'visitor']);
  const [, setSimulation] = useBuilderStore('visitorSimulation');

  const handleDevice = useCallback(
    (value: string) => {
      const { device: _device, ...rest } = simulation ?? {};
      setSimulation(isDevice(value) ? { ...rest, device: value } : rest);
    },
    [simulation, setSimulation]
  );

  const handleLanguage = useCallback(
    (value: string) => {
      const { language: _language, ...rest } = simulation ?? {};
      const language = value.trim().toLowerCase();
      setSimulation(language ? { ...rest, language } : rest);
    },
    [simulation, setSimulation]
  );

  const handleReturning = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSimulation({ ...simulation, returning: event.target.checked }),
    [simulation, setSimulation]
  );

  return (
    <section className="border-ui-line flex flex-col gap-2 border-t pt-2">
      <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">For audiences</h6>
      <Select label="Device" value={simulation?.device ?? FOLLOWS_CANVAS} onChange={handleDevice} size="xs">
        <option value={FOLLOWS_CANVAS}>As the canvas is sized ({visitor?.device ?? 'desktop'})</option>
        <option value="mobile">Mobile</option>
        <option value="tablet">Tablet</option>
        <option value="desktop">Desktop</option>
      </Select>
      <Input
        label="Language"
        size="xs"
        placeholder={visitor?.language || 'en'}
        value={simulation?.language ?? ''}
        onChange={handleLanguage}
      />
      <Checkbox
        checked={simulation?.returning ?? false}
        onChange={handleReturning}
        label="Came before (returning)"
        size="xs"
      />
    </section>
  );
};

export default AudienceFacts;
