import { describe, expect, it } from 'vitest';

import { audienceKeyFor, requestVisitorFacts, spaceAudiences } from './audiences';

import type { Element } from '@plitzi/sdk-shared';

const node = (id: string, type: string, attributes: Record<string, unknown> = {}, items?: string[]): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: type, type, styleSelectors: { base: '' }, ...(items ? { items } : {}) }
});

const byDevice = { combinator: 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] };

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

const request = (userAgent: string, acceptLanguage = 'es-AR,es;q=0.9') => ({
  headers: { host: 'site.example.com', 'user-agent': userAgent, 'accept-language': acceptLanguage }
});

describe('audiences on the server', () => {
  const space = {
    flat: {
      welcome: node('welcome', 'variants', { chooseBy: 'rules' }, ['phones']),
      phones: node('phones', 'variantItem', { when: byDevice })
    }
  };

  it('says whether a space has Variants elements chosen by rules, and the visitor facts their rules read', () => {
    expect(spaceAudiences(space)).toEqual({ has: true, used: ['device'] });
    // Chosen by chance, the same variants decide by no rule.
    const byChance = { flat: { ...space.flat, welcome: node('welcome', 'variants', {}, ['phones']) } };
    expect(spaceAudiences(byChance)).toEqual({ has: false, used: [] });
    expect(spaceAudiences({ flat: { text: node('text', 'text') } })).toEqual({ has: false, used: [] });
  });

  it('reads the visitor off the request', () => {
    expect(requestVisitorFacts(request(IPHONE))).toEqual({
      returning: false,
      language: 'es',
      device: 'mobile',
      country: ''
    });
    const fromCloudflare = { headers: { ...request(IPHONE).headers, 'cf-ipcountry': 'ar' } };
    expect(requestVisitorFacts(fromCloudflare).country).toBe('AR');
  });

  it('keys a page by the facts its audiences read, by none where they read none, and not at all for a space not held', () => {
    expect(audienceKeyFor(request(IPHONE), space)).toBe('device=mobile');
    expect(audienceKeyFor(request(IPHONE), { flat: {} })).toBe('');
    expect(audienceKeyFor(request(IPHONE), undefined)).toBeUndefined();
  });
});
