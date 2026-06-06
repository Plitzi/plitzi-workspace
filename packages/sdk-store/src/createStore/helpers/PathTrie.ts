import Subscribers from './Subscribers';
import parsePath from '../../helpers/parsePath';

import type { Listener, Path } from '../../types';

// Calls `cb` with each prefix of `segments`, from the first segment up to `count` segments long.
const eachPrefix = (segments: readonly string[], count: number, cb: (prefix: string) => void): void => {
  let prefix = '';
  for (let i = 0; i < count; i++) {
    prefix = prefix ? `${prefix}.${segments[i]}` : segments[i];
    cb(prefix);
  }
};

// Index of path subscriptions. `direct` maps each exact path to its listeners. `descendants` maps every proper
// prefix of a registered path to the registered paths beneath it, so a write can find listeners inside the subtree
// it replaced without scanning. Ancestor listeners need no index — a write walks its own short prefix chain.
class PathTrie {
  readonly direct = new Map<string, Subscribers<Listener>>();
  private readonly descendants = new Map<string, Set<string>>();
  size = 0;

  add(path: string, listener: Listener): () => void {
    let subs = this.direct.get(path);
    const segments = parsePath(path);
    if (!subs) {
      subs = new Subscribers<Listener>();
      this.direct.set(path, subs);
      this.size++;
      eachPrefix(segments, segments.length - 1, prefix => {
        let set = this.descendants.get(prefix);
        if (!set) {
          set = new Set();
          this.descendants.set(prefix, set);
        }

        set.add(path);
      });
    }

    subs.add(listener);

    return () => this.remove(path, subs, listener, segments);
  }

  private remove(path: string, subs: Subscribers<Listener>, listener: Listener, segments: readonly string[]): void {
    if (this.direct.get(path) !== subs) {
      return;
    }

    subs.remove(listener);
    if (subs.length > 0) {
      return;
    }

    this.direct.delete(path);
    this.size--;
    eachPrefix(segments, segments.length - 1, prefix => {
      const set = this.descendants.get(prefix);
      if (set) {
        set.delete(path);
        if (set.size === 0) {
          this.descendants.delete(prefix);
        }
      }
    });
  }

  getDescendants(path: string): Set<string> | undefined {
    return this.descendants.get(path);
  }

  // Wakes every listener whose value could change when `changedPath` changes — the exact path, its ancestors (their
  // subtree now holds a new reference) and its descendants. Conservative: it wakes all candidates and leaves the
  // precise diff to the caller (parent→scope forwarding has no before/after to compare). A non-string path means a
  // full-state change, so wake everyone.
  forEachAffected(
    changedPath: Path | undefined,
    cb: (listener: Listener) => void,
    onError?: (error: unknown) => void
  ): void {
    const wake = (subs: Subscribers<Listener> | undefined): void => {
      if (subs) {
        subs.forEach(cb, onError);
      }
    };

    if (typeof changedPath !== 'string') {
      this.direct.forEach(wake);

      return;
    }

    const segments = parsePath(changedPath);
    eachPrefix(segments, segments.length, prefix => wake(this.direct.get(prefix)));
    this.descendants.get(changedPath)?.forEach(path => wake(this.direct.get(path)));
  }

  clear(): void {
    this.direct.clear();
    this.descendants.clear();
    this.size = 0;
  }
}

export default PathTrie;
