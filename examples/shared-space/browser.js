import data from './offline-data.json' with { type: 'json' };

/** The space, already typed — a bundler resolves the JSON, so nothing here touches the filesystem. */
export const offlineData = data;
