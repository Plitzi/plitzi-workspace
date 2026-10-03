import type { ResourceDirectory } from './ResourcesList';
import type { CdnVisibility, Resource } from '@plitzi/sdk-shared';

const defaultFolderName = 'All Resources';

/** A private bucket's server code — the space's functions and runtime — kept by saves and pushes, not by hand. */
const serverCodeFolderName = 'Server code';

const sortDirectories = (a: ResourceDirectory, b: ResourceDirectory) => {
  if (a.name === serverCodeFolderName || b.name === serverCodeFolderName) {
    return a.name === serverCodeFolderName ? 1 : -1;
  }

  if (a.name === defaultFolderName) {
    return -1;
  }

  if (b.name === defaultFolderName) {
    return 1;
  }

  if (a.name === 'Plugins' && b.name !== 'Plugins') {
    return 1;
  }

  if (b.name === 'Plugins' && a.name !== 'Plugins') {
    return -1;
  }

  if (a.name === 'Snippets' && b.name !== 'Snippets') {
    return 1;
  }

  if (b.name === 'Snippets' && a.name !== 'Snippets') {
    return -1;
  }

  return a.name.localeCompare(b.name);
};

/** A private bucket takes no upload, so it opens on its server code alone; a public one on where uploads go. */
const foldersShownFor = (visibility: CdnVisibility): { [key: string]: Resource[] } =>
  visibility === 'private' ? { [serverCodeFolderName]: [] } : { [defaultFolderName]: [], Snippets: [], Plugins: [] };

/** Plugins, server code and snippets have folders of their own; anything else goes where its path puts it. */
const FOLDER_OF_TYPE: Partial<Record<Resource['type'], string>> = {
  plugin: 'Plugins',
  server: serverCodeFolderName,
  snippet: 'Snippets'
};

const getDirectories = (
  prefix: string = 'https://cdn.plitzi.com/website/assets/',
  items: Resource[] = [],
  visibility: CdnVisibility = 'public'
): ResourceDirectory[] => {
  const directoriesMap = new Map(Object.entries(foldersShownFor(visibility)));
  const addTo = (folder: string, item: Resource): void => {
    directoriesMap.set(folder, [...(directoriesMap.get(folder) ?? []), item]);
  };

  const prefixParsed = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;
  items.forEach(item => {
    const folder = FOLDER_OF_TYPE[item.type];
    if (folder) {
      addTo(folder, item);

      return;
    }

    const parts = item.id.substring(prefixParsed.length).split('/');
    addTo(parts.length > 1 ? parts[0] : defaultFolderName, item);
  });

  return [...directoriesMap.entries()]
    .map(([name, items]) => {
      const isDefault = [defaultFolderName, 'Plugins', 'Snippets', serverCodeFolderName].includes(name);

      return {
        name,
        items,
        canDrop: !['Plugins', 'Snippets', serverCodeFolderName].includes(name),
        canRemove: !isDefault,
        isDefault
      };
    })
    .sort(sortDirectories);
};

export { getDirectories, sortDirectories };
