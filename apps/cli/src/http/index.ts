/**
 * The CLI's requests to a server of this machine — a project's, a task's copy — made with Node's `fetch`.
 *
 * Node 24's `fetch` is undici 7, which sets a socket's type of service on every request with nothing to catch it: on a
 * socket just opened, macOS answers `setTypeOfService EINVAL`, and the request fails. A run's agents met it eight
 * times — `page measure` and `page play`, the first call after a copy's server started — each with a stack trace and
 * no message; the same call again worked. undici 8 catches it; until Node's own does, it is asked again here, once.
 */

const isTypeOfService = (error: unknown): boolean => {
  for (let at: unknown = error; at instanceof Error; at = at.cause) {
    if (/setTypeOfService/.test(at.message) || ('syscall' in at && at.syscall === 'setTypeOfService')) {
      return true;
    }
  }

  return false;
};

export const localFetch = (input: string | URL, init?: RequestInit): Promise<Response> =>
  fetch(input, init).catch((error: unknown) => {
    if (!isTypeOfService(error)) {
      throw error;
    }

    return fetch(input, init);
  });
