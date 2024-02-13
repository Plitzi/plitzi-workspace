// Packages
import { useMemo, useContext, useEffect, useRef, useState } from 'react';

// Relatives
import DataSourceContext from '../DataSourceContext';
import { emptyObject, makeId } from '../../../helpers/utils';

export const MODE_WRITE = 'write';
export const MODE_READ = 'read';

const useDataSource = (props = {}) => {
  const { id, source, name, fields = [], value = emptyObject, mode = MODE_WRITE, extraElements = [] } = props;
  const { dataSourceManager } = useContext(DataSourceContext);
  const initRef = useRef();
  const uniqueIdRef = useRef(makeId(8));
  const [retriggerTime, setRetriggerTime] = useState(0);
  const updateRequiredRef = useRef(false);

  if (mode === MODE_WRITE && !initRef.current) {
    initRef.current = true;
    dataSourceManager.registerSource(`${id}-${uniqueIdRef.current}`, source, name, value, fields);
  } else if (mode === MODE_READ && !initRef.current) {
    initRef.current = true;
    dataSourceManager.registerReceiver(`${id}-${uniqueIdRef.current}`, setRetriggerTime);
  } else if (mode === MODE_WRITE && initRef.current) {
    // Update Source Value
    updateRequiredRef.current = dataSourceManager.setSourceValue(`${id}-${uniqueIdRef.current}`, source, value);
  }

  useEffect(() => {
    if (mode === MODE_WRITE && initRef.current) {
      dataSourceManager.refreshSourceFields(id, source, fields);
    }
  }, [fields, mode, dataSourceManager]);

  useEffect(() => {
    return () => {
      if (mode === MODE_WRITE && initRef.current) {
        dataSourceManager.unregisterSource(`${id}-${uniqueIdRef.current}`, source);
        initRef.current = undefined;
      } else if (mode === MODE_READ && initRef.current) {
        dataSourceManager.unregisterReceiver(`${id}-${uniqueIdRef.current}`, setRetriggerTime);
        initRef.current = undefined;
      }
    };
  }, [dataSourceManager]);

  useEffect(() => {
    dataSourceManager.updateSource(`${id}-${uniqueIdRef.current}`, source, name);
  }, [name]);

  useEffect(() => {
    if (updateRequiredRef.current) {
      dataSourceManager.refreshReceivers(`${id}-${uniqueIdRef.current}`);
    }
  }, [value]);

  if (mode === MODE_WRITE) {
    return undefined;
  }

  return useMemo(
    () => dataSourceManager.getSources(id, extraElements),
    [id, dataSourceManager, extraElements, retriggerTime]
  );
};

export default useDataSource;
