import { render, screen, fireEvent } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, it, expect } from 'vitest';

import { createStoreHook } from './react';
import StoreProvider from './react/StoreProvider';

// Regression: a live scope must keep receiving parent updates after React StrictMode's mount → unmount → remount
// cycle. StrictMode reuses the same store instance, so the provider's unmount `destroy()` detaches the parent
// forwarder; the provider must `reconnect()` on remount or the child silently stops reacting to parent writes.

type State = { user: { name: string } };

const { useStore } = createStoreHook<State>();

const INITIAL: State = { user: { name: 'Alice' } };

function Parent() {
  const [name, setName] = useStore('user.name');

  return (
    <button data-testid="rename" onClick={() => setName('Bob')}>
      {name}
    </button>
  );
}

function LiveChild() {
  const [name] = useStore('user.name');

  return <span data-testid="live">{name}</span>;
}

const renderTree = (wrap: (node: React.ReactNode) => React.ReactElement) =>
  render(
    wrap(
      <StoreProvider value={INITIAL}>
        <Parent />
        <StoreProvider inherit="live">
          <LiveChild />
        </StoreProvider>
      </StoreProvider>
    )
  );

describe('scoped store: live scope survives StrictMode remount', () => {
  it('child reflects a parent write without StrictMode', () => {
    renderTree(node => <>{node}</>);

    fireEvent.click(screen.getByTestId('rename'));

    expect(screen.getByTestId('live').textContent).toBe('Bob');
  });

  it('child reflects a parent write under StrictMode', () => {
    renderTree(node => <StrictMode>{node}</StrictMode>);

    fireEvent.click(screen.getByTestId('rename'));

    expect(screen.getByTestId('live').textContent).toBe('Bob');
  });
});
