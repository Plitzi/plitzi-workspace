import { createRecorder } from '@plitzi/nexus';

import { previewValue } from './preview';
import tracingStore, { MAX_CAUSES, MAX_COMMITS, MAX_TREE_NODES } from './tracingStore';

import type { CommitCause, CommitElementRender, CommitEntry, PropChange, TracingTree } from '../../types';
import type { ProfilerOnRenderCallback } from 'react';

// The standard nexus change-recorder buffers recent store writes. The collector is its primary consumer — it drains
// the writes since the previous commit into each commit's causes — while `tracingMiddleware` feeds it through
// `recordStoreChange`. Typed against an open record so writes from any concrete store (sdk + builder) fit.
const recorder = createRecorder<Record<string, unknown>>({ max: MAX_CAUSES });

// Running, mutable mirror of the store. `onRender` mutates this on the hot path (a Map write per commit). Capture is
// ALWAYS on while instrumentation is live (`debugMode`), so the initial mount commits — which happen at page load,
// before the devtools panel can be opened — are not lost. A batched flush drains the buffer each frame (keeping
// memory bounded) but only writes the immutable snapshot into the store while the tab is open (`viewing`), so a
// closed panel costs nothing in re-renders.
let commits: CommitEntry[] = [];

// Renders of the current frame, bucketed by React's `commitTime` so all elements flushed together become one
// `CommitEntry`. Filled by `onRender`, drained on flush.
const pendingByCommit = new Map<number, CommitEntry>();

// Each INSTANCE's real render-tree parent, registered by `withElement` from the enclosing ElementContext. Captures
// cross-schema nesting (a layout inside a page) that the schema `parentId` alone misses.
const parentOf = new Map<string, string | undefined>();

// Which element each instance is. Registered beside the parent link because React's Profiler hands `onRender` nothing
// but the id it was given, and a list's hundred rows all answer to the same element id — see `CommitElementRender`.
const elementOf = new Map<string, string>();

// Last base duration React reported per element, accumulated across all commits. Together with `parentOf` this is the
// full render tree the viewer needs to reconstruct any commit (including elements that didn't render in it). Mutated
// whenever the structure grows so the published `tree` only needs a fresh object on flush.
const baseOf = new Map<string, number>();
let treeDirty = true;

// The commit each instance first rendered in, and the one that took it away. An instance is part of a commit's tree
// only between the two: without them the tree kept every instance ever mounted, so after a navigation the panel drew
// the previous page beside the current one, and a modal closed under `visible` kept its whole body on screen.
const mountedAt = new Map<string, number>();
const unmountedAt = new Map<string, number>();

// The recorder's seq up to which store writes have already been claimed as a commit's causes. Each new commit drains
// everything recorded since, so it owns exactly the writes that happened since the previous commit — the "why did it
// render" at the data level.
let claimedSeq = 0;

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
    tree[id] = {
      parentId: parentOf.get(id),
      baseDuration,
      elementId: elementOf.get(id) ?? id,
      mountedAt: mountedAt.get(id),
      unmountedAt: unmountedAt.get(id)
    };
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

const forget = (id: string) => {
  parentOf.delete(id);
  elementOf.delete(id);
  baseOf.delete(id);
  mountedAt.delete(id);
  unmountedAt.delete(id);
  treeDirty = true;
};

// An instance that left before the oldest commit still held is in none of them, so nothing can ever draw it again.
const pruneUnmounted = (oldestCommitId: number) => {
  for (const [id, commitId] of unmountedAt) {
    if (commitId <= oldestCommitId) {
      forget(id);
    }
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

    pruneUnmounted(commits[0].commitId);
  }

  if (viewing) {
    writeSnapshot();
  }
};

// Called by `withElement` so the collector knows the real render-tree parent of each instance, and which element the
// instance is — the only place both are known, since React hands `onRender` nothing but the Profiler's id.
const linkParent = (id: string, parentId: string | undefined, elementId: string) => {
  if (!parentOf.has(id) || parentOf.get(id) !== parentId) {
    treeDirty = true;
  }

  // Started over rather than grown forever — see `MAX_TREE_NODES`. The check is a size read, which is what keeps it
  // affordable on a path that runs once per element per render.
  if (parentOf.size >= MAX_TREE_NODES && !parentOf.has(id)) {
    parentOf.clear();
    elementOf.clear();
    baseOf.clear();
    mountedAt.clear();
    unmountedAt.clear();
    treeDirty = true;
  }

  parentOf.set(id, parentId);
  elementOf.set(id, elementId);
};

