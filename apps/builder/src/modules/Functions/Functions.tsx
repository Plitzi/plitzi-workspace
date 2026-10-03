import Alert from '@plitzi/plitzi-ui/Alert';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useTheme from '@plitzi/sdk-shared/theme/useTheme';
import AppContext from '@pmodules/App/AppContext';

import FunctionInspector from './components/FunctionInspector';
import FunctionsEditor from './components/FunctionsEditor';
import FunctionsGuide from './components/FunctionsGuide';
import FunctionsHeader from './components/FunctionsHeader';
import FunctionsOffer from './components/FunctionsOffer';
import FunctionsProblems from './components/FunctionsProblems';
import FunctionsSidebar from './components/FunctionsSidebar';
import FunctionsWelcome from './components/FunctionsWelcome';
import useFunctionsTypeScript from './editor/useFunctionsTypeScript';
import {
  isSaveKey,
  limitsBlockedBy,
  listedHosts,
  listedRoutes,
  listedTasks,
  saveState,
  STARTER_FILES,
  taskAt,
  taskNameOf,
  withCpu
} from './helpers';
import useFunctions from './useFunctions';

import type { NewTask, SourceEdit, SourcePlace } from './editor/source';
import type { EditorTarget, ListedTask } from './helpers';
import type { ActionRunReport, FunctionsProblem, FunctionsRefusal, FunctionsSaveResult } from '@plitzi/sdk-shared';

const EMPTY_FILES: Record<string, string> = {};

/**
 * The space's own server code: its tasks and routes as the code declares them — listed as it is typed — its files,
 * edited with TypeScript that knows the contract, and the selected task's time limit and test run beside them. Saved as
 * the draft, built and checked on the platform; the live site runs what the space was last published with. A
 * project's `plitzi functions pull` edits the same files.
 */
