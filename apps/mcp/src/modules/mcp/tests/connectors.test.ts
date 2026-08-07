import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply, validate } from '../tools';
import { documentOperation, operation } from '../tools/operations';

import type { Space } from '../helpers';
import type { Operation } from '../tools';
import type { AIElementDetail } from '../types';

const strapiConnector: Operation = {
  type: 'upsertConnector',
  ref: 'strapi-blog',
  name: 'Blog CMS',
  baseUrl: 'https://cms.example.com',
  connection: {
    auth: { in: 'header', name: 'Authorization', value: 'Bearer {{credential.token}}' },
    pagination: 'offset',
    operators: { eq: 'filters[{{field}}][$eq]={{value}}' },
    mediaBaseUrl: 'https://cms.example.com'
  },
  endpoints: {
    read: {
      list: {
        path: '/api/{{resource}}',
        query: { 'pagination[start]': '{{offset}}', 'pagination[limit]': '{{limit}}' },
        itemsPath: 'data',
        totalPath: 'meta.pagination.total',
        idPath: 'documentId'
      }
    },
    write: { create: { method: 'POST', path: '/api/{{resource}}', bodyPath: 'data' } }
  }
};

const withConnector = (): Space => {
  const space = buildSpace();
  space.connectors = [
    {
      id: 'strapi-blog',
      name: 'Blog CMS',
      manifest: {
        id: 'strapi-blog',
        baseUrl: 'https://cms.example.com',
        endpoints: { read: { list: { path: '/api/{{resource}}' }, detail: { path: '/api/{{resource}}/{{id}}' } } },
        operators: { eq: 'filters[{{field}}][$eq]={{value}}' }
      }
    }
  ];

  return space;
};

/** A provider element as an agent would author one, so each test varies only the half it is about. */
const provider = (props: Record<string, unknown>, runtime?: 'server' | 'client' | 'shared'): Operation => ({
  type: 'upsertElement',
  pageRef: 'home',
  element: { ref: 'posts-api', type: 'apiContainer', ...(runtime ? { runtime } : {}), props }
});

describe('mcp-ai connectors', () => {
  it('creates a connector and persists it as its own row, without touching the schemas', async () => {
    const space = buildSpace();
    const { persisters, saved } = capturing(space);
    const result = await apply({ operations: [strapiConnector] }, space, persisters);

    expect(result.applied).toBe(true);
    expect(result.persisted).toBe(true);
    expect(result.summary.created).toBe(1);
    expect(saved().connectors.map(entry => entry.id)).toEqual(['strapi-blog']);
    // The manifest's id is stamped from the ref, never taken from the document.
    expect(saved().connectors[0].manifest.id).toBe('strapi-blog');
    expect(saved().connectors[0].manifest.media).toEqual({ baseUrl: 'https://cms.example.com' });
  });

  it('reports unsaved when the deployment wires no connector persister', async () => {
    const space = buildSpace();
    const result = await apply({ operations: [strapiConnector] }, space, {});

    expect(result.applied).toBe(true);
    expect(result.persisted).toBe(false);
  });

  it('saves a manifest with no credential, warning that requests go unauthenticated', () => {
    const result = validate({ operations: [strapiConnector] }, buildSpace());

    // The agent never holds a secret: the manifest must be storable before the space owner attaches one.
    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('unauthenticated');
  });

  it('rejects a manifest the engine could not execute', () => {
    const broken = { ...strapiConnector, baseUrl: 'cms.example.com' } as Operation;
    const result = validate({ operations: [broken] }, buildSpace());

    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('operations[0].baseUrl');
  });

  it('rejects an operator template that renders no key=value pair', () => {
    const broken = {
      ...strapiConnector,
      connection: { ...strapiConnector.connection, operators: { eq: 'filters[{{field}}]' } }
    } as Operation;

    expect(validate({ operations: [broken] }, buildSpace()).valid).toBe(false);
  });

  it('merges endpoints by name on patch and removes one set to null', async () => {
    const space = withConnector();
    const { persisters, saved } = capturing(space);
    const result = await apply(
      {
        operations: [
          {
            type: 'patchConnector',
            ref: 'strapi-blog',
            endpoints: {
              read: { search: { path: '/api/{{resource}}/search', method: 'POST' }, detail: null }
            }
          }
        ]
      },
      space,
      persisters
    );

    expect(result.applied).toBe(true);
    const manifest = saved().connectors[0].manifest;
    expect(Object.keys(manifest.endpoints.read).sort()).toEqual(['list', 'search']);
    // Untouched connection settings survive the patch.
    expect(manifest.operators).toEqual({ eq: 'filters[{{field}}][$eq]={{value}}' });
  });

  it('refuses to patch away the last read endpoint', async () => {
    const space = withConnector();
    const result = await apply(
      {
        operations: [{ type: 'patchConnector', ref: 'strapi-blog', endpoints: { read: { list: null, detail: null } } }]
      },
      space,
      capturing(space).persisters
    );

    expect(result.applied).toBe(false);
    expect(result.errors?.[0].message).toContain('no read endpoint');
  });

  it('deletes a connector row', async () => {
    const space = withConnector();
    const { persisters, saved } = capturing(space);
    const result = await apply({ operations: [{ type: 'deleteConnector', ref: 'strapi-blog' }] }, space, persisters);

    expect(result.applied).toBe(true);
    expect(result.summary.deleted).toBe(1);
    expect(saved().connectors).toEqual([]);
  });

  it('lists connectors with the endpoints and operators an element may address', () => {
    const listing = readResource(withConnector(), 'main', 'plitzi://connectors/main')?.data as {
      connectors: { ref: string; read: string[]; operators: string[] }[];
    };

    expect(listing.connectors[0].ref).toBe('strapi-blog');
    expect(listing.connectors[0].read.sort()).toEqual(['detail', 'list']);
    expect(listing.connectors[0].operators).toEqual(['eq']);
  });

  it('opens one connector manifest in full, and reports a ref that does not resolve', () => {
    const one = readResource(withConnector(), 'main', 'plitzi://connectors/main/strapi-blog')?.data as {
      manifest: { baseUrl: string };
    };

    expect(one.manifest.baseUrl).toBe('https://cms.example.com');
    expect(readResource(withConnector(), 'main', 'plitzi://connectors/main/nope')).toBeNull();
  });

  it('serves working presets and the token vocabulary, without the blank form', () => {
    const presets = readResource(buildSpace(), 'main', 'plitzi://connector-presets')?.data as {
      presets: { id: string }[];
      tokens: { value: string }[];
    };

    expect(presets.presets.map(preset => preset.id)).toContain('strapi');
    expect(presets.presets.map(preset => preset.id)).not.toContain('blank');
    expect(presets.tokens.map(token => token.value)).toContain('credential.');
  });
});

