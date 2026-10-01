import { useCallback, useMemo, useState } from 'react';

import { FUNCTION_ROUTES_PREFIX } from '@plitzi/sdk-shared/actions';

import FileItem from './components/FileItem';
import FolderItem from './components/FolderItem';
import NewFile from './components/NewFile';
import NewTask from './components/NewTask';
import RouteItem from './components/RouteItem';
import SidebarSection from './components/SidebarSection';
import TaskItem from './components/TaskItem';
import { cpuOf, fileRows, routeParts, taskNameOf, usualNamespace } from '../../helpers';

import type { NewTask as NewTaskSpec } from '../../editor/source';
import type { ListedRoute, ListedTask } from '../../helpers';
import type { FunctionTimeLimits } from '@plitzi/sdk-shared';

export type FunctionsSidebarProps = {
  tasks: ListedTask[];
  /** What every task gets unless it asks for its own, from `defineFunctions`. */
  sharedLimits?: FunctionTimeLimits;
  selectedTask: string;
  /** Tasks the code builds by calling something: there, but only a save can say what they are. */
  unreadable: number;
  /** Whether a new task can be written for you: the code has been read, and it calls `defineFunctions`. */
  canCreateTask: boolean;
  routes: ListedRoute[];
  files: string[];
  selectedFile: string;
  /** The files whose text differs from what was last saved. */
  modified: string[];
  onSelectTask: (task: string) => void;
  onCreateTask: (task: NewTaskSpec) => void;
  onSelectRoute: (route: string) => void;
  onSelectFile: (file: string) => void;
  onAddFile: (file: string) => void;
  onRemoveFile: (file: string) => void;
};

/**
 * What the functions are, as the code declares them right now: the tasks a step can run — a click from the code and
 * the inspector — the routes they answer at, and the files they are written in.
 */
const FunctionsSidebar = ({
  tasks,
  sharedLimits,
  selectedTask,
  unreadable,
  canCreateTask,
  routes,
  files,
  selectedFile,
  modified,
  onSelectTask,
  onCreateTask,
  onSelectRoute,
  onSelectFile,
  onAddFile,
  onRemoveFile
}: FunctionsSidebarProps) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const rows = useMemo(() => fileRows(files), [files]);

  const handleStartTask = useCallback(() => setIsAddingTask(true), []);

  const handleStopTask = useCallback(() => setIsAddingTask(false), []);

  const handleCreateTask = useCallback(
    (task: NewTaskSpec) => {
      onCreateTask(task);
      setIsAddingTask(false);
    },
    [onCreateTask]
  );

  const handleStartFile = useCallback(() => setIsAddingFile(true), []);

  const handleStopFile = useCallback(() => setIsAddingFile(false), []);

  const handleAddFile = useCallback(
    (file: string) => {
      onAddFile(file);
      setIsAddingFile(false);
    },
    [onAddFile]
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-auto border-r border-gray-200 bg-gray-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <SidebarSection
        title="Tasks"
        count={tasks.length}
        actionTitle="New task"
        onAction={canCreateTask ? handleStartTask : undefined}
      >
        {isAddingTask && (
          <NewTask namespace={usualNamespace(tasks)} onCreate={handleCreateTask} onCancel={handleStopTask} />
        )}
        {tasks.length === 0 && !isAddingTask && (
          <span className="px-1 text-xs text-gray-500 dark:text-zinc-400">
            None yet. Each task is a step any action can run.
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          {tasks.map(task => (
            <TaskItem
              key={taskNameOf(task)}
              name={taskNameOf(task)}
              title={task.title}
              cpu={cpuOf(task, sharedLimits)}
              selected={taskNameOf(task) === selectedTask}
              unsaved={!task.saved}
              onSelect={onSelectTask}
            />
          ))}
        </div>
        {unreadable > 0 && (
          <span className="px-1 text-[11px] text-gray-500 dark:text-zinc-400">
            {`+ ${String(unreadable)} built by a call — listed once saved`}
          </span>
        )}
      </SidebarSection>
      <SidebarSection title="Routes" count={routes.length}>
        {routes.length === 0 && (
          <span className="px-1 text-xs text-gray-500 dark:text-zinc-400">
            {`None. Routes answer HTTP under ${FUNCTION_ROUTES_PREFIX}.`}
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          {routes.map(route => (
            <RouteItem
              key={route.key}
              routeKey={route.key}
              {...routeParts(route.key, FUNCTION_ROUTES_PREFIX)}
              onSelect={onSelectRoute}
            />
          ))}
        </div>
      </SidebarSection>
      <SidebarSection title="Files" count={files.length} actionTitle="New file" onAction={handleStartFile}>
        {isAddingFile && <NewFile onAdd={handleAddFile} onCancel={handleStopFile} />}
        <div className="flex flex-col gap-0.5">
          {rows.map(row => (
            <div key={`${row.kind}:${row.path}`}>
              {row.kind === 'folder' && <FolderItem name={row.path.split('/').pop() ?? row.path} depth={row.depth} />}
              {row.kind === 'file' && (
                <FileItem
                  path={row.path}
                  name={row.name}
                  depth={row.depth}
                  selected={row.path === selectedFile}
                  modified={modified.includes(row.path)}
                  removable={row.path !== 'index.ts'}
                  onSelect={onSelectFile}
                  onRemove={onRemoveFile}
                />
              )}
            </div>
          ))}
        </div>
      </SidebarSection>
    </aside>
  );
};

export default FunctionsSidebar;
