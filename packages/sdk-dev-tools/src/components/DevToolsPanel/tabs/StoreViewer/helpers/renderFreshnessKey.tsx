import FreshnessMark from '../components/FreshnessMark';

import type { PathFreshness } from '@plitzi/nexus';
import type JsonView from '@uiw/react-json-view';
import type { ComponentProps, HTMLAttributes } from 'react';

/** Taken from the component rather than from a type the package does not export at its root. */
export type FreshnessKeyRenderer = NonNullable<ComponentProps<typeof JsonView.KeyName>['render']>;

/**
 * The tree's key names, with a countdown on the paths that have one.
 *
 * Only the path a record was written AT is marked, never the ones it covers: a record answers for its whole subtree,
 * so marking those too would say that every field under a cached answer had a TTL of its own. Returning nothing
 * leaves the key to the viewer's own renderer, which is every path nobody gave a `ttl`.
 */
const renderFreshnessKey =
  (records: Readonly<Partial<Record<string, PathFreshness>>>, now: number): FreshnessKeyRenderer =>
  (props, { keys }) => {
    const record = records[(keys ?? []).join('.')];
    if (!record) {
      return null;
    }

    // The package types this argument as the element's whole spec — `as` and `render` included — while what it hands
    // over is the key's own rendered props. Only the three it really carries are read.
    const { className, style, children } = props as HTMLAttributes<HTMLSpanElement>;

    return (
      <>
        <span className={className} style={style}>
          {children}
        </span>
        <FreshnessMark record={record} now={now} />
      </>
    );
  };

export default renderFreshnessKey;
