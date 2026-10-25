import { Socket } from 'node:net';

import { describe, expect, it } from 'vitest';

import { bestEffortTypeOfService } from '.';

// undici 7 sets the type of service on every request; macOS answered EINVAL and Node threw it from the socket's event,
// past every await: `task look`, `page measure` and `page play` ended with a stack trace, ten times over three runs.
describe("a socket's type of service", () => {
  const refusing = (): Socket => {
    const socket = new Socket();
    // The operating system's answer, as libuv gives it: EINVAL.
    Object.defineProperty(socket, '_handle', { value: { setTypeOfService: () => -22 }, configurable: true });

    return socket;
  };

  it('is set as best effort: an EINVAL is let go, never thrown at the request', () => {
    expect(() => refusing().setTypeOfService(0)).toThrow(/setTypeOfService/);
    bestEffortTypeOfService();
    expect(() => refusing().setTypeOfService(0)).not.toThrow();
    // A value outside the range is still the caller's mistake, said as before.
    expect(() => new Socket().setTypeOfService(300)).toThrow(/tos/);
  });
});
