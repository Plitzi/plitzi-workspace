import { useCallback, useMemo, useRef, useState } from 'react';

import GradientPreviewBar from './GradientPreviewBar';
import GradientStopEditor from './GradientStopEditor';
import GradientStopTrack from './GradientStopTrack';
import { colorNear, sortStops, stopsPreview } from './helpers';
import { newStopId } from '../../helpers/backgroundParser';

import type { GradientStop } from '../../helpers/backgroundParser';
import type { MouseEvent } from 'react';

export type GradientStopBarProps = {
  stops: GradientStop[];
  onChange?: (stops: GradientStop[]) => void;
};

/** How far the handles are inset from the bar's ends — half a handle — and so where 0% and 100% fall on it. */
const HANDLE_INSET = 10;

/**
 * A gradient's stops: the bar that draws them with a handle per stop, and the selected stop's color and position. A
 * click on the bar adds a stop there in the color around it; a gradient keeps at least two.
 */
const GradientStopBar = ({ stops, onChange }: GradientStopBarProps) => {
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const [selectedId, setSelectedId] = useState<string>(stops[0]?.id ?? '');

  const gradientCSS = useMemo(() => stopsPreview(stops), [stops]);
  const selectedStop = stops.find(s => s.id === selectedId) ?? stops.at(0);

  const addStop = useCallback(
    (pct: number) => {
      const current = stopsRef.current;
      const newStop: GradientStop = { id: newStopId(), color: colorNear(current, pct), position: `${pct}%` };
      onChange?.(sortStops([...current, newStop]));
      setSelectedId(newStop.id);
    },
    [onChange]
  );

  const handleBarClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const { left, width } = e.currentTarget.getBoundingClientRect();
      const track = width - HANDLE_INSET * 2;
      addStop(Math.round(Math.max(0, Math.min(100, ((e.clientX - left - HANDLE_INSET) / track) * 100))));
    },
    [addStop]
  );

  const handleAddStop = useCallback(() => addStop(50), [addStop]);

  const handleColorChange = useCallback(
    (color: string) => {
      if (selectedStop) {
        onChange?.(stopsRef.current.map(s => (s.id === selectedStop.id ? { ...s, color } : s)));
      }
    },
    [onChange, selectedStop]
  );

  const handlePositionChange = useCallback(
    (position: string) => {
      if (selectedStop) {
        onChange?.(sortStops(stopsRef.current.map(s => (s.id === selectedStop.id ? { ...s, position } : s))));
      }
    },
    [onChange, selectedStop]
  );

  const handleChangeTrack = useCallback((next: GradientStop[]) => onChange?.(sortStops(next)), [onChange]);

  const removeStop = useCallback(
    (id: string) => {
      if (stopsRef.current.length <= 2) {
        return;
      }

      const remaining = stopsRef.current.filter(s => s.id !== id);
      onChange?.(remaining);
      setSelectedId(remaining[0]?.id ?? '');
    },
    [onChange]
  );

  const handleRemoveSelected = useCallback(() => {
    if (selectedStop) {
      removeStop(selectedStop.id);
    }
  }, [removeStop, selectedStop]);

  return (
    <div className="flex flex-col gap-2">
      <GradientPreviewBar gradientCSS={gradientCSS} onClick={handleBarClick}>
        <GradientStopTrack
          stops={stops}
          selectedId={selectedStop?.id ?? ''}
          onChange={handleChangeTrack}
          onSelect={setSelectedId}
          onRemove={removeStop}
        />
      </GradientPreviewBar>
      {selectedStop && (
        <GradientStopEditor
          stop={selectedStop}
          canRemove={stops.length > 2}
          onColorChange={handleColorChange}
          onPositionChange={handlePositionChange}
          onAdd={handleAddStop}
          onRemove={handleRemoveSelected}
        />
      )}
    </div>
  );
};

export default GradientStopBar;
