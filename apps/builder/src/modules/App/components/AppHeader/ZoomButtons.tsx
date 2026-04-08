import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, use, useMemo, memo } from 'react';

import AppContext from '@pmodules/App/AppContext';

const zooms = [...Array(26).keys()].map(i => ({ label: `${50 + i * 10}%`, value: (0.5 + i * 0.1).toFixed(1) }));

const ZoomButtons = () => {
  const { zoom = 1, setZoom, displayMode } = use(AppContext);

  const handleChange = useCallback(
    (value: string) => {
      setZoom(parseFloat(value));
    },
    [setZoom]
  );

  const width = useMemo(() => {
    if (displayMode === 'desktop') {
      return 1440;
    }

    if (displayMode === 'tablet') {
      return 768;
    }

    return 425;
  }, [displayMode]);

  return (
    <div className="flex items-center gap-4">
      <div className="inline text-xs font-bold">{Math.floor(width / zoom)} PX</div>
      <Select size="xs" value={zoom.toFixed(1)} onChange={handleChange}>
        {zooms.map(({ label, value }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
};

export default memo(ZoomButtons);
