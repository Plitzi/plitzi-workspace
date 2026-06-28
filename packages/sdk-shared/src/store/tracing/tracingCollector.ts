import tracingStore, { MAX_COMMITS } from './tracingStore';

import type { CommitCause, CommitElementRender, CommitEntry, PropChange, TracingTree } from '../../types';
import type { ProfilerOnRenderCallback } from 'react';

// Running, mutable mirror of the store. `onRender` mutates this on the hot path (a Map write per commit). Capture is
// ALWAYS on while instrumentation is live (`debugMode`), so the initial mount commits — which happen at page load,
// before the devtools panel can be opened — are not lost. A batched flush drains the buffer each frame (keeping
// memory bounded) but only writes the immutable snapshot into the store while the tab is open (`viewing`), so a
// closed panel costs nothing in re-renders.
let commits: CommitEntry[] = [];

// Renders of the current frame, bucketed by React's `commitTime` so all elements flushed together become one
// `CommitEntry`. Filled by `onRender`, drained on flush.
const pendingByCommit = new Map<number, CommitEntry>();

// Each element's real render-tree parent, registered by `withElement` from the enclosing ElementContext. Captures
// cross-schema nesting (a layout inside a page) that the schema `parentId` alone misses.
const parentOf = new Map<string, string | undefined>();

// Last base duration React reported per element, accumulated across all commits. Together with `parentOf` this is the
// full render tree the viewer needs to reconstruct any commit (including elements that didn't render in it). Mutated
// whenever the structure grows so the published `tree` only needs a fresh object on flush.
const baseOf = new Map<string, number>();
let treeDirty = true;

// Store writes recorded since the last commit, fed by `recordChange` (the viewer wires this to nexus `subscribeChange`).
// The next commit claims them as its `causes` — the "why did it render" at the data level — then the buffer resets.
let pendingCauses: CommitCause[] = [];
const MAX_CAUSES = 30;

// Per-element changed-input diffs reported by `withElement` during the render phase, keyed by element id. Each commit's
// `onRender` (which fires afterwards, in the commit phase) claims its element's entry, so the viewer can answer "which
// prop changed" per element. Set every render in `debugMode`; an empty array means the element re-rendered with none of
// its tracked inputs changed (i.e. driven by an ancestor/context) — the unnecessary-re-render signal.
const pendingPropsById = new Map<string, PropChange[]>();

let enabled = false;
let viewing = false;
let commitSeq = 0;
let flushScheduled = false;
// Whether the app was hydrated from SSR output (set once by the SDK on the `hydrateRoot` path). The viewer needs this
// to tell a real hydration commit from a pure client initial mount — both report React phase `mount`.
let hydrated = false;

const schedule = (() => {
  if (typeof requestAnimationFrame === 'function') {
    return (cb: () => void): void => {
      requestAnimationFrame(cb);
    };
  }

  return (cb: () => void): void => {
    setTimeout(cb, 16);
  };
})();

const buildTree = (): TracingTree => {
  const tree: TracingTree = {};
  for (const [id, baseDuration] of baseOf) {
    tree[id] = { parentId: parentOf.get(id), baseDuration };
  }

  return tree;
};

const writeSnapshot = () => {
  if (treeDirty) {
    treeDirty = false;
    tracingStore.setState('tree', buildTree());
  }

  tracingStore.setState('hydrated', hydrated);
  tracingStore.setState('commits', commits);
};

// Called once by the SDK when it hydrates SSR output (`hydrateRoot`). Published so the viewer can label the first
// mount commit as a hydration (vs an ordinary client mount). Always recorded; only written to the store while viewing.
const setHydrated = () => {
  if (hydrated) {
    return;
  }

  hydrated = true;
  if (viewing) {
    tracingStore.setState('hydrated', true);
  }
};

const flush = () => {
  flushScheduled = false;
  if (pendingByCommit.size > 0) {
    const finalized = [...pendingByCommit.values()].sort((a, b) => a.timestamp - b.timestamp);
    pendingByCommit.clear();

    commits = [...commits, ...finalized];
    if (commits.length > MAX_COMMITS) {
      commits = commits.slice(commits.length - MAX_COMMITS);
    }
  }

  if (viewing) {
    writeSnapshot();
  }
};

// Called by `withElement` so the collector knows the real render-tree parent of each element.
const linkParent = (id: string, parentId: string | undefined) => {
  if (!parentOf.has(id) || parentOf.get(id) !== parentId) {
    treeDirty = true;
  }

  parentOf.set(id, parentId);
};

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration, _startTime, commitTime) => {
  if (!enabled) {
    enabled = true;
    tracingStore.setState('enabled', true);
  }

  if (!baseOf.has(id)) {
    treeDirty = true;
  }

  baseOf.set(id, baseDuration);

  const changedProps = pendingPropsById.get(id);
  pendingPropsById.delete(id);
  const render: CommitElementRender = {
    id,
    parentId: parentOf.get(id),
    phase,
    actualDuration,
    baseDuration,
    changedProps
  };
  const bucket = pendingByCommit.get(commitTime);
  if (bucket) {
    bucket.elements.push(render);
    bucket.elementCount += 1;
    bucket.duration = Math.max(bucket.duration, actualDuration);
  } else {
    commitSeq += 1;
    // The store writes buffered since the previous commit are what triggered this one.
    const causes = pendingCauses;
    pendingCauses = [];
    pendingByCommit.set(commitTime, {
      commitId: commitSeq,
      timestamp: commitTime,
      duration: actualDuration,
      elementCount: 1,
      elements: [render],
      causes
    });
  }

  if (!flushScheduled) {
    flushScheduled = true;
    schedule(flush);
  }
};

// Called by the viewer's nexus `subscribeChange` subscription: a store path was just written, so the upcoming commit
// (if any) was caused by it. The path plus a compact `prev → next` preview is kept; duplicate paths within a batch
// collapse (the last preview wins, so the cause shows the net change).
const recordChange = (path: string | undefined, preview?: string) => {
  if (!viewing || path === undefined) {
    return;
  }

  const existing = pendingCauses.find(cause => cause.path === path);
  if (existing) {
    existing.preview = preview;

    return;
  }

  pendingCauses.push({ path, preview });
  if (pendingCauses.length > MAX_CAUSES) {
    pendingCauses.shift();
  }
};

// Called by `withElement` during render (under `debugMode`) with the element's changed inputs vs its previous render.
// Stashed until this element's `onRender` fires in the commit phase and claims it.
const recordProps = (id: string, changes: PropChange[]) => {
  pendingPropsById.set(id, changes);
};

// Called when the Tracing tab mounts: start streaming to the store and immediately publish whatever was captured
// before the panel opened (e.g. the page's initial mounts).
const start = () => {
  viewing = true;
  flush();
  writeSnapshot();
};

const stop = () => {
  viewing = false;
};

const clear = () => {
  commits = [];
  pendingByCommit.clear();
  pendingCauses = [];
  pendingPropsById.clear();
  commitSeq = 0;
  // The accumulated tree (parentOf/baseOf) is intentionally kept: clearing only the commits resets the timeline while
  // preserving the known structure, so the next commit still nests correctly. Only re-publish the (unchanged) tree.
  treeDirty = true;
  writeSnapshot();
};

const tracingCollector = { onRender, linkParent, recordChange, recordProps, setHydrated, start, stop, clear };

export default tracingCollector;
