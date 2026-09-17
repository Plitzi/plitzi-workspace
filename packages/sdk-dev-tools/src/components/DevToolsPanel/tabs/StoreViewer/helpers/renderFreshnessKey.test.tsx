// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import JsonView from '@uiw/react-json-view';
import { describe, expect, it } from 'vitest';

import renderFreshnessKey from './renderFreshnessKey';

import type { PathFreshness } from '@plitzi/nexus';

const NOW = 10_000;

const at = (updatedAt: number, ttl: number): PathFreshness => ({ updatedAt, expiresAt: updatedAt + ttl, ttl });

const tree = (records: Record<string, PathFreshness>, now = NOW) =>
  render(
    <JsonView value={{ queries: { orders: { rows: [1] } }, session: { id: 'a' } }} collapsed={false}>
      <JsonView.KeyName render={renderFreshnessKey(records, now)} />
    </JsonView>
  );

describe('renderFreshnessKey', () => {
  it('counts down on the path that was written with a ttl, and on nothing else', () => {
    tree({ 'queries.orders': at(NOW - 12_000, 30_000) });

    expect(screen.getByText('18s left')).toBeTruthy();
    // A record answers for its whole subtree, but the subtree is not what somebody gave a ttl.
    expect(screen.queryAllByText(/left|stale/)).toHaveLength(1);
  });

  it('says so once the path is no longer current', () => {
    tree({ 'session.id': at(NOW - 60_000, 30_000) });

    expect(screen.getByText('stale')).toBeTruthy();
  });

  it('leaves every other key to the viewer itself', () => {
    const { container } = tree({});

    expect(container.textContent).toContain('queries');
    expect(screen.queryByText(/left|stale/)).toBeNull();
  });
});
