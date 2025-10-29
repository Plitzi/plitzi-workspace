import type { ResourceDirectory } from './ResourcesList';
import type { Resource } from '@plitzi/sdk-shared';

const defaultFolderName = 'All Resources';

const sortDirectories = (a: ResourceDirectory, b: ResourceDirectory) => {
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

  if (a.name === 'Templates' && b.name !== 'Templates') {
    return 1;
  }

  if (b.name === 'Templates' && a.name !== 'Templates') {
    return -1;
  }

  return a.name.localeCompare(b.name);
};

const getDirectories = (
  prefix: string = 'https://cdn.plitzi.com/website/assets/',
  items: Resource[] = []
): ResourceDirectory[] => {
  const directoriesMap: { [key: string]: Resource[] } = { [defaultFolderName]: [], Templates: [], Plugins: [] };

  items.forEach(item => {
    const { id, type } = item;
    if (type === 'plugin') {
      if (!(directoriesMap['Plugins'] as undefined | Resource[])) {
        directoriesMap['Plugins'] = [];
      }

      directoriesMap['Plugins'].push(item);

      return;
    }

    if (type === 'template') {
      if (!(directoriesMap['Templates'] as undefined | Resource[])) {
        directoriesMap['Templates'] = [];
      }

      directoriesMap['Templates'].push(item);

      return;
    }

    const prefixParsed = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;
    const idParsed = id.substring(prefixParsed.length);
    const parts = idParsed.split('/');
    const directoryName = parts.length > 1 ? parts[0] : defaultFolderName;
    if (!(directoriesMap[directoryName] as undefined | Resource[])) {
      directoriesMap[directoryName] = [];
    }

    directoriesMap[directoryName].push(item);
  });

  return Object.entries(directoriesMap)
    .map(([name, items]) => {
      const isDefault = [defaultFolderName, 'Plugins', 'Templates'].includes(name);

      return { name, items, canDrop: !['Plugins', 'Templates'].includes(name), canRemove: !isDefault, isDefault };
    })
    .sort(sortDirectories);
};

export { getDirectories, sortDirectories };
