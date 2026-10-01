import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Card from '@plitzi/plitzi-ui/Card';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Heading from '@plitzi/plitzi-ui/Heading';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import useTheme from '@plitzi/sdk-shared/theme/useTheme';
import AppContext from '@pmodules/App/AppContext';

import FunctionsDeclared from './components/FunctionsDeclared';
import FunctionsFiles from './components/FunctionsFiles';
import FunctionsOffer from './components/FunctionsOffer';
import FunctionsProblems from './components/FunctionsProblems';
import FunctionsTry from './components/FunctionsTry';
import useFunctionsTypeScript from './editor/useFunctionsTypeScript';
import { isSaveKey, saveStatus, STARTER_FILES, taskNameOf } from './helpers';
import useFunctions from './useFunctions';

import type { FunctionsProblem, FunctionsRefusal } from '@plitzi/sdk-shared';

const EMPTY_FILES: Record<string, string> = {};

/**
 * The space's own server code: its files, edited with TypeScript that knows the contract, saved as the draft
 * — built and checked on the platform, problems shown where they are — and tried in the sandbox. The live site runs
 * what the space was last published with. A project's `plitzi functions pull` edits the same files.
 */
const Functions = () => {
  const { functionsWorkerUrl } = use(AppContext);
  const { draft, error, isLoading, save, install, remove, tryTask } = useFunctions();
  const { showDialog } = useModal();
  const { resolvedTheme } = useTheme();
  const saved = draft?.files ?? EMPTY_FILES;
  const [files, setFiles] = useState<Record<string, string>>(EMPTY_FILES);
  const [selected, setSelected] = useState('index.ts');
  const [problems, setProblems] = useState<FunctionsProblem[]>([]);
  const [refusal, setRefusal] = useState<FunctionsRefusal | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  // The task Try is set to — the first one declared until another is picked.
  const [picked, setPicked] = useState('');
  const typescript = useFunctionsTypeScript(functionsWorkerUrl, files);
  const tasks = useMemo(() => draft?.manifest?.tasks ?? [], [draft?.manifest]);
  const tried = tasks.some(task => taskNameOf(task) === picked) ? picked : tasks[0] ? taskNameOf(tasks[0]) : '';

  // The saved files are the starting point every time they change underneath — a save of ours, or one from elsewhere.
  useEffect(() => {
    setFiles(saved);
  }, [saved]);

  const names = useMemo(() => Object.keys(files).sort(), [files]);
  const modified = useMemo(
    () => [...new Set([...names, ...Object.keys(saved)])].filter(file => files[file] !== saved[file]),
    [files, names, saved]
  );
  const extensions = useMemo(() => typescript.extensionsFor(selected), [typescript, selected]);
  const hasFiles = names.length > 0;
  const canSave = !isSaving && hasFiles && modified.length > 0;
  const status = saveStatus(modified.length, Boolean(draft?.manifest));

  const handleChange = useCallback(
    (code: string) => setFiles(current => ({ ...current, [selected]: code })),
    [selected]
  );

  const handleAdd = useCallback((file: string) => {
    setFiles(current => (Object.hasOwn(current, file) ? current : { ...current, [file]: '' }));
    setSelected(file);
  }, []);

  const handleRemoveFile = useCallback(
    (file: string) => {
      setFiles(current => Object.fromEntries(Object.entries(current).filter(([name]) => name !== file)));
      if (selected === file) {
        setSelected('index.ts');
      }
    },
    [selected]
  );

  const handleStart = useCallback(() => {
    setFiles(STARTER_FILES);
    setSelected('index.ts');
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await save(files);
      setProblems(result && !result.ok && 'problems' in result ? result.problems : []);
      setRefusal(result && !result.ok && 'refusal' in result ? result.refusal : undefined);
    } finally {
      setIsSaving(false);
    }
  }, [canSave, files, save]);

  // ⌘S / Ctrl+S saves, as in every editor — and never asks the browser to save the page.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (isSaveKey(event)) {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSave]);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    try {
      const result = await install();
      setProblems(result && !result.ok && 'problems' in result ? result.problems : []);
      setRefusal(result && !result.ok && 'refusal' in result ? result.refusal : undefined);
    } finally {
      setIsInstalling(false);
    }
  }, [install]);

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
      setProblems([]);
      setRefusal(undefined);
    }
  }, [remove, showDialog]);

  return (
    <Card className="relative flex grow basis-0" rounded="none">
      <Card.Body grow className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-2 dark:border-zinc-700">
          <div className="flex min-w-0 flex-col">
            <Heading as="h5">Functions</Heading>
            <span className="text-xs text-gray-500 dark:text-zinc-400">
              The space’s own server code: its tasks are steps in any action, its routes answer under /fn.
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {status && (
              <span
                className={
                  modified.length > 0
                    ? 'text-xs text-amber-700 dark:text-amber-400'
                    : 'text-xs text-gray-500 dark:text-zinc-400'
                }
              >
                {status}
              </span>
            )}
            {draft?.manifest && (
              <Button size="sm" intent="secondary" title="Remove the space’s functions" onClick={handleRemoveAll}>
                <i className="fa-regular fa-trash-can" />
              </Button>
            )}
            <Button size="sm" disabled={!canSave} title="Save — ⌘S" onClick={handleSave}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        {error && <Alert intent="error">{error}</Alert>}
        {refusal && <Alert intent="warning">{refusal.error}</Alert>}
        {!isLoading && !hasFiles && draft?.offer && (
          <FunctionsOffer template={draft.offer.template} isInstalling={isInstalling} onInstall={handleInstall} />
        )}
        {!isLoading && !hasFiles && !draft?.offer && (
          <div className="m-4 flex flex-col items-center gap-3 rounded-sm border-2 border-dashed border-gray-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
            <span>
              When no step does what a flow needs — parse a feed, call an API with its own shape, compute something —
              the space can have its own, in TypeScript, run by Plitzi in a sandbox.
            </span>
            <Button size="sm" onClick={handleStart}>
              Start with an example
            </Button>
          </div>
        )}
        {hasFiles && (
          <div className="flex grow basis-0 overflow-hidden">
            <FunctionsFiles
              files={names}
              selected={selected}
              modified={modified}
              onSelect={setSelected}
              onAdd={handleAdd}
              onRemove={handleRemoveFile}
            />
            <div className="flex grow basis-0 flex-col overflow-hidden">
              <div className="grow basis-0 overflow-auto">
                {/* One editor per file: its own undo history, and nothing typed in one ever lands in another. */}
                <CodeMirror
                  key={selected}
                  mode="ts"
                  theme={resolvedTheme}
                  value={files[selected] ?? ''}
                  extensions={extensions}
                  onChange={handleChange}
                />
              </div>
              {problems.length > 0 && <FunctionsProblems problems={problems} onSelect={setSelected} />}
            </div>
            <div className="flex w-80 shrink-0 flex-col gap-5 overflow-auto border-l border-gray-200 p-3 dark:border-zinc-700">
              <FunctionsTry
                key={tried}
                tasks={tasks}
                task={tried}
                disabledReason={modified.length > 0 ? 'Try runs the saved draft: save your changes first (⌘S).' : ''}
                onTaskChange={setPicked}
                onTry={tryTask}
              />
              {draft?.manifest && <FunctionsDeclared manifest={draft.manifest} selected={tried} onTry={setPicked} />}
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default Functions;
