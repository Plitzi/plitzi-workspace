// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import Select from '@plitzi/plitzi-ui-components/Select';

// Alias
import AppContext from '@pmodules/App/AppContext';

const zooms = [...Array(26).keys()].map(i => ({ label: `${50 + i * 10}%`, value: Number(0.5 + i * 0.1).toFixed(1) }));

const ZoomButtons = () => {
  const { zoom, setZoom, displayMode } = useContext(AppContext);

  const handleChange = useCallback(
    e => {
      setZoom(e.target.value);
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
  });

  return (
    <div className="flex items-center gap-1">
      <div className="text-xs flex items-center justify-center gap-2">
        <div className="inline">
          <span className="font-bold">{Math.floor(width / zoom)}</span> PX
        </div>
      </div>
      <Select
        size="sm"
        value={zoom}
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
