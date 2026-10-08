import { useCallback, useRef } from 'react';

import GradientStopHandle from './GradientStopHandle';

import type { GradientStop } from '../../helpers/backgroundParser';

type GradientStopTrackProps = {
  stops: GradientStop[];
  selectedId: string;
  onChange?: (stops: GradientStop[]) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

/** The handles, laid over the bar inset by half a handle, so a stop at 0% or 100% stays whole and grabbable. */
const GradientStopTrack = ({ stops, selectedId, onChange, onSelect, onRemove }: GradientStopTrackProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  const handleChange = useCallback(
    (stopId: string, pct: number) => {
      onChange?.(stopsRef.current.map(s => (s.id === stopId ? { ...s, position: `${pct}%` } : s)));
    },
    [onChange]
  );

  return (
    <div ref={trackRef} className="pointer-events-none absolute inset-y-0 right-2.5 left-2.5 select-none">
      {stops.map(stop => (
        <GradientStopHandle
          key={stop.id}
          trackRef={trackRef}
          stop={stop}
          selected={selectedId === stop.id}
          onPositionChange={handleChange}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

export default GradientStopTrack;
