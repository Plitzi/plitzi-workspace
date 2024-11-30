// Packages
import React, { useCallback, use, useMemo } from 'react';
import Select from '@plitzi/plitzi-ui-components/Select';

// Alias
import AppContext from '@pmodules/App/AppContext';

const zooms = [...Array(26).keys()].map(i => ({ label: `${50 + i * 10}%`, value: Number(0.5 + i * 0.1).toFixed(1) }));

const ZoomButtons = () => {
  const { zoom = 1, setZoom, displayMode } = use(AppContext);

  const handleChange = useCallback(
    e => {
      setZoom(parseFloat(e.target.value));
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
      <div className="text-xs inline font-bold">{Math.floor(width / zoom)} PX</div>
      <Select
        size="sm"
        value={Number(zoom).toFixed(1)}
        onChange={handleChange}
        className="border-white active:border-gray-200 hover:border-gray-200 font-bold rounded hover:bg-gray-50"
      >
        {zooms.map(({ label, value }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
};

export default ZoomButtons;
