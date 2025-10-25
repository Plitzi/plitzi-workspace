const fetchManifest = async <T extends object>(manifestUrl: string) => {
  let responseContent: T | undefined;
  try {
    const response = await fetch(manifestUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    responseContent = (await response.json()) as T;

    return responseContent;
  } catch {
    return responseContent;
  }
};

export default fetchManifest;
