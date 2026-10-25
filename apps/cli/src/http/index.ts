import { Socket } from 'node:net';

/**
 * Node 24's `fetch` is undici 7, which sets each socket's type of service on every request and lets a failure escape:
 * on macOS a socket in some states answers `setTypeOfService EINVAL`, and Node throws it from the socket's own event —
 * nothing awaits it, so the process ends with a stack trace. A run's agents met it on `page measure`, `page play` and
 * `task look`, eight times and then twice more after a retry of the request, which never saw it, was tried. Node already
 * treats it as best effort on Windows, and undici 8 catches it: the CLI does the same, once, as it starts — until Node
 * bundles undici 8.
 */
export const bestEffortTypeOfService = (): void => {
  // Kept unbound on purpose: it is called with each socket as `this`, below.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setTypeOfService = Socket.prototype.setTypeOfService;
  Socket.prototype.setTypeOfService = function (this: Socket, tos: number): Socket {
    try {
      return setTypeOfService.call(this, tos);
    } catch (error) {
      if (error instanceof Error && 'syscall' in error && error.syscall === 'setTypeOfService') {
        return this;
      }

      throw error;
    }
  };
};
