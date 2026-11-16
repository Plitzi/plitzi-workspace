import { describe, expect, it } from 'vitest';

import { fingerprintChanges } from './fingerprint';
import { buildSpaShell, spaFingerprintParts } from './spaShell';

import type { SpaShellInput } from './spaShell';

const INPUT: SpaShellInput = {
  webKey: 'key.of.the-space',
  environment: 'production',
  servers: {
    ssrServer: 'https://ssr.example.com',
    apiServer: 'https://api.example.com',
    serverUrl: 'https://server.example.com',
    websocketServer: 'wss://server.example.com',
    subscriptionServer: 'wss://server.example.com/graphql'
  },
  head: {
    title: 'Café <Lumen>',
    lang: 'es',
    favicon: 'data:image/svg+xml,x',
    fonts: {
      preconnect: [],
      links: [{ rel: 'stylesheet', href: 'https://fonts.example.com/a.css' }],
      faces: '',
      origins: []
    }
  }
};

const html = (input: SpaShellInput, path = 'index.html'): string =>
  new TextDecoder().decode(buildSpaShell(input).files.find(file => file.path === path)?.body);

describe('an SPA shell', () => {
  it('names its environment and never a revision: its domain says which one it serves', () => {
    const page = html(INPUT);

    expect(page).toContain('"environment":"production"');
    expect(page).not.toContain('revision');
    expect(page).toContain('<title>Café &lt;Lumen&gt;</title>');
    expect(page).toContain('<html lang="es">');
    expect(page).toContain('href="https://fonts.example.com/a.css"');
  });

  it('carries its own SDK and React, under a folder named by their digest, immutable', () => {
    const site = buildSpaShell(INPUT);
    const sdk = site.files.filter(file => file.path.startsWith('_plitzi/sdk-'));

    expect(sdk.map(file => file.path.split('/').at(-1))).toEqual(
      expect.arrayContaining(['plitzi-sdk.js', 'plitzi-sdk-vendor.js', 'plitzi-sdk.css', 'plitzi-sdk-icons.css'])
    );
    expect(sdk.every(file => file.cache === 'immutable')).toBe(true);
    expect(sdk.some(file => /\.(gz|map)$|dev-vendor/.test(file.path))).toBe(false);
    expect(html(INPUT)).toContain(`"react":"/${sdk[0].path.split('/').slice(0, 2).join('/')}/plitzi-sdk-vendor.js"`);
  });

  it('answers an address it has no file for with the same page', () => {
    expect(html(INPUT, '404.html')).toBe(html(INPUT));
  });

  it('serves under a base path, for a site that is not at its domain’s root', () => {
    expect(html({ ...INPUT, basePath: 'repo' })).toContain('"/repo/_plitzi/sdk-');
    expect(html({ ...INPUT, basePath: 'repo' })).toContain('"basePath":"/repo/"');
  });

  it('says which of its parts a change touches: not the content, which its domain reads at run time', () => {
    const before = spaFingerprintParts(INPUT);

    expect(fingerprintChanges(before, spaFingerprintParts(INPUT))).toEqual([]);
    expect(
      fingerprintChanges(
        before,
        spaFingerprintParts({
          ...INPUT,
          environment: 'staging',
          head: { ...INPUT.head, fonts: { ...INPUT.head.fonts, faces: '@font-face{}' } }
        })
      )
    ).toEqual(['environment', 'fonts']);
    expect(fingerprintChanges(before, spaFingerprintParts({ ...INPUT, webKey: 'rotated' }))).toEqual(['key']);
  });
});
