// Packages
import { useCallback, useState } from 'react';

export function useWebWorker({ fn, initialValue, onMessageReceived }) {
  const [result, setResult] = useState(initialValue);

  const workerHandler = useCallback(fn => {
    onmessage = event => {
      postMessage(fn(event.data));
    };
  }, []);

  const run = useCallback(value => {
    const worker = new Worker(URL.createObjectURL(new Blob([`(${workerHandler})(${fn})`])));

    worker.onmessage = event => {
      if (event.data) {
        setResult(event.data);
        if (onMessageReceived) onMessageReceived();
        worker.terminate();
      }
    };

    worker.onerror = error => {
      console.error(error.message);
      worker.terminate();
    };

    worker.postMessage(value);
  }, []);

  return {
    result,
    setResult,
    run
  };
}
