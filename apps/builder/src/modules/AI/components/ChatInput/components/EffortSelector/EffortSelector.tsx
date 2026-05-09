import { useCallback, useEffect, useRef, useState } from 'react';

import EffortDropdown from './components/EffortDropdown';
import EffortTrigger from './components/EffortTrigger';
import { OPTIONS } from './helpers';

import type { AiEffort } from '@pmodules/AI/types';

export type EffortSelectorProps = {
  value: AiEffort;
  disabled?: boolean;
  onChange: (effort: AiEffort) => void;
};

const EffortSelector = ({ value, disabled = false, onChange }: EffortSelectorProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cur = OPTIONS.find(o => o.id === value) ?? OPTIONS[1];

  const toggle = useCallback(() => setOpen(o => !o), []);

  const handlePick = useCallback(
    (id: AiEffort) => {
      onChange(id);
      setOpen(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <EffortTrigger value={value} label={cur.label} disabled={disabled} onToggle={toggle} />
      {open && <EffortDropdown value={value} onPick={handlePick} />}
    </div>
  );
};

export default EffortSelector;
