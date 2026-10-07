import Alert from '@plitzi/plitzi-ui/Alert';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, useEffect, useMemo, useState } from 'react';

import useTheme from '@plitzi/sdk-shared/theme/useTheme';
import { isSaveKey, saveState } from '@pmodules/FileTree';

import DataEditor from './components/DataEditor';
import DataHeader from './components/DataHeader';
import DataProblems from './components/DataProblems';
import DataSidebar from './components/DataSidebar';
import DataWelcome from './components/DataWelcome';
import { jsonProblemOf, STARTER_FILES } from './helpers';
import useData from './useData';

import type { DataProblem, DataRefusal, DataSaveResult } from '@plitzi/sdk-shared';

const EMPTY_FILES: Record<string, string> = {};

/**
 * The space's own data: JSON files its pages read on the server, edited here and saved as the draft — whole, against
 * the copy this panel read, so one saved since from elsewhere (an agent, a project's `plitzi space push`) is never
 * overwritten unseen. The live site reads what the space was last published with.
 */
const Data = () => {
  const { draft, error, isLoading, save } = useData();
  const { showDialog } = useModal();
  const { resolvedTheme } = useTheme();
  const saved = draft?.files ?? EMPTY_FILES;
  const [files, setFiles] = useState<Record<string, string>>(EMPTY_FILES);
  const [selectedFile, setSelectedFile] = useState('');
  const [problems, setProblems] = useState<DataProblem[]>([]);
  const [refusal, setRefusal] = useState<DataRefusal | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // The saved files are the starting point every time they change underneath — a save of ours, or one from elsewhere.
  useEffect(() => {
    setFiles(saved);
  }, [saved]);

  const names = useMemo(() => Object.keys(files).sort(), [files]);
  const modified = useMemo(
    () => [...new Set([...names, ...Object.keys(saved)])].filter(file => files[file] !== saved[file]),
    [files, names, saved]
  );
  const broken = useMemo(() => names.filter(file => jsonProblemOf(files[file]) !== undefined), [files, names]);
  const current = Object.hasOwn(files, selectedFile) ? selectedFile : (names.at(0) ?? '');
  const hasFiles = names.length > 0;
  const hasSaved = Object.keys(saved).length > 0;
  const canSave = !isSaving && modified.length > 0;

  const showResult = useCallback((result: DataSaveResult | undefined) => {
    setProblems(result && !result.ok && 'problems' in result ? result.problems : []);
    setRefusal(result && !result.ok && 'refusal' in result ? result.refusal : undefined);
  }, []);

  const saveChanges = useCallback(async () => {
    if (isSaving || modified.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      showResult(await save(files));
    } finally {
      setIsSaving(false);
    }
  }, [files, isSaving, modified.length, save, showResult]);

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

  const handleChange = useCallback(
    (text: string) => setFiles(previous => ({ ...previous, [current]: text })),
    [current]
  );

  const handleAddFile = useCallback((file: string) => {
    setFiles(previous => (Object.hasOwn(previous, file) ? previous : { ...previous, [file]: '{}\n' }));
    setSelectedFile(file);
  }, []);

  const handleRemoveFile = useCallback(
    (file: string) =>
      setFiles(previous => Object.fromEntries(Object.entries(previous).filter(([name]) => name !== file))),
    []
  );

  const handleStart = useCallback(() => {
    setFiles(STARTER_FILES);
    setSelectedFile(Object.keys(STARTER_FILES)[0]);
  }, []);

  // Back to what was last saved, every file — or to nothing, for data never saved.
  const handleDiscard = useCallback(async () => {
    const count = modified.length;
    const confirmed = await showDialog(
      <Modal.Header>
        <h4>Discard changes</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="px-3 py-2">
          <h4>
            {`The unsaved changes in ${String(count)} ${count === 1 ? 'file' : 'files'} are lost, and the data goes back to what was last saved. Discard them?`}
          </h4>
        </div>
      </Modal.Body>
    );
    if (confirmed) {
      setFiles(saved);
      showResult(undefined);
    }
  }, [modified.length, saved, showDialog, showResult]);

  return (
    <div className="flex min-h-0 grow basis-0 flex-col">
      {/* Saving and discarding mean nothing before there is data, or a change to it: the welcome is the page. */}
      {(hasFiles || hasSaved) && (
        <DataHeader
          state={saveState(modified.length, problems.length, hasSaved)}
          canSave={canSave}
          isSaving={isSaving}
          canDiscard={!isSaving && modified.length > 0}
          onSave={handleSave}
          onDiscard={handleDiscard}
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
      {!isLoading && !hasFiles && !hasSaved && <DataWelcome onStart={handleStart} />}
      {(hasFiles || hasSaved) && (
        <div className="flex grow basis-0 overflow-hidden">
          <DataSidebar
            files={names}
            selectedFile={current}
            modified={modified}
            broken={broken}
            onSelectFile={setSelectedFile}
            onAddFile={handleAddFile}
            onRemoveFile={handleRemoveFile}
          />
          <div className="flex min-w-0 grow basis-0 flex-col overflow-hidden">
            {current && (
              <DataEditor
                file={current}
                value={files[current] ?? ''}
                modified={modified.includes(current)}
                problem={jsonProblemOf(files[current] ?? '')}
                theme={resolvedTheme}
                onChange={handleChange}
              />
            )}
            {!current && (
              <div className="flex grow items-center justify-center p-6 text-sm text-gray-500 dark:text-zinc-400">
                Every file is removed: save to keep the data empty, or discard to bring them back.
              </div>
            )}
            {problems.length > 0 && <DataProblems problems={problems} onSelect={setSelectedFile} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default Data;
