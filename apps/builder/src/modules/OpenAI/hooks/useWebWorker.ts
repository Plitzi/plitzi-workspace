/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { useCallback, useState } from 'react';

export type UseWebWorkerProps = {
  fn?: (data: unknown) => unknown;
  initialValue?: unknown;
  onMessageReceived?: () => void;
};

export function useWebWorker({ fn, initialValue, onMessageReceived }: UseWebWorkerProps) {
  const [result, setResult] = useState(initialValue);

  const workerHandler = useCallback((fn?: (data: unknown) => unknown) => {
    onmessage = event => {
      postMessage(fn?.(event.data));
    };
  }, []);

  const run = useCallback(
    (value: unknown) => {
      const worker = new Worker(URL.createObjectURL(new Blob([`(${workerHandler})(${fn})`])));

      worker.onmessage = event => {
        if (event.data) {
          setResult(event.data);
          if (onMessageReceived) {
            onMessageReceived();
          }

          worker.terminate();
        }
      };

      worker.onerror = error => {
        console.error(error.message);
        worker.terminate();
      };

      worker.postMessage(value);
    },
    [fn, onMessageReceived, workerHandler]
  );

  return {
    result,
    setResult,
    run
  };
}
