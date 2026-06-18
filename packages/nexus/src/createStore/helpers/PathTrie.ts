import Subscribers from './Subscribers';
import parsePath from '../../helpers/parsePath';

import type { Listener, Path } from '../../types';

class TrieNode {
  subscribers: Subscribers<Listener> | null = null;
  children: Map<string, TrieNode> | null = null;
}

// Index of path subscriptions. Uses a segment-based trie for O(depth) ancestor traversal (avoiding prefix string
// allocation per ancestor), plus a `direct` map and a `descendants` map for the remaining access patterns.
class PathTrie {
  readonly direct = new Map<string, Subscribers<Listener>>();
  private readonly descendants = new Map<string, Set<string>>();
  private readonly root = new TrieNode();
  size = 0;

  add(path: string, listener: Listener): () => void {
    const segments = parsePath(path);
    let subs = this.direct.get(path);
    if (!subs) {
      subs = new Subscribers<Listener>();
      this.direct.set(path, subs);

      // Populate trie — walk existing nodes or create as needed, then attach subs at the leaf.
      let node = this.root;
      for (const seg of segments) {
        if (!node.children) {
          node.children = new Map();
        }

        let child = node.children.get(seg);
        if (!child) {
          child = new TrieNode();
          node.children.set(seg, child);
        }

        node = child;
      }

      node.subscribers = subs;

      // Populate descendants index — every proper prefix gains this path.
      this.size++;
      let prefix = '';
      for (let i = 0; i < segments.length - 1; i++) {
        prefix = prefix ? `${prefix}.${segments[i]}` : segments[i];
        let set = this.descendants.get(prefix);
        if (!set) {
          set = new Set();
          this.descendants.set(prefix, set);
        }

        set.add(path);
      }
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

    // Clean up trie leaf — detach subscribers without pruning child branches (other paths may share them).
    let node = this.root;
    for (const seg of segments) {
      if (!node.children) {
        return;
      }

      const next = node.children.get(seg);
      if (!next) {
        return;
      }

      node = next;
    }

    if (node.subscribers === subs) {
      node.subscribers = null;
    }

    // Clean up descendants index — every proper prefix loses this path.
    let prefix = '';
    for (let i = 0; i < segments.length - 1; i++) {
      prefix = prefix ? `${prefix}.${segments[i]}` : segments[i];
      const set = this.descendants.get(prefix);
      if (set) {
        set.delete(path);
        if (set.size === 0) {
          this.descendants.delete(prefix);
        }
      }
    }
  }

  // Walk ancestors of the given segments in the trie, calling `cb` for each node that has subscribers. Callers
  // treat the returned Subscribers object as read-only during iteration.
  walkAncestors(segments: readonly string[], cb: (subs: Subscribers<Listener>) => void): void {
    let node = this.root;
    for (const seg of segments) {
      if (!node.children) {
        return;
      }

      const next = node.children.get(seg);
      if (!next) {
        return;
      }

      node = next;
      if (node.subscribers) {
        cb(node.subscribers);
      }
    }
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
    this.walkAncestors(segments, wake);
    this.descendants.get(changedPath)?.forEach(path => wake(this.direct.get(path)));
  }

  clear(): void {
    this.direct.clear();
    this.descendants.clear();
    this.root.children = null;
    this.root.subscribers = null;
    this.size = 0;
  }
}

export default PathTrie;
