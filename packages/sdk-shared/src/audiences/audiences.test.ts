import { describe, expect, it } from 'vitest';

import {
  audienceFactsUsed,
  audienceKeyOf,
  chooseAudienceVariant,
  deviceFromUserAgent,
  isReturning,
  languageFrom,
  seenCookie,
  visitorFactsOf
} from './audiences';

import type { Element } from '../types';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const rule = (field: string, value: string | boolean) => ({
  combinator: 'and',
  rules: [{ field, operator: '=', value }]
});

const variant = (id: string, when: unknown): Element => ({
  id,
  attributes: { when },
  definition: { rootId: id, label: 'Audience variant', type: 'audienceVariant', styleSelectors: { base: '' } }
});

describe('a visitor’s facts', () => {
  it('say the device, by the client hint first and then the agent', () => {
    expect(deviceFromUserAgent(IPHONE)).toBe('mobile');
    expect(deviceFromUserAgent(ANDROID_PHONE)).toBe('mobile');
    expect(deviceFromUserAgent(IPAD)).toBe('tablet');
    expect(deviceFromUserAgent(ANDROID_TABLET)).toBe('tablet');
    expect(deviceFromUserAgent(MAC)).toBe('desktop');
    expect(deviceFromUserAgent(MAC, '?1')).toBe('mobile');
    expect(deviceFromUserAgent(undefined)).toBe('desktop');
  });

  it('say the language asked for first, by its primary subtag', () => {
    expect(languageFrom('es-AR,es;q=0.9,en;q=0.8')).toBe('es');
    expect(languageFrom('EN')).toBe('en');
    expect(languageFrom(undefined)).toBe('');
  });

  it('say a visitor is returning once their first visit is over', () => {
    const now = 1_800_000_000_000;

    expect(isReturning(undefined, now)).toBe(false);
    expect(isReturning(now / 1000 - 60, now)).toBe(false);
    expect(isReturning(now / 1000 - 31 * 60, now)).toBe(true);
    expect(
      visitorFactsOf({
        cookies: `plitzi_seen=${String(now / 1000 - 3600)}`,
        host: 'example.com',
        userAgent: IPHONE,
        acceptLanguage: 'es',
        now
      })
    ).toEqual({ returning: true, language: 'es', device: 'mobile' });
    expect(seenCookie('example.com', now, { secure: true })).toBe(
      'plitzi_seen=1800000000; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
    );
  });
});

describe('an audience', () => {
  it('shows the first variant whose rule the visitor matches, one with no conditions matching everybody', () => {
    const rules = [rule('visitor.device', 'mobile'), rule('queryParams.utm_source', 'ads'), undefined];
    const scope = (device: 'mobile' | 'desktop', utm?: string) => ({
      queryParams: utm ? { utm_source: utm } : {},
      visitor: { returning: false, language: 'en', device }
    });

    expect(chooseAudienceVariant(rules, scope('mobile', 'ads'))).toBe(0);
    expect(chooseAudienceVariant(rules, scope('desktop', 'ads'))).toBe(1);
    expect(chooseAudienceVariant(rules, scope('desktop'))).toBe(2);
    expect(chooseAudienceVariant(rules.slice(0, 2), scope('desktop'))).toBe(-1);
  });

  it('keeps a space’s pages apart only by the facts its audiences read', () => {
    const flat = {
      a: variant('a', { combinator: 'or', rules: [rule('visitor.language', 'es'), rule('visitor.device', 'mobile')] }),
      b: variant('b', rule('user.authenticated', true))
    };

    expect(audienceFactsUsed({ flat })).toEqual(['language', 'device']);
    expect(audienceFactsUsed({ flat: { b: flat.b } })).toEqual([]);
    expect(audienceKeyOf({ returning: true, language: 'es', device: 'mobile' }, ['language', 'device'])).toBe(
      'language=es;device=mobile'
    );
  });
});
