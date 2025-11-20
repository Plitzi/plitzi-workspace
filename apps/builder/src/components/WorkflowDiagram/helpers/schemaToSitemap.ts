import type { Template } from '../WorkflowDiagram';
import type { Element, PageFolder } from '@plitzi/sdk-shared';

export type ElementPage = Element<{
  folder: string;
  name: string;
  slug: string;
  accessLevel?: 'none' | 'authenticated' | 'public';
  seoPageDescription: string;
}>;

const schemaToSitemap = (pages: ElementPage[], folders: PageFolder[]) => {
  const children = new Map<string, ({ type: 'folder'; data: PageFolder } | { type: 'page'; data: ElementPage })[]>();

  // Index folders
  for (const folder of folders) {
    const parent = folder.parentId || '';
    if (!children.has(parent)) {
      children.set(parent, []);
    }

    children.get(parent)?.push({ type: 'folder', data: folder });
  }

  // Index pages per folder
  for (const page of Object.values(pages)) {
    const folder = page.attributes.folder || '';
    if (!children.has(folder)) {
      children.set(folder, []);
    }

    children.get(folder)?.push({ type: 'page', data: page });
  }

  // Sort children by name
  for (const list of children.values()) {
    list.sort((a, b) => {
      const A = a.type === 'page' ? a.data.attributes.name : a.data.name;
      const B = b.type === 'page' ? b.data.attributes.name : b.data.name;

      return A.localeCompare(B);
    });
  }

  const walk = (folderId: string, folderPath = '') => {
    const items = children.get(folderId) || [];
    const result: Template['nodes'] = [];

    for (const item of items) {
      if (item.type === 'page') {
        const { id, attributes: { name = 'Page', slug = '', accessLevel = 'public', seoPageDescription = '' } = {} } =
          item.data;
        const path = `${folderPath}/${slug.replace(/^\//, '')}`;
        result.push({ id, type: 'page', title: name, path, accessLevel, description: seoPageDescription });
      }

      if (item.type === 'folder') {
        const { id, name, slug } = item.data;
        const path = `${folderPath}/${slug.replace(/^\//, '')}`;

        result.push({
          id,
          type: 'folder',
          title: name,
          path,
          accessLevel: 'none',
          description: '',
          children: walk(id, path)
        });
      }
    }

    return result;
  };

  return walk('');
};

export default schemaToSitemap;
