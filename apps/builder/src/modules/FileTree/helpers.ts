/**
 * A list of files edited in a panel — the functions' source, the data's JSON: how it reads as a tree, how a save is
 * asked for, and where the files stand.
 */

/** The editor filling the space it is given, so CodeMirror scrolls its own lines and keeps its gutter in place. */
export const EDITOR_CLASS_NAME = { root: 'h-full', inputContainer: 'h-full' };

/** How far a file or a folder is indented for each folder it is in, in pixels. */
export const FILE_INDENT_PX = 12;

/** One row of the file list: a folder, or a file under the folders before it. */
export type FileRow =
  { kind: 'folder'; path: string; depth: number } | { kind: 'file'; path: string; name: string; depth: number };

/**
 * The files as a tree reads, top to bottom: each folder once, before what is in it, and every name indented by how
 * deep it is — `first` before them all, when it is the file everything starts from (the functions' `index.ts`).
 */
export const fileRows = (files: readonly string[], first?: string): FileRow[] => {
  const sorted = [...files].sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
  const seen = new Set<string>();
  const rows: FileRow[] = [];
  for (const path of sorted) {
    const parts = path.split('/');
    parts.slice(0, -1).forEach((_, index) => {
      const folder = parts.slice(0, index + 1).join('/');
      if (!seen.has(folder)) {
        seen.add(folder);
        rows.push({ kind: 'folder', path: folder, depth: index });
      }
    });
    rows.push({ kind: 'file', path, name: parts[parts.length - 1], depth: parts.length - 1 });
  }

  return rows;
};

/** Whether a key press is "save": ⌘S on a Mac, Ctrl+S elsewhere. */
export const isSaveKey = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's';

/** Where the files stand, in a few words and a tone: what the header shows. */
export type SaveState = { label: string; tone: 'unsaved' | 'problems' | 'saved' };

/**
 * Where the files stand: what the last save found wrong, changes not saved yet — in how many files — or saved, which is
 * what the builder runs. Nothing for files never saved.
 */
export const saveState = (modified: number, problems: number, saved: boolean): SaveState | undefined => {
  if (problems > 0) {
    return { label: `${String(problems)} ${problems === 1 ? 'problem' : 'problems'} · not saved`, tone: 'problems' };
  }

  if (modified > 0) {
    return { label: `Unsaved · ${String(modified)} ${modified === 1 ? 'file' : 'files'}`, tone: 'unsaved' };
  }

  return saved ? { label: 'Saved', tone: 'saved' } : undefined;
};
