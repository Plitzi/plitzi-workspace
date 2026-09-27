import { autocompletion } from '@codemirror/autocomplete';
import {
  tsAutocompleteWorker,
  tsFacetWorker,
  tsHoverWorker,
  tsLinterWorker,
  tsSyncWorker
} from '@valtown/codemirror-ts';
import { wrap } from 'comlink';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Extension } from '@codemirror/state';
import type { WorkerShape } from '@valtown/codemirror-ts/worker';

/** Where a file of the space's functions lives in the worker — the same root the worker keeps them under. */
export const workerPathOf = (file: string): string => `/functions/${file}`;

/**
 * The TypeScript worker for one open panel: started from where the host serves it, given every file of the space so
 * their imports of each other resolve, and turned into the editor extensions for the file being edited. Without a
 * worker URL, or before it is ready, there are no extensions — the editor still edits, and a save still checks.
 */
const useFunctionsTypeScript = (workerUrl: string, files: Record<string, string>) => {
  const [worker, setWorker] = useState<WorkerShape | undefined>(undefined);

  useEffect(() => {
    if (!workerUrl) {
      return undefined;
    }

    const raw = new Worker(workerUrl, { type: 'module' });
    const remote: WorkerShape = wrap(raw);
    let active = true;
    void remote.initialize().then(() => {
      if (active) {
        setWorker(() => remote);
      }
    });

    return () => {
      active = false;
      raw.terminate();
      setWorker(undefined);
    };
  }, [workerUrl]);

  useEffect(() => {
    if (!worker) {
      return;
    }

    Object.entries(files).forEach(([file, code]) => {
      void worker.updateFile({ path: workerPathOf(file), code });
    });
  }, [worker, files]);

  const extensionsFor = useCallback(
    (file: string): Extension[] =>
      worker
        ? [
            tsFacetWorker.of({ worker, path: workerPathOf(file) }),
            tsSyncWorker(),
            tsLinterWorker(),
            autocompletion({ override: [tsAutocompleteWorker()] }),
            tsHoverWorker()
          ]
        : [],
    [worker]
  );

  return useMemo(() => ({ ready: Boolean(worker), extensionsFor }), [worker, extensionsFor]);
};

export default useFunctionsTypeScript;