// Drains every store write recorded since the previous commit into this commit's causes, deduped by path (net change:
// the first write's `prev`, the latest write's `next`). Full-state replaces (no path) are skipped.
const claimCauses = (): CommitCause[] => {
  const entries = recorder.entriesSince(claimedSeq);
  claimedSeq = recorder.lastSeq();
  const byPath = new Map<string, { prev: unknown; next: unknown }>();
  for (const entry of entries) {
    if (entry.path === undefined) {
      continue;
    }

    const existing = byPath.get(entry.path);
    if (existing) {
      existing.next = entry.nextValue;
    } else {
      byPath.set(entry.path, { prev: entry.prevValue, next: entry.nextValue });
    }
  }

  return [...byPath.entries()].map(([path, value]) => ({
    path,
    preview: `${previewValue(value.prev)} → ${previewValue(value.next)}`
  }));
};

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration, _startTime, commitTime) => {
  if (!enabled) {
    enabled = true;
    tracingStore.setState('enabled', true);
  }

  const isNew = !baseOf.has(id);
  baseOf.set(id, baseDuration);

  const changedProps = pendingPropsById.get(id);
  pendingPropsById.delete(id);
  const render: CommitElementRender = {
    id,
    elementId: elementOf.get(id) ?? id,
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
    pendingByCommit.set(commitTime, {
      commitId: commitSeq,
      timestamp: commitTime,
      duration: actualDuration,
      elementCount: 1,
      elements: [render],
      // The store writes recorded since the previous commit are what triggered this one.
      causes: claimCauses()
    });
  }

  if (isNew) {
    mountedAt.set(id, pendingByCommit.get(commitTime)?.commitId ?? commitSeq);
    treeDirty = true;
  }

  if (!flushScheduled) {
    flushScheduled = true;
    schedule(flush);
  }
};

/**
 * Called by `withElement` from an effect, once the instance is on the page.
 *
 * Only undoes a departure: StrictMode runs every effect's cleanup and then the effect again on a live component, and
 * that rehearsal must not leave the instance marked as gone.
 */
const markMounted = (id: string) => {
  if (unmountedAt.delete(id)) {
    treeDirty = true;
  }
};

/**
 * Called by `withElement` from that effect's cleanup, when the instance leaves.
 *
 * Passive cleanups run after the commit that removed the instance has reported its renders — or just before the next
 * one does — so the latest commit id is the commit it is no longer part of.
 */
const markUnmounted = (id: string) => {
  if (!baseOf.has(id)) {
    forget(id);

    return;
  }

  unmountedAt.set(id, commitSeq);
  treeDirty = true;
  if (!flushScheduled) {
    flushScheduled = true;
    schedule(flush);
  }
};

// Called by `withElement` during render (under `debugMode`) with the element's changed inputs vs its previous render.
// Stashed until this element's `onRender` fires in the commit phase and claims it.
const recordProps = (id: string, changes: PropChange[]) => {
  pendingPropsById.set(id, changes);
};

// Called by `tracingMiddleware` with each committed store write; buffered in the recorder the next commit drains.
const recordStoreChange = (change: { path: string | undefined; prevValue: unknown; nextValue: unknown }) => {
  recorder.record(change);
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
  // Skip past everything recorded so far, so the next commit's causes start fresh from the cleared point.
  claimedSeq = recorder.lastSeq();
  pendingPropsById.clear();
  commitSeq = 0;
  // The live part of the tree is kept, so the next commit still nests correctly; what already left goes with the
  // commits that drew it. The numbering starts over, so every instance still here counts as present from the start.
  for (const id of [...unmountedAt.keys()]) {
    forget(id);
  }

  mountedAt.clear();
  treeDirty = true;
  writeSnapshot();
};

/** The id of the last commit recorded, flushed or not: what a caller marks before doing something. */
const lastCommitId = (): number => commitSeq;

/**
 * Every commit after `commitId`, oldest first, including the ones still waiting for this frame's flush — so a test that
 * clicks and then asks sees the renders its click caused without waiting a frame for them.
 *
 * Only what is still held: the oldest commits go once there are `MAX_COMMITS`.
 */
const commitsSince = (commitId: number): CommitEntry[] => {
  const pending = [...pendingByCommit.values()].sort((a, b) => a.timestamp - b.timestamp);

  return [...commits, ...pending].filter(commit => commit.commitId > commitId);
};

/**
 * What the SDK publishes as `window.plitziTracing` while its render tracing is on (`debugMode`): the commits since a
 * mark, for a test to ask which elements an interaction rendered — `inspectRenders` in `@plitzi/sdk-authoring/testing`.
 */
export type TracingReader = {
  lastCommitId: () => number;
  commitsSince: (commitId: number) => CommitEntry[];
};

declare global {
  interface Window {
    /** Present while render tracing is on (`debugMode`) — see {@link TracingReader}. */
    plitziTracing?: TracingReader;
  }
}

const tracingCollector = {
  onRender,
  lastCommitId,
  commitsSince,
  linkParent,
  markMounted,
  markUnmounted,
  recordProps,
  recordStoreChange,
  setHydrated,
  start,
  stop,
  clear
};

export default tracingCollector;