const Functions = () => {
  const { functionsWorkerUrl } = use(AppContext);
  const { draft, error, isLoading, save, install, remove, tryTask } = useFunctions();
  const { showDialog } = useModal();
  const { resolvedTheme } = useTheme();
  const saved = draft?.files ?? EMPTY_FILES;
  const manifest = draft?.manifest ?? null;
  const [files, setFiles] = useState<Record<string, string>>(EMPTY_FILES);
  const [selectedFile, setSelectedFile] = useState('index.ts');
  // The task the inspector shows — the first one declared until another is picked.
  const [picked, setPicked] = useState('');
  const [target, setTarget] = useState<EditorTarget | undefined>(undefined);
  // A task just written for us: brought into view once the code is read with it.
  const [awaited, setAwaited] = useState('');
  const [problems, setProblems] = useState<FunctionsProblem[]>([]);
  const [refusal, setRefusal] = useState<FunctionsRefusal | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const jumps = useRef(0);
  const typescript = useFunctionsTypeScript(functionsWorkerUrl, files);
  const { source } = typescript;
  const tasks = useMemo(() => listedTasks(source, manifest), [source, manifest]);
  const routes = useMemo(() => listedRoutes(source, manifest), [source, manifest]);
  const hosts = useMemo(() => listedHosts(source, manifest), [source, manifest]);
  const sharedLimits = source?.defined ? source.limits : manifest?.limits;
  const selectedTask = tasks.find(task => taskNameOf(task) === picked) ?? tasks.at(0);

  // The saved files are the starting point every time they change underneath — a save of ours, or one from elsewhere.
  useEffect(() => {
    setFiles(saved);
  }, [saved]);

  const names = useMemo(() => Object.keys(files).sort(), [files]);
  const modified = useMemo(
    () => [...new Set([...names, ...Object.keys(saved)])].filter(file => files[file] !== saved[file]),
    [files, names, saved]
  );
  const extensions = useMemo(() => typescript.extensionsFor(selectedFile), [typescript, selectedFile]);
  const hasFiles = names.length > 0;
  const canSave = !isSaving && hasFiles && modified.length > 0;

  const jumpTo = useCallback((place: Pick<SourcePlace, 'file' | 'line'>, focus = true) => {
    jumps.current += 1;
    setSelectedFile(place.file);
    setTarget({ file: place.file, line: place.line, key: jumps.current, focus });
  }, []);

  const applyEdit = useCallback((edit: SourceEdit | undefined) => {
    if (edit) {
      setFiles(current => ({ ...current, [edit.file]: edit.code }));
    }

    return Boolean(edit);
  }, []);

  useEffect(() => {
    const written = awaited ? tasks.find(task => taskNameOf(task) === awaited) : undefined;
    if (written?.at) {
      setAwaited('');
      jumpTo(written.at);
    }
  }, [awaited, jumpTo, tasks]);

  const handleChange = useCallback(
    (code: string) => setFiles(current => ({ ...current, [selectedFile]: code })),
    [selectedFile]
  );

  const handleSelectTask = useCallback(
    (name: string) => {
      setPicked(name);
      const place = tasks.find(task => taskNameOf(task) === name)?.at;
      if (place) {
        jumpTo(place);
      }
    },
    [jumpTo, tasks]
  );

  // The code leads: a cursor put inside a task shows that task, without moving the code under it.
  const handleCursor = useCallback(
    (file: string, offset: number) => {
      const task = taskAt(tasks, file, offset);
      if (task) {
        setPicked(taskNameOf(task));
      }
    },
    [tasks]
  );

  const handleCreateTask = useCallback(
    async (task: NewTask) => {
      if (applyEdit(await typescript.addTask(task))) {
        setPicked(taskNameOf(task));
        setAwaited(taskNameOf(task));
      }
    },
    [applyEdit, typescript]
  );

  const handleSelectRoute = useCallback(
    (key: string) => {
      const place = routes.find(route => route.key === key)?.at;
      if (place) {
        jumpTo(place);
      }
    },
    [jumpTo, routes]
  );

  const handleSelectProblem = useCallback(
    (file: string, line?: number) => {
      if (line) {
        jumpTo({ file, line });
      } else {
        setSelectedFile(file);
      }
    },
    [jumpTo]
  );

  // Written into the task's code, and the code shown where it changed — without taking the keyboard off the slider.
  const handleLimitsChange = useCallback(
    async (task: ListedTask, cpuMs: number | undefined) => {
      if (task.at && applyEdit(await typescript.setTaskLimits(task.at, withCpu(task.limits, cpuMs)))) {
        jumpTo(task.at, false);
      }
    },
    [applyEdit, jumpTo, typescript]
  );

  const handleAddFile = useCallback((file: string) => {
    setFiles(current => (Object.hasOwn(current, file) ? current : { ...current, [file]: '' }));
    setSelectedFile(file);
  }, []);

  const handleRemoveFile = useCallback(
    (file: string) => {
      setFiles(current => Object.fromEntries(Object.entries(current).filter(([name]) => name !== file)));
      if (selectedFile === file) {
        setSelectedFile('index.ts');
      }
    },
    [selectedFile]
  );

  const handleStart = useCallback(() => {
    setFiles(STARTER_FILES);
    setSelectedFile('index.ts');
  }, []);

  const showResult = useCallback((result: FunctionsSaveResult | undefined) => {
    setProblems(result && !result.ok && 'problems' in result ? result.problems : []);
    setRefusal(result && !result.ok && 'refusal' in result ? result.refusal : undefined);
  }, []);

  /** Saves what changed, and answers whether the draft now holds it — `true` with nothing to save. */
  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!hasFiles || isSaving) {
      return false;
    }

    if (modified.length === 0) {
      return true;
    }

    setIsSaving(true);
    try {
      const result = await save(files);
      showResult(result);

      return result?.ok === true;
    } finally {
      setIsSaving(false);
    }
  }, [files, hasFiles, isSaving, modified.length, save, showResult]);

  const handleSave = useCallback(() => {
    void saveChanges();
  }, [saveChanges]);

  // ⌘S / Ctrl+S saves, as in every editor — and never asks the browser to save the page.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (isSaveKey(event)) {
        event.preventDefault();
        void saveChanges();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [saveChanges]);

  // A run is of the saved draft: what changed is saved first, and a save that fails is why nothing ran.
  const handleRun = useCallback(
    async (task: string, params: Record<string, unknown>): Promise<ActionRunReport | undefined> => {
      if (!(await saveChanges())) {
        throw new Error('Not run: the save did not go through — what it found is shown under the code.');
      }

      return tryTask(task, params);
    },
    [saveChanges, tryTask]
  );

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    try {
      showResult(await install());
    } finally {
      setIsInstalling(false);
    }
  }, [install, showResult]);

  // Back to what was last saved, every file — or to nothing, for functions never saved.
  const handleDiscard = useCallback(async () => {
    const count = modified.length;
    const confirmed = await showDialog(
      <Modal.Header>
        <h4>Discard changes</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="px-3 py-2">
          <h4>
            {`The unsaved changes in ${String(count)} ${count === 1 ? 'file' : 'files'} are lost, and the code goes back to what was last saved. Discard them?`}
          </h4>
        </div>
      </Modal.Body>
    );
    if (confirmed) {
      setFiles(saved);
      setSelectedFile(current => (Object.hasOwn(saved, current) ? current : 'index.ts'));
      setTarget(undefined);
      setAwaited('');
      showResult(undefined);
    }
  }, [modified.length, saved, showDialog, showResult]);

  const handleRemoveAll = useCallback(async () => {
    const confirmed = await showDialog(
      <Modal.Header>
        <h4>Remove Functions</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="px-3 py-2">
          <h4>
            Every step that runs one of their tasks stops working in the builder. The live site keeps the ones it was
            published with until the space is published again. Remove them?
          </h4>
        </div>
      </Modal.Body>
    );
    if (confirmed) {
      await remove();
      showResult(undefined);
    }
  }, [remove, showDialog, showResult]);

  return (
    <div className="flex min-h-0 grow basis-0 flex-col">
      {/* Saving, discarding and the files' state mean nothing before there is code: the welcome is the page. */}
      {hasFiles && (
        <FunctionsHeader
          state={saveState(modified.length, problems.length, Boolean(manifest))}
          canSave={canSave}
          isSaving={isSaving}
          canDiscard={!isSaving && modified.length > 0}
          canRemove={Boolean(manifest)}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onRemove={handleRemoveAll}
        />
      )}
      {error && (
        <div className="px-6 pt-3">
          <Alert intent="error" size="sm" solid={false}>
            {error}
          </Alert>
        </div>
      )}
      {refusal && (
        <div className="px-6 pt-3">
          <Alert intent="warning" size="sm" solid={false}>
            {refusal.error}
          </Alert>
        </div>
      )}
      {!isLoading && !hasFiles && draft?.offer && (
        <FunctionsOffer template={draft.offer.template} isInstalling={isInstalling} onInstall={handleInstall} />
      )}
      {!isLoading && !hasFiles && !draft?.offer && <FunctionsWelcome onStart={handleStart} />}
      {hasFiles && (
        <div className="flex grow basis-0 overflow-hidden">
          <FunctionsSidebar
            tasks={tasks}
            sharedLimits={sharedLimits}
            selectedTask={selectedTask ? taskNameOf(selectedTask) : ''}
            unreadable={source?.unreadable.length ?? 0}
            canCreateTask={typescript.ready && source?.defined === true}
            routes={routes}
            files={names}
            selectedFile={selectedFile}
            modified={modified}
            onSelectTask={handleSelectTask}
            onCreateTask={handleCreateTask}
            onSelectRoute={handleSelectRoute}
            onSelectFile={setSelectedFile}
            onAddFile={handleAddFile}
            onRemoveFile={handleRemoveFile}
          />
          <div className="flex min-w-0 grow basis-0 flex-col overflow-hidden">
            <FunctionsEditor
              file={selectedFile}
              value={files[selectedFile] ?? ''}
              modified={modified.includes(selectedFile)}
              theme={resolvedTheme}
              extensions={extensions}
              checking={typescript.ready}
              target={target}
              onChange={handleChange}
              onCursor={handleCursor}
            />
            {problems.length > 0 && <FunctionsProblems problems={problems} onSelect={handleSelectProblem} />}
          </div>
          {selectedTask && (
            <FunctionInspector
              task={selectedTask}
              sharedLimits={sharedLimits}
              hosts={hosts}
              limitsDisabledReason={limitsBlockedBy(typescript.ready, selectedTask)}
              modified={modified.length > 0}
              onLimitsChange={handleLimitsChange}
              onRun={handleRun}
            />
          )}
          {!selectedTask && <FunctionsGuide hasTasks={tasks.length > 0} />}
        </div>
      )}
    </div>
  );
};

export default Functions;
