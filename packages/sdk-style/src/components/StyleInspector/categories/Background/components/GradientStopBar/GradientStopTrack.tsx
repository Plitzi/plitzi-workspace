import { useCallback, useRef } from 'react';

import GradientStopHandle from './GradientStopHandle';

import type { GradientStop } from '../../helpers/backgroundParser';

type GradientStopTrackProps = {
  stops: GradientStop[];
  selectedId: string;
  onChange?: (stops: GradientStop[]) => void;
  onSelect: (id: string) => void;
};

const GradientStopTrack = ({ stops, selectedId, onChange, onSelect }: GradientStopTrackProps) => {
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
    <div ref={trackRef} className="relative h-5 w-full select-none">
      <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-gray-300 dark:bg-zinc-600" />
      {stops.map(stop => (
        <GradientStopHandle
          key={stop.id}
          trackRef={trackRef}
          stop={stop}
          selected={selectedId === stop.id}
          onPositionChange={handleChange}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

export default GradientStopTrack;
