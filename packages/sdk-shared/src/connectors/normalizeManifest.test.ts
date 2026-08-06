import { describe, expect, it } from 'vitest';

import { normalizeManifest } from './normalizeManifest';

import type { ConnectorManifest } from '../types';

describe('normalizeManifest', () => {
  it('lifts a root-level list and write into endpoints', () => {
    const legacy = {
      id: 'cms',
      baseUrl: 'https://cms.example.com',
      list: { path: '/api/{{resource}}', itemsPath: 'data' },
      write: { create: { method: 'POST' as const, path: '/api/{{resource}}' } },
      operators: { eq: '{{field}}={{value}}' }
    };

    expect(normalizeManifest(legacy)).toEqual({
      id: 'cms',
      baseUrl: 'https://cms.example.com',
      operators: { eq: '{{field}}={{value}}' },
      endpoints: {
        list: { path: '/api/{{resource}}', itemsPath: 'data' },
        write: { create: { method: 'POST', path: '/api/{{resource}}' } }
      }
    });
  });

  it('leaves a current manifest untouched', () => {
    const manifest: ConnectorManifest = {
      id: 'cms',
      baseUrl: 'https://cms.example.com',
      endpoints: { list: { path: '/api/{{resource}}' } }
    };

    expect(normalizeManifest(manifest)).toEqual(manifest);
  });

  it('drops a stale root-level list once endpoints exists', () => {
    const conflicted = {
      id: 'cms',
      baseUrl: 'https://cms.example.com',
      list: { path: '/old' },
      endpoints: { list: { path: '/new' } }
    };

    // The upgraded copy wins: a document holding both was written by the builder after the move, and the leftover
    // is what it replaced.
    expect(normalizeManifest(conflicted)).toEqual({
      id: 'cms',
      baseUrl: 'https://cms.example.com',
      endpoints: { list: { path: '/new' } }
    });
  });

  it('yields an empty list endpoint when a legacy manifest declared none', () => {
    const bare = { id: 'cms', baseUrl: '' };

    expect(normalizeManifest(bare)).toEqual({ id: 'cms', baseUrl: '', endpoints: { list: { path: '' } } });
  });
});
