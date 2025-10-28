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
  const directoriesMap: { [key: string]: Resource[] } = {};

  items.forEach(item => {
    const { id, type } = item;
    if (id.startsWith(prefix) && !['plugin', 'template'].includes(type)) {
      const pathAfterPrefix = id.substring(prefix.length);
      const parts = pathAfterPrefix.split('/');
      const directoryName = parts.length > 1 ? parts[0] : defaultFolderName;

      if (!(directoriesMap[directoryName] as undefined | Resource[])) {
        directoriesMap[directoryName] = [];
      }

      directoriesMap[directoryName].push(item);
    } else if (type === 'plugin') {
      if (!(directoriesMap['Plugins'] as undefined | Resource[])) {
        directoriesMap['Plugins'] = [];
      }

      directoriesMap['Plugins'].push(item);
    } else if (type === 'template') {
      if (!(directoriesMap['Templates'] as undefined | Resource[])) {
        directoriesMap['Templates'] = [];
      }

      directoriesMap['Templates'].push(item);
    } else {
      if (!(directoriesMap[defaultFolderName] as undefined | Resource[])) {
        directoriesMap[defaultFolderName] = [];
      }

      directoriesMap[defaultFolderName].push(item);
    }
  });

  return Object.entries(directoriesMap)
    .map(([name, items]) => ({ name, items, canDrop: !['Plugins', 'Templates'].includes(name) }))
    .sort(sortDirectories);
};

const formatFolderName = (name: string = '', toHuman = true): string => {
  if (!name) {
    return '';
  }

  if (toHuman) {
    return name
      .split('/')
      .map(segment => {
        if (!segment) {
          return '';
        }

        const segmentParsed = segment
          .replace(/[_-]+/g, ' ')
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/([A-Z]+)([A-Z][a-z0-9])/g, '$1 $2')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .toLowerCase();

        return segmentParsed.charAt(0).toUpperCase() + segmentParsed.slice(1);
      })
      .join('/');
  }

  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-/]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .replace(/\/+/g, '/')
    .toLowerCase();
};

export { getDirectories, sortDirectories, formatFolderName };
