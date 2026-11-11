import { describe, expect, it } from 'vitest';

import { parseManifest } from './parseManifest';
import { hasResponseMapping, summarize, summarizeEndpoint } from './summarizeManifest';
import {
  removeEndpoint,
  renameEndpoint,
  setAuth,
  setMediaBaseUrl,
  setReadEndpoint,
  setWriteEndpoint
} from './updateManifest';
import { validateManifest } from './validateManifest';

import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

const manifest = (over: Partial<ConnectorManifestDraft> = {}): ConnectorManifestDraft => ({
  baseUrl: 'https://cms.example.com',
  endpoints: { read: { list: { path: '/api/posts' } } },
  ...over
});

describe('a manifest typed by hand', () => {
  it('is read back when it is an object with read endpoints', () => {
    expect(parseManifest(JSON.stringify(manifest()))).toEqual({ manifest: manifest() });
  });

  it('is refused, saying why, when it is not JSON, not an object, or reads nothing', () => {
    expect(parseManifest('{').error).toMatch(/^The manifest is not valid JSON: /);
    expect(parseManifest('[]').error).toBe('A manifest must be a JSON object.');
    expect(parseManifest('null').error).toBe('A manifest must be a JSON object.');
    expect(parseManifest('{"endpoints":{}}').error).toMatch(/needs an "endpoints" block with a "read" map/);
  });
});

describe('a manifest checked for the form', () => {
  it('says each problem with the field it is on', () => {
    const { errors } = validateManifest(manifest({ baseUrl: '' }));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(error => typeof error === 'string' && error.length > 0)).toBe(true);
  });

  it('passes a manifest the engine can run', () => {
    expect(validateManifest(manifest()).errors).toEqual([]);
  });
});

describe('a section said on its collapsed header', () => {
  it('names the auth scheme, or none', () => {
    expect(summarize.auth(manifest())).toBe('None');
    expect(summarize.auth(manifest({ auth: { in: 'header', name: 'Authorization', value: 'x' } }))).toBe(
      'Header · Authorization'
    );
    expect(summarize.auth(manifest({ auth: { in: 'query', name: 'key', value: 'x' } }))).toBe('Query · key');
  });

  it('counts the endpoints, the paging by its name, the operators and the media address', () => {
    const full = manifest({
      endpoints: {
        read: { list: { path: '/a' }, one: { path: '/b' } },
        write: { create: { path: '/c', method: 'POST' } }
      },
      pagination: 'page',
      operators: { eq: '{{field}}={{value}}', gt: '', lt: '', in: '' },
      media: { baseUrl: 'https://media.example.com' }
    });

    expect(summarize.endpoints(full)).toBe('2 read · 1 write');
    expect(summarize.pagination(full)).toBe('Page number');
    expect(summarize.pagination(manifest())).toBe('Offset');
    expect(summarize.filters(full)).toBe('4 operators');
    expect(summarize.filters(manifest({ operators: { eq: '' } }))).toBe('eq');
    expect(summarize.filters(manifest())).toBe('None');
    expect(summarize.media(full)).toBe('https://media.example.com');
    expect(summarize.media(manifest())).toBe('—');
  });

  it('says an endpoint as its request, GET when it names no method', () => {
    expect(summarizeEndpoint({ path: '/api/posts' })).toBe('GET /api/posts');
    expect(summarizeEndpoint({ path: '', method: 'POST' })).toBe('POST —');
  });

  // A field the form cleared is an empty string, not a missing one: the others still say it was mapped by hand.
  it('says an endpoint mapped by hand whichever of its paths says so, an empty one beside it', () => {
    expect(hasResponseMapping({ path: '/a' })).toBe(false);
    expect(hasResponseMapping({ path: '/a', itemsPath: 'data' })).toBe(true);
    expect(hasResponseMapping({ path: '/a', itemsPath: '', totalPath: 'meta.total' })).toBe(true);
    expect(hasResponseMapping({ path: '/a', itemsPath: '', totalPath: '' })).toBe(false);
  });
});

describe('the basic editor’s changes to a manifest', () => {
  it('drops the auth block whole once its name and value are both empty, and keeps where it goes otherwise', () => {
    const withAuth = setAuth(manifest(), 'name', 'Authorization');

    expect(withAuth.auth).toEqual({ in: 'header', name: 'Authorization', value: '' });
    expect(setAuth(withAuth, 'in', 'query').auth).toEqual({ in: 'query', name: 'Authorization', value: '' });
    expect('auth' in setAuth(withAuth, 'name', '')).toBe(false);
  });

  it('sets an endpoint without touching its siblings or the manifest it was given', () => {
    const before = manifest();
    const after = setReadEndpoint(before, 'one', { path: '/api/posts/{{id}}' });
    const written = setWriteEndpoint(after, 'create', { path: '/api/posts', method: 'POST' });

    expect(before.endpoints.read).toEqual({ list: { path: '/api/posts' } });
    expect(Object.keys(after.endpoints.read)).toEqual(['list', 'one']);
    expect(written.endpoints.write).toEqual({ create: { path: '/api/posts', method: 'POST' } });
  });

  it('removes an endpoint, and the write block with its last one', () => {
    const written = setWriteEndpoint(manifest(), 'create', { path: '/c', method: 'POST' });

    expect('write' in removeEndpoint(written, 'write', 'create').endpoints).toBe(false);
    expect(removeEndpoint(manifest(), 'read', 'list').endpoints.read).toEqual({});
  });

  it('renames an endpoint where it stands, and refuses a name already taken or empty', () => {
    const two = setReadEndpoint(manifest(), 'one', { path: '/b' });
    const renamed = renameEndpoint(two, 'read', 'list', 'posts');

    expect(Object.keys(renamed.endpoints.read)).toEqual(['posts', 'one']);
    expect(renameEndpoint(two, 'read', 'list', 'one')).toBe(two);
    expect(renameEndpoint(two, 'read', 'list', '')).toBe(two);
    expect(renameEndpoint(two, 'read', 'list', 'list')).toBe(two);
  });

  it('drops the media block once its address is cleared', () => {
    expect(setMediaBaseUrl(manifest(), 'https://media.example.com').media).toEqual({
      baseUrl: 'https://media.example.com'
    });
    expect('media' in setMediaBaseUrl(manifest({ media: { baseUrl: 'x' } }), '')).toBe(false);
  });
});
