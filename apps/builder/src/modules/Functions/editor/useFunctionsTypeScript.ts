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

import { FUNCTIONS_ROOT } from './source';

import type { NewTask, SourceEdit, SourceFunctions, SourcePlace } from './source';
import type { FunctionsWorker } from './typescriptWorker';
import type { Extension } from '@codemirror/state';
import type { FunctionTimeLimits } from '@plitzi/sdk-shared';
import type { Remote } from 'comlink';

/** Where a file of the space's functions lives in the worker — the same root the worker keeps them under. */
export const workerPathOf = (file: string): string => `${FUNCTIONS_ROOT}${file}`;

/** How long typing pauses before what the source declares is read again: a list that follows, not one that flickers. */
const DESCRIBE_DELAY_MS = 250;

/**
 * The TypeScript worker for one open panel: started from where the host serves it, given every file of the space so
 * their imports of each other resolve, and turned into the editor extensions for the file being edited. Without a
 * worker URL, or before it is ready, there are no extensions — the editor still edits, and a save still checks.
 */
const useFunctionsTypeScript = (workerUrl: string, files: Record<string, string>) => {
  const [worker, setWorker] = useState<Remote<FunctionsWorker> | undefined>(undefined);
  const [source, setSource] = useState<SourceFunctions | undefined>(undefined);

  useEffect(() => {
    if (!workerUrl) {
      return undefined;
    }

    const raw = new Worker(workerUrl, { type: 'module' });
    const remote = wrap<FunctionsWorker>(raw);
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
    // What the source declares, read again once typing pauses: the list follows the code without being saved.
    let current = true;
    const timer = setTimeout(() => {
      void worker.describe().then(read => {
        if (current) {
          setSource(read);
        }
      });
    }, DESCRIBE_DELAY_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [worker, files]);

  const setTaskLimits = useCallback(
    (place: SourcePlace, limits: FunctionTimeLimits): Promise<SourceEdit | undefined> =>
      worker ? worker.setTaskLimits(place, limits) : Promise.resolve(undefined),
    [worker]
  );

  const addTask = useCallback(
    (task: NewTask): Promise<SourceEdit | undefined> => (worker ? worker.addTask(task) : Promise.resolve(undefined)),
    [worker]
  );

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

  return useMemo(
    () => ({ ready: Boolean(worker), extensionsFor, source, setTaskLimits, addTask }),
    [worker, extensionsFor, source, setTaskLimits, addTask]
  );
};

export default useFunctionsTypeScript;
