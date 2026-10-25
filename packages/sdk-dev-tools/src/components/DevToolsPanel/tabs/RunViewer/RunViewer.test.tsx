// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import RunViewer from './RunViewer';

import type { RunSnapshot } from '@plitzi/sdk-shared/runs';

const snapshot: RunSnapshot = {
  runId: 'shop-copy',
  goal: 'A copy of the site',
  status: 'open',
  done: 1,
  total: 2,
  at: '2026-10-20T21:30:00.000Z',
  tasks: [
    {
      id: 't-home',
      title: 'The home',
      role: 'developer',
      status: 'done',
      round: 1,
      files: ['src/space/pages/home.ts']
    },
    {
      id: 't-tier',
      title: 'The tier list',
      role: 'developer',
      status: 'pending',
      round: 0,
      files: ['src/space/pages/tier-list.ts'],
      why: 'starts once t-fights is approved'
    },
    {
      id: 't-fights',
      title: 'The fights',
      role: 'developer',
      status: 'in-review',
      agent: 'dev-2',
      reviewer: 'lead-2',
      round: 0,
      files: ['src/space/pages/combates.ts']
    }
  ],
  attention: [{ text: 't-fights asks (m3): which order?', who: 'lead' }],
  agents: [
    {
      agent: 'dev-2',
      kind: 'agent',
      status: 'in-review',
      model: 'claude-sonnet-5-5',
      doing: 't-fights waits for its review'
    }
  ],
  feed: [{ at: '2026-10-20T21:29:00.000Z', by: 'lead-2', text: 'approved t-home', kind: 'review' }]
};

describe('the Run tab', () => {
  it('shows the run behind the preview: each task, who has it and who reviews it, and what needs someone', () => {
    render(<RunViewer snapshot={snapshot} />);

    expect(screen.getByText(/1 of 2 tasks approved/)).toBeTruthy();
    expect(screen.getByText('dev-2 · reviewed by lead-2')).toBeTruthy();
    expect(screen.getByText(/which order\?/)).toBeTruthy();
    expect(screen.getByText('In review')).toBeTruthy();
    expect(screen.getByText('t-fights waits for its review')).toBeTruthy();
    expect(screen.getByText('approved t-home')).toBeTruthy();

    // One list, by where each stands: what moves first, the approved last.
    const titles = screen.getAllByText(/^The (home|fights)$/).map(node => node.textContent);
    expect(titles).toEqual(['The fights', 'The home']);
    expect(screen.getByText('Approved')).toBeTruthy();
    // Why a task waits is said on its row.
    expect(screen.getByText('starts once t-fights is approved')).toBeTruthy();

    // Opened, a task says the files it writes.
    fireEvent.click(screen.getByText('The fights'));
    expect(screen.getByText('src/space/pages/combates.ts')).toBeTruthy();
  });

  it('groups a task finding something out apart, saying what — and marks the urgent ones', () => {
    render(
      <RunViewer
        snapshot={{
          ...snapshot,
          tasks: [
            ...snapshot.tasks,
            {
              id: 't-artist',
              title: 'The artist page',
              role: 'developer',
              status: 'spike',
              agent: 'dev-1',
              round: 0,
              files: ['src/space/pages/artista.ts'],
              why: 'dev-1 finds out: which layers make the original’s light',
              urgency: 'high'
            }
          ]
        }}
      />
    );

    expect(screen.getByText('Finding out')).toBeTruthy();
    expect(screen.getByText('dev-1 finds out: which layers make the original’s light')).toBeTruthy();
    expect(screen.getByTitle('high: its priority, or that of a task waiting on it').textContent).toBe('!');
  });

  it('says there is none on a server that previews no run', () => {
    render(<RunViewer />);

    expect(screen.getByText(/No run of agents behind this page/)).toBeTruthy();
  });
});
