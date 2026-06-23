import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';

import withElement from './withElement';
import useElement from '../hooks/useElement';

import type { ElementContextValue } from '../ElementContext';
import type { Element } from '@plitzi/sdk-shared';
import type { ReactElement, ReactNode } from 'react';

const setElementState = vi.fn();

const definition: Element['definition'] = {
  rootId: 'root',
  label: 'L',
  type: 'text',
  styleSelectors: { base: 'el1' }
};

vi.mock('@plitzi/sdk-event-bridge/hooks/useEventBridge', () => ({ default: vi.fn() }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({ settings: { previewMode: true }, root: { baseElementId: 'root' } })
}));

vi.mock('../hooks/useElementInternal', () => ({
  default: ({ children }: { children?: unknown }) => ({
    internalProps: {
      id: 'el1',
      rootId: 'root',
      attributes: { text: 'hello' },
      definition,
      style: { color: 'red' },
      elementState: { foo: 'bar' },
      plitziElementLayout: undefined,
      setElementState
    },
    customProps: { customX: 'CX' },
    children: children ?? 'resolvedChild'
  })
}));

type ProbeProps = { id: string; text?: string; customX?: string; extraX?: string; children?: ReactNode };

const captured: { props?: ProbeProps; ctx?: ElementContextValue } = {};

const Probe = (props: ProbeProps) => {
  captured.props = props;
  captured.ctx = useElement();

  return (
    <div data-testid="probe">
      {props.text}
      {props.children}
    </div>
  );
};

const Wrapped = withElement(Probe);

const renderWrapped = (ui: ReactElement) => render(ui);

describe('withElement', () => {
  beforeEach(() => {
    captured.props = undefined;
    captured.ctx = undefined;
    vi.clearAllMocks();
  });

  it('injects element attributes, extraProps and customProps into the wrapped component', () => {
    renderWrapped(<Wrapped internalProps={{ id: 'el1', rootId: 'root' }} extraProps={{ extraX: 'EX' }} />);

    expect(captured.props?.text).toBe('hello');
    expect(captured.props?.extraX).toBe('EX');
    expect(captured.props?.customX).toBe('CX');
  });

  it('provides the full element context (identity + resolved data + setElementState)', () => {
    renderWrapped(<Wrapped internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(captured.ctx?.id).toBe('el1');
    expect(captured.ctx?.rootId).toBe('root');
    expect(captured.ctx?.attributes).toEqual({ text: 'hello' });
    expect(captured.ctx?.definition).toBe(definition);
    expect(captured.ctx?.style).toEqual({ color: 'red' });
    expect(captured.ctx?.elementState).toEqual({ foo: 'bar' });
    expect(captured.ctx?.setElementState).toBe(setElementState);
  });

  it('registers a `${id}_setState` callback on the element event bridge', () => {
    renderWrapped(<Wrapped internalProps={{ id: 'el1', rootId: 'root' }} />);

    const [channel, callbacks] = vi.mocked(useEventBridge).mock.calls[0];

    expect(channel).toBe('element');
    expect(typeof (callbacks as Record<string, unknown>).el1_setState).toBe('function');
  });

  it('passes resolved children through to the wrapped component', () => {
    const { getByText } = renderWrapped(
      <Wrapped internalProps={{ id: 'el1', rootId: 'root' }}>
        <span>child-node</span>
      </Wrapped>
    );

    expect(getByText('child-node')).toBeTruthy();
  });

  it('short-circuits the heavy path under plitziJsxSkipHOC and only exposes identity context', () => {
    renderWrapped(<Wrapped internalProps={{ id: 'el1', rootId: 'root' }} plitziJsxSkipHOC />);

    expect(captured.ctx?.id).toBe('el1');
    expect(captured.ctx?.rootId).toBe('root');
    expect((captured.ctx as { plitziJsxSkipHOC?: boolean }).plitziJsxSkipHOC).toBe(true);
    expect(useEventBridge).not.toHaveBeenCalled();
  });
});
