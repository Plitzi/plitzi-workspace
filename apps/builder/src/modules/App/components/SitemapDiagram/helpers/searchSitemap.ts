import type { SitemapEntry } from '../types';

export type SitemapSearch = {
  /** What matched, in the order the map reads. */
  matches: string[];
  /** The matches and every folder above one: what stays lit while the rest dims. */
  visible: Set<string>;
  /** The folders above a match: shown open whatever was folded. */
  ancestors: Set<string>;
};

/** The pages and folders whose name or address holds the query — case aside — and the folders that lead to them. */
const searchSitemap = (entries: SitemapEntry[], query: string): SitemapSearch => {
  const needle = query.trim().toLowerCase();
  const matches: string[] = [];
  const ancestors = new Set<string>();

  const walk = (list: SitemapEntry[], parents: string[]) => {
    for (const entry of list) {
      if (`${entry.title} ${entry.path}`.toLowerCase().includes(needle)) {
        matches.push(entry.id);
        parents.forEach(parent => ancestors.add(parent));
      }

      if (entry.type === 'folder') {
        walk(entry.children, [...parents, entry.id]);
      }
    }
  };

  if (needle) {
    walk(entries, []);
  }

  return { matches, visible: new Set([...matches, ...ancestors]), ancestors };
};

export default searchSitemap;
