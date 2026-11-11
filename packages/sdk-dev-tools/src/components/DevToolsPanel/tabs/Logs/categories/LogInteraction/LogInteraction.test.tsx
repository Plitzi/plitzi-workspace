// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import LogInteraction from './LogInteraction';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type {
  ElementInteraction,
  InteractionFlowParams,
  InteractionNode,
  InteractionNodeStatus
} from '@plitzi/sdk-shared';
import type { ReactElement } from 'react';

const step = (id: string, title: string, afterNode: string, when?: RuleGroup): ElementInteraction => ({
  id,
  title,
  type: id === 'trigger' ? 'trigger' : 'callback',
  action: id === 'trigger' ? 'onClick' : 'setState',
  params: {},
  preview: {},
  elementId: 'button-1',
  beforeNode: '',
  afterNode,
  flowId: 'flow-1',
  enabled: true,
  when
});

const ran = (
  node: ElementInteraction,
  status: InteractionNodeStatus,
  startTime: number,
  endTime: number
): InteractionNode => ({
  node,
  status,
  postCallbacks: [],
  startTime,
  endTime
});

/** A flow is stamped in epoch milliseconds, as the runner does (`pConsole.getTime()`); each time here is `AT + n`. */
const AT = Date.UTC(2026, 10, 11, 10, 0, 1);

const ONLY_SIGNED_IN: RuleGroup = {
  combinator: 'and',
  rules: [{ field: 'auth.signedIn', operator: '=', value: true }]
};

const trigger = step('trigger', 'Add to basket', 'save');

const flow = (status: InteractionFlowParams['status']): InteractionFlowParams => ({
  elementId: 'button-1',
  hostElementId: 'product-card-3',
  startTime: AT,
  endTime: AT + 42,
  status,
  node: trigger,
  nodes: {
    trigger: ran(trigger, 'success', AT, AT + 1),
    save: ran(step('save', 'Save the basket', 'notify', ONLY_SIGNED_IN), 'failed', AT + 1, AT + 30),
    notify: ran(step('notify', 'Tell the visitor', 'track'), 'skipped', AT + 30, AT + 30),
    track: ran(step('track', 'Count it', ''), 'disabled', AT + 30, AT + 30)
  }
});

/** In the panel a log is drawn under the page's store: a step names its element through it. */
const log = (ui: ReactElement) => render(<StoreProvider value={{}}>{ui}</StoreProvider>);

describe('LogInteraction', () => {
  it('sums up a finished flow: how long it took and how many steps failed, were skipped or were off', () => {
    const { container } = log(<LogInteraction time="10:00:01" message="Add to basket" params={flow('failed')} />);

    expect(container.textContent).toContain('42ms');
    expect(screen.getByTitle('Failed').textContent).toBe('1');
    expect(screen.getByTitle('Skipped').textContent).toBe('1');
    expect(screen.getByTitle('Disabled').textContent).toBe('1');
  });

  it('counts nothing skipped in a flow that was skipped whole', () => {
    log(<LogInteraction message="Add to basket" params={flow('skipped')} />);

    expect(screen.queryByTitle('Skipped')).toBeNull();
    expect(screen.queryByTitle('Disabled')).toBeNull();
  });

  it('opens on its execution tree, in the order the steps ran, and shows the step picked with its condition', () => {
    log(<LogInteraction message="Add to basket" params={flow('failed')} />);
    fireEvent.click(screen.getByText('Add to basket'));

    expect(screen.getByText('Execution Tree')).not.toBeNull();
    const order = ['Save the basket', 'Tell the visitor', 'Count it'].map(title => screen.getAllByText(title)[0]);
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    expect(screen.queryByText('Condition')).toBeNull();

    fireEvent.click(screen.getAllByText('Save the basket')[0]);

    expect(screen.getByText('Condition')).not.toBeNull();
    expect(screen.getByText(/auth\.signedIn/)).not.toBeNull();
  });

  it('draws a note about one step as that step and what explains it', () => {
    log(
      <LogInteraction
        time="10:00:02"
        message="No callback named setBasket"
        params={{
          node: step('save', 'Save the basket', ''),
          available: ['setState', 'reset'],
          param: 'path',
          value: { a: 1 }
        }}
      />
    );
    fireEvent.click(screen.getByText('No callback named setBasket'));

    expect(screen.getByText('Save the basket')).not.toBeNull();
    expect(screen.getByText('setState, reset')).not.toBeNull();
    expect(screen.getByText('{"a":1}')).not.toBeNull();
  });

  it('says a step named an element with nothing registered on it, and what was thrown', () => {
    log(<LogInteraction message="A step threw" params={{ available: [], error: 'boom' }} />);
    fireEvent.click(screen.getByText('A step threw'));

    expect(screen.getByText('nothing on that element')).not.toBeNull();
    expect(screen.getByText('boom')).not.toBeNull();
  });
});
