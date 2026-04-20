import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { useCallback, useMemo, useRef, useState } from 'react';

import GradientPreviewBar from './GradientPreviewBar';
import GradientStopEditor from './GradientStopEditor';
import GradientStopTrack from './GradientStopTrack';
import { newStopId } from '../../helpers/backgroundParser';

import type { GradientStop } from '../../helpers/backgroundParser';
import type { MouseEvent } from 'react';

export type GradientStopBarProps = {
  stops: GradientStop[];
  onChange?: (stops: GradientStop[]) => void;
};

function stopPct(pos: string): number {
  const n = parseFloat(pos);

  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

const GradientStopBar = ({ stops, onChange }: GradientStopBarProps) => {
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  const [selectedId, setSelectedId] = useState<string>(stops[0]?.id ?? '');

  const sortedStops = useMemo(() => [...stops].sort((a, b) => stopPct(a.position) - stopPct(b.position)), [stops]);

  const gradientCSS = useMemo(() => {
    const parts = sortedStops.map(s => (s.position ? `${s.color} ${s.position}` : s.color)).join(', ');

    return `linear-gradient(90deg, ${parts})`;
  }, [sortedStops]);

  const selectedStop = (stops.find(s => s.id === selectedId) ?? stops[0]) as GradientStop | undefined;

  const handleBarClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const { left, width } = e.currentTarget.getBoundingClientRect();
      const pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100)));
      const current = stopsRef.current;
      const nearest = [...current]
        .sort((a, b) => Math.abs(stopPct(a.position) - pct) - Math.abs(stopPct(b.position) - pct))
        .at(0);
      const newStop: GradientStop = { id: newStopId(), color: nearest?.color ?? '#808080', position: `${pct}%` };
      const newStops = [...current, newStop].sort((a, b) => stopPct(a.position) - stopPct(b.position));
      onChange?.(newStops);
      setSelectedId(newStop.id);
    },
    [onChange]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedStop) {
        return;
      }

      onChange?.(stopsRef.current.map(s => (s.id === selectedStop.id ? { ...s, color } : s)));
    },
    [onChange, selectedStop]
  );

  const handlePositionChange = useCallback(
    (value: unknown) => {
      if (!selectedStop) {
        return;
      }

      onChange?.(stopsRef.current.map(s => (s.id === selectedStop.id ? { ...s, position: String(value) } : s)));
    },
    [onChange, selectedStop]
  );

  const handleRemoveStop = useCallback(() => {
    if (!selectedStop || stopsRef.current.length <= 2) {
      return;
    }

    const remaining = stopsRef.current.filter(s => s.id !== selectedStop.id);
    onChange?.(remaining);
    setSelectedId(remaining[0]?.id ?? '');
  }, [onChange, selectedStop]);

  const handleAddStopAtMiddle = useCallback(() => {
    const newStop: GradientStop = { id: newStopId(), color: '#808080', position: '50%' };
    const newStops = [...stopsRef.current, newStop].sort((a, b) => stopPct(a.position) - stopPct(b.position));
    onChange?.(newStops);
    setSelectedId(newStop.id);
  }, [onChange]);

  return (
    <div className="flex flex-col gap-2">
      <GradientPreviewBar gradientCSS={gradientCSS} onClick={handleBarClick} />
      <div className="flex px-2">
        <GradientStopTrack stops={stops} selectedId={selectedId} onChange={onChange} onSelect={setSelectedId} />
      </div>
      {selectedStop && (
        <GradientStopEditor
          stop={selectedStop}
          showRemove={stops.length > 2}
          onColorChange={handleColorChange}
          onPositionChange={handlePositionChange}
          onRemove={handleRemoveStop}
        />
      )}
      <div className="flex flex-wrap gap-1">
        {sortedStops.map(stop => (
          <button
            key={stop.id}
            type="button"
            className={clsx(
              'h-5 w-5 cursor-pointer rounded-sm border shadow-sm',
              selectedId === stop.id
                ? 'border-blue-500 ring-1 ring-blue-300 dark:ring-blue-700'
                : 'border-gray-300 hover:border-gray-400 dark:border-zinc-600'
            )}
            style={{ backgroundColor: stop.color }}
            onClick={() => setSelectedId(stop.id)}
            title={`${stop.color} • ${stop.position}`}
          />
        ))}
        <button
          type="button"
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:border-zinc-600 dark:text-zinc-500"
          title="Add stop at 50%"
          onClick={handleAddStopAtMiddle}
        >
          <Icon icon="fas fa-plus" size="xs" />
        </button>
      </div>
    </div>
  );
};

export default GradientStopBar;
