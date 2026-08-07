import { describe, expect, it } from 'vitest';

import { connectorPresets } from './presets';
import { validateConnectorManifest } from './validateManifest';

import type { ConnectorManifestDraft } from '../types/ConnectorTypes';

const preset = (id: string): ConnectorManifestDraft => {
  const found = connectorPresets.find(item => item.id === id);
  if (!found) {
    throw new Error(`No connector preset "${id}"`);
  }

  return structuredClone(found.manifest);
};

const strapi = (): ConnectorManifestDraft => preset('strapi');

const messages = (issues: { path: string; message: string }[]): string =>
  issues.map(i => `${i.path}:${i.message}`).join('|');

describe('validateConnectorManifest', () => {
  it('accepts every working preset', () => {
    for (const preset of connectorPresets.filter(item => item.id !== 'blank')) {
      const report = validateConnectorManifest(preset.manifest);
      expect(`${preset.id}: ${messages(report.errors)}`).toBe(`${preset.id}: `);
    }
  });

  // `blank` is the panel's empty form, not a manifest: it has no base URL yet, and validating it is exactly what
  // stops a half-filled one from being saved. Pinned so it is never mistaken for a working example.
  it('rejects the blank preset, which is an empty form rather than an integration', () => {
    expect(validateConnectorManifest(preset('blank')).valid).toBe(false);
  });

  it('rejects a document that is not an object at all', () => {
    expect(validateConnectorManifest('nope').valid).toBe(false);
    expect(validateConnectorManifest(null).valid).toBe(false);
  });

  it('requires an absolute base URL', () => {
    const manifest = { ...strapi(), baseUrl: 'cms.example.com' };
    const report = validateConnectorManifest(manifest);

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('baseUrl:');
  });

  it('requires at least one read endpoint', () => {
    const manifest = { ...strapi(), endpoints: { read: {} } };
    const report = validateConnectorManifest(manifest);

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('endpoints.read:');
  });

  it('rejects an HTTP method the engine will not send', () => {
    const manifest = strapi();
    manifest.endpoints.write = { create: { method: 'FETCH' as never, path: '/api/{{resource}}' } };

    expect(validateConnectorManifest(manifest).valid).toBe(false);
  });

  // The engine drops an operator template with no `=`, which turns a filtered query into an unfiltered one — the
  // wrong records rather than none, so it must never reach the database.
  it('rejects an operator template that renders no key=value pair', () => {
    const manifest = strapi();
    manifest.operators = { eq: 'filters[{{field}}][$eq]' };
    const report = validateConnectorManifest(manifest);

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('operators.eq:');
  });

  it('saves without a credential, warning that requests go unauthenticated', () => {
    const manifest = strapi();
    delete manifest.credential;
    const report = validateConnectorManifest(manifest);

    // The whole point: an agent authors the manifest, the space owner attaches the secret afterwards.
    expect(report.valid).toBe(true);
    expect(messages(report.warnings)).toContain('credential:');
  });

  it('does not warn about a credential when the manifest names one', () => {
    const manifest = { ...strapi(), credential: 'strapi-token' };

    expect(validateConnectorManifest(manifest).warnings).toEqual([]);
  });

  it('warns when a credential is attached but never read', () => {
    const manifest = { ...preset('wordpress'), credential: 'unused' };
    const report = validateConnectorManifest(manifest);

    expect(report.valid).toBe(true);
    expect(messages(report.warnings)).toContain('credential:');
  });

  it('warns when a paging style is declared but never expressed in the request', () => {
    const manifest = strapi();
    manifest.endpoints.read.list.query = { populate: '*' };
    const report = validateConnectorManifest(manifest);

    expect(report.valid).toBe(true);
    expect(messages(report.warnings)).toContain('every page resolves to the first one');
  });

  it('warns about a token the engine does not bind in that position', () => {
    const manifest = strapi();
    // The classic slip: the route param written as a bare name instead of routeParams.slug.
    manifest.endpoints.read.list.query = { ...manifest.endpoints.read.list.query, filter: '{{slug}}' };

    expect(messages(validateConnectorManifest(manifest).warnings)).toContain('{{slug}}');
  });

  it('warns about a body on a method that carries none', () => {
    const manifest = strapi();
    manifest.endpoints.read.list.body = { q: '{{resource}}' };

    expect(messages(validateConnectorManifest(manifest).warnings)).toContain('never sent');
  });

  it('rejects an unknown field type', () => {
    const manifest = { ...strapi(), fields: { title: 'paragraph' } };

    expect(validateConnectorManifest(manifest).valid).toBe(false);
  });
});
