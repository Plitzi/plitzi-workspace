/**
 * The cookie carrying the visitor's "hide the dev tools" preference — named for the origin it belongs to.
 *
 * A cookie's scope is the HOST, and the host has no port in it. So one jar entry is shared by every site served
 * from `localhost`, and hiding the panel on the example running at `:5009` hides it on the one at `:4013` too —
 * on the next reload, with nothing on screen to say why, and no way back that does not involve knowing the
 * keyboard shortcut. Whoever hit that has a broken tool and no reason to suspect a cookie.
 *
 * The port goes in the NAME because it cannot go in the scope. A deployment on a default port is unaffected and
 * keeps the plain name.
 *
 * Both halves of the SDK call this: the browser writes the preference, and the server reads it back so the
 * markup it renders matches what the client is about to hydrate.
 */
export const debugCookieName = (host: string | undefined): string => {
  const port = host?.split(':')[1];

  return port ? `plitzi_debug_${port}` : 'plitzi_debug';
};

export default debugCookieName;
