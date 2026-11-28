import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RTEventCloseCode } from '@plitzi/sdk-shared/websockets';

import useWebsocket from './useWebsocket';

/** A socket the test drives: what the server would do to it, by hand. */
class FakeSocket {
  static readonly OPEN = 1;
  static sockets: FakeSocket[] = [];
  readonly OPEN = 1;
  readyState = 0;
  binaryType = 'blob';
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();

  constructor(readonly url: string) {
    FakeSocket.sockets.push(this);
  }

  close() {
    this.readyState = 3;
  }

  accept() {
    this.readyState = 1;
    this.onopen?.();
  }

  say(data: string) {
    this.onmessage?.({ data });
  }

  refuse(code: number, reason: string) {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

const opened = () => FakeSocket.sockets;
let credential = 'old';
const url = () => `wss://server.plitzi.test/?userToken=${credential}`;

beforeEach(() => {
  FakeSocket.sockets = [];
  credential = 'old';
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const render = (onSessionRefused: (reason: string) => Promise<boolean>) =>
  renderHook(props => useWebsocket(props), {
    initialProps: { url, processMessage: vi.fn(), onSessionRefused }
  });

describe('the realtime socket across a renewal', () => {
  /**
   * A tab back after a day reconnected with the token it had; the server refused it, and the socket stayed closed:
   * no collaborators, no cursors, until the page was loaded again.
   */
  it('opens again with the renewed credential when the server refuses its session', async () => {
    const onSessionRefused = vi.fn((reason: string) => {
      credential = 'renewed';

      return Promise.resolve(reason === 'expired');
    });
    render(onSessionRefused);
    act(() => opened()[0]?.accept());

    act(() => opened()[0]?.refuse(RTEventCloseCode.SESSION_REFUSED, 'expired'));

    await waitFor(() => expect(opened()).toHaveLength(2));
    expect(onSessionRefused).toHaveBeenCalledWith('expired');
    expect(opened()[1]?.url).toContain('userToken=renewed');
  });

  it('stays closed, and says so, when the renewed credential is refused before the server said anything', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const onSessionRefused = vi.fn(() => Promise.resolve(true));
      render(onSessionRefused);
      act(() => opened()[0]?.refuse(RTEventCloseCode.SESSION_REFUSED, 'expired'));
      await waitFor(() => expect(opened()).toHaveLength(2));

      act(() => opened()[1]?.refuse(RTEventCloseCode.SESSION_REFUSED, 'revoked'));

      await waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('refused again (revoked)')));
      expect(onSessionRefused).toHaveBeenCalledTimes(1);
      expect(opened()).toHaveLength(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('renews again once the server accepted the renewed one', async () => {
    const onSessionRefused = vi.fn(() => Promise.resolve(true));
    render(onSessionRefused);
    act(() => opened()[0]?.refuse(RTEventCloseCode.SESSION_REFUSED, 'expired'));
    await waitFor(() => expect(opened()).toHaveLength(2));
    act(() => {
      opened()[1]?.accept();
      opened()[1]?.say('{"type":0}');
    });

    act(() => opened()[1]?.refuse(RTEventCloseCode.SESSION_REFUSED, 'expired'));

    await waitFor(() => expect(opened()).toHaveLength(3));
    expect(onSessionRefused).toHaveBeenCalledTimes(2);
  });

  it('stays closed when the session is not renewed', async () => {
    const onSessionRefused = vi.fn(() => Promise.resolve(false));
    render(onSessionRefused);

    act(() => opened()[0]?.refuse(RTEventCloseCode.SESSION_REFUSED, 'revoked'));

    await waitFor(() => expect(onSessionRefused).toHaveBeenCalled());
    expect(opened()).toHaveLength(1);
  });

  /**
   * The page hands the builder each renewed token as a new address: the socket that was open was closed for it, and
   * none opened in its place.
   */
  it('keeps the open socket when the credential is renewed under it', () => {
    const { rerender } = render(() => Promise.resolve(true));
    act(() => opened()[0]?.accept());

    credential = 'renewed';
    rerender({ url: () => url(), processMessage: vi.fn(), onSessionRefused: () => Promise.resolve(true) });

    expect(opened()).toHaveLength(1);
    expect(opened()[0]?.readyState).toBe(1);
  });
});
