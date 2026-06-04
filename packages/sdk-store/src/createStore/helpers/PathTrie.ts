import parsePath from '../../helpers/parsePath';

import type { Listener, Path } from '../../types';

class PathTrie {
  readonly direct: Map<string, Listener[]> = new Map();
  private descendantIndex: Map<string, Set<string>> = new Map();
  private pathPrefixes: Map<string, string[]> = new Map();
  size = 0;

  get(path: string): Listener[] | undefined {
    return this.direct.get(path);
  }

  has(path: string): boolean {
    return this.direct.has(path);
  }

  add(path: string, listener: Listener): () => void {
    let arr = this.direct.get(path);
    if (!arr) {
      arr = [];
      this.direct.set(path, arr);
      this.size++;
    }

    arr.push(listener);

    const segments = parsePath(path);
    let prefix = '';
    for (let i = 0; i < segments.length - 1; i++) {
      prefix = prefix ? `${prefix}.${segments[i]}` : segments[i];
      let set = this.descendantIndex.get(prefix);
      if (!set) {
        set = new Set();
        this.descendantIndex.set(prefix, set);
      }
      set.add(path);
    }

    if (segments.length > 1) {
      const prefixes: string[] = [];
      let p = '';
      for (let i = 0; i < segments.length; i++) {
        p = p ? `${p}.${segments[i]}` : segments[i];
        prefixes.push(p);
      }
      this.pathPrefixes.set(path, prefixes);
    }

    return () => {
      const idx = arr.indexOf(listener);
      if (idx !== -1) {
        const last = arr.pop();
        if (idx < arr.length) {
          arr[idx] = last as Listener;
        }

        if (arr.length === 0 && this.direct.get(path) === arr) {
          this.direct.delete(path);
          this.size--;
          let prefix = '';
          for (let i = 0; i < segments.length - 1; i++) {
            prefix = prefix ? `${prefix}.${segments[i]}` : segments[i];
            const set = this.descendantIndex.get(prefix);
            if (set) {
              set.delete(path);
              if (set.size === 0) {
                this.descendantIndex.delete(prefix);
              }
            }
          }
          this.pathPrefixes.delete(path);
        }
      }
    };
  }

  forEach(cb: (listeners: Listener[], path: string) => void): void {
    this.direct.forEach(cb);
  }

  forEachAffected(changedPath: Path | undefined, cb: (listener: Listener) => void): void {
    if (changedPath === undefined || typeof changedPath !== 'string') {
      this.direct.forEach(arr => {
        for (let i = 0; i < arr.length; i++) {
          cb(arr[i]);
        }
      });

      return;
    }

    const descendants = this.descendantIndex.get(changedPath);
    if (descendants) {
      for (const descendant of descendants) {
        const arr = this.direct.get(descendant);
        if (arr) {
          for (let i = 0; i < arr.length; i++) {
            cb(arr[i]);
          }
        }
      }
    }

    const arr = this.direct.get(changedPath);
    if (arr) {
      for (let i = 0; i < arr.length; i++) {
        cb(arr[i]);
      }
    }
  }

  getPrefixes(path: string): string[] | undefined {
    return this.pathPrefixes.get(path);
  }

  getDescendants(path: string): Set<string> | undefined {
    return this.descendantIndex.get(path);
  }

  clear(): void {
    this.direct.clear();
    this.descendantIndex.clear();
    this.pathPrefixes.clear();
    this.size = 0;
  }
}

export default PathTrie;
