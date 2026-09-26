/**
 * A plugin's `plugin-manifest.json`, or `undefined` when it cannot be had.
 *
 * Plugins live on hosts of their own — a CDN, a bucket, the builder's resources — so this is nearly always a
 * cross-origin request, and it is kept a SIMPLE one: `Accept` says what is wanted, where the `Content-Type` this used to
 * send (on a GET, with no body to describe) made the browser ask the host's permission first. A host that allows plain
 * cross-origin reads — the usual CORS setting of a bucket — refused that preflight, and the element rendered "Not
 * Found" with the manifest sitting right there.
 */
const fetchManifest = async <T extends object>(manifestUrl: string): Promise<T | undefined> => {
  try {
    const response = await fetch(manifestUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return undefined;
    }

    // A manifest is somebody's JSON, published with the plugin; its shape is the caller's to check.
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
};

export default fetchManifest;