describe('mcp-ai provider elements (the connector half that lives in the schema)', () => {
  it('stores runtime on create and reports it back on an element read', async () => {
    const space = withConnector();
    const { persisters, saved } = capturing(space);
    const result = await apply(
      { operations: [provider({ connector: 'strapi-blog', resource: 'articles' }, 'server')] },
      space,
      persisters
    );

    expect(result.applied).toBe(true);
    // apply mutates a draft and hands the result to the persisters, so the saved state is what to read back.
    const detail = readResource(saved(), 'main', 'plitzi://schema/main/elements/posts-api')?.data as AIElementDetail;
    expect(detail.runtime).toBe('server');
  });

  // The commonest way to author a dead page: the connector props are right and the element still renders in the
  // browser, which ignores them.
  it('warns when a provider names a connector but is not server-rendered', () => {
    const result = validate(
      { operations: [provider({ connector: 'strapi-blog', resource: 'articles' })] },
      withConnector()
    );

    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('not server-rendered');
  });

  it('warns when a server provider names a connector the space does not have', () => {
    const result = validate(
      { operations: [provider({ connector: 'ghost', resource: 'articles' }, 'server')] },
      withConnector()
    );

    expect(result.warnings.join(' ')).toContain('not configured in this space');
  });

  it('accepts a provider wired to a connector created earlier in the same batch', () => {
    const result = validate(
      { operations: [strapiConnector, provider({ connector: 'strapi-blog', resource: 'articles' }, 'server')] },
      buildSpace()
    );

    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).not.toContain('not configured');
  });

  it('rejects a read endpoint the connector does not declare', () => {
    const result = validate(
      { operations: [provider({ connector: 'strapi-blog', resource: 'articles', endpoint: 'feed' }, 'server')] },
      withConnector()
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0].validValues).toEqual(['list', 'detail']);
  });

  // A filter naming an undeclared operator is DROPPED by the engine: the query runs unfiltered and a detail page
  // renders an arbitrary record, so it fails the batch rather than warning.
  it('rejects a filter whose operator the connector does not declare', () => {
    const result = validate(
      {
        operations: [
          provider(
            {
              connector: 'strapi-blog',
              resource: 'articles',
              filters: [{ field: 'slug', operator: 'startsWith', value: '{{routeParams.slug}}' }]
            },
            'server'
          )
        ]
      },
      withConnector()
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('startsWith');
  });

  it('checks the MERGED element when a patch only flips runtime', async () => {
    const space = withConnector();
    const { persisters, saved } = capturing(space);
    await apply({ operations: [provider({ connector: 'strapi-blog', resource: 'articles' })] }, space, persisters);

    const wired = validate(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'posts-api', runtime: 'server' }] },
      saved()
    );

    expect(wired.warnings.join(' ')).not.toContain('not server-rendered');
  });
});

describe('mcp-ai connector op vocabulary', () => {
  // plitzi_render authors an offline widget — no space, no server, nothing to persist a connector row to — so
  // offering the op there would advertise a write that silently goes nowhere (and carry the manifest schemas into
  // every listing for nothing).
  it('is offered by plitzi_apply but not by the offline render tool', () => {
    expect(operation.safeParse(strapiConnector).success).toBe(true);
    expect(documentOperation.safeParse(strapiConnector).success).toBe(false);
    // The document ops themselves are unchanged in both.
    const element = provider({ connector: 'strapi-blog', resource: 'articles' }, 'server');
    expect(documentOperation.safeParse(element).success).toBe(true);
  });
});

describe('mcp-ai connector deletion', () => {
  it('names the elements a deletion would leave without data', async () => {
    const space = withConnector();
    const { persisters, saved } = capturing(space);
    await apply(
      { operations: [provider({ connector: 'strapi-blog', resource: 'articles' }, 'server')] },
      space,
      persisters
    );

    const result = validate({ operations: [{ type: 'deleteConnector', ref: 'strapi-blog' }] }, saved());

    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('posts-api');
  });

  it('says nothing when no element uses it', () => {
    const result = validate({ operations: [{ type: 'deleteConnector', ref: 'strapi-blog' }] }, withConnector());

    expect(result.warnings).toEqual([]);
  });
});
