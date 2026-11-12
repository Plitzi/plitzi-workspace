import { describe, expect, it } from 'vitest';

import { guestBytes } from './bytes';
import { guestEvents } from './events';
import { guestFetch } from './fetch';

/**
 * The guest's `Headers`, `Request` and `Response`, run in Node as they are printed into the isolate: each rule the part
 * states, held here, so a change to one fails this suite before any bundle runs.
 */

const bytes = guestBytes();
const { GuestHeaders, GuestRequest, GuestResponse, wireOf, headerPairs, bodyOfWire } = guestFetch(
  bytes,
  guestEvents({ sleep: () => Promise.resolve() })
);

describe("the guest's Headers", () => {
  it('keeps names lowercased, and refuses one that is no header name', () => {
    const headers = new GuestHeaders({ 'X-Trace': ' a ' });

    expect(headers.get('x-trace')).toBe('a');
    expect(headers.has('X-TRACE')).toBe(true);
    expect(() => headers.set('bad name', 'x')).toThrow('"bad name" is not a valid header name');
  });

  it('joins repeated values, except set-cookie, which stays one per entry', () => {
    const headers = new GuestHeaders([
      ['accept', 'a'],
      ['accept', 'b'],
      ['set-cookie', 'one=1'],
      ['set-cookie', 'two=2']
    ]);

    expect(headers.get('accept')).toBe('a, b');
    expect(headers.getSetCookie()).toEqual(['one=1', 'two=2']);
    expect([...headers]).toEqual([
      ['accept', 'a, b'],
      ['set-cookie', 'one=1'],
      ['set-cookie', 'two=2']
    ]);
  });

  it('iterates its names in order, whatever order they were written in', () => {
    expect([...new GuestHeaders({ zeta: '1', alpha: '2' }).keys()]).toEqual(['alpha', 'zeta']);
  });
});

describe("the guest's bodies", () => {
  it('types a string, a form and bytes as the web does, and keeps a type the code set', () => {
    expect(new GuestRequest('https://x.example.com', { method: 'POST', body: 'hi' }).headers.get('content-type')).toBe(
      'text/plain;charset=UTF-8'
    );
    expect(
      new GuestRequest('https://x.example.com', { method: 'POST', body: new URLSearchParams({ a: '1' }) }).headers.get(
        'content-type'
      )
    ).toBe('application/x-www-form-urlencoded;charset=UTF-8');
    expect(new GuestResponse(new Uint8Array([1, 2])).headers.has('content-type')).toBe(false);
    expect(
      new GuestResponse('{}', { headers: { 'content-type': 'application/json' } }).headers.get('content-type')
    ).toBe('application/json');
  });

  it('refuses a body this runtime has no way to carry, naming what it takes', () => {
    expect(() => new GuestResponse({ a: 1 })).toThrow(
      'A body is a string, bytes or URLSearchParams — this runtime has no streams, Blob or FormData'
    );
  });

  it('is read once', async () => {
    const response = new GuestResponse('once');

    expect(await response.text()).toBe('once');
    expect(response.bodyUsed).toBe(true);
    await expect(response.text()).rejects.toThrow('Body has already been read');
  });

  it('reads text as bytes and bytes as text', async () => {
    expect([...(await new GuestResponse('é').bytes())]).toEqual([0xc3, 0xa9]);
    expect(await new GuestResponse(new Uint8Array([0xc3, 0xa9])).text()).toBe('é');
    expect(await new GuestResponse(null).text()).toBe('');
  });

  it('copies a body as it was written: text stays text and bytes stay bytes', async () => {
    const text = new GuestResponse('kept', { status: 201, headers: { 'x-a': '1' } });
    const copy = text.clone();

    expect([await copy.text(), copy.status, copy.headers.get('x-a')]).toEqual(['kept', 201, '1']);
    expect(wireOf(new GuestResponse(new Uint8Array([1, 2, 3])).clone())).toEqual({ base64: 'AQID' });
  });
});

describe("the guest's Request", () => {
  it('upper-cases the methods it knows and keeps the others as written', () => {
    expect(new GuestRequest('https://x.example.com', { method: 'post' }).method).toBe('POST');
    expect(new GuestRequest('https://x.example.com', { method: 'Purge' }).method).toBe('Purge');
  });

  it('refuses a body on GET or HEAD', () => {
    expect(() => new GuestRequest('https://x.example.com', { method: 'get', body: 'x' })).toThrow(
      'A GET request has no body'
    );
    expect(() => new GuestRequest('https://x.example.com', { method: 'HEAD', body: 'x' })).toThrow(
      'A HEAD request has no body'
    );
  });

  it('takes what a request it is built from had, and the URL normalised', () => {
    const from = new GuestRequest('https://x.example.com/a/../b', { method: 'PUT', headers: { 'x-a': '1' } });
    const request = new GuestRequest(from);

    expect([request.url, request.method, request.headers.get('x-a')]).toEqual(['https://x.example.com/b', 'PUT', '1']);
  });
});

describe("the guest's Response", () => {
  it('takes a status from 200 to 599, and is ok for 2xx alone', () => {
    expect(() => new GuestResponse(null, { status: 101 })).toThrow('A response status is 200–599, not 101');
    expect(() => new GuestResponse(null, { status: 600 })).toThrow(RangeError);
    expect([new GuestResponse(null, { status: 204 }).ok, new GuestResponse(null, { status: 404 }).ok]).toEqual([
      true,
      false
    ]);
  });

  it('answers JSON typed as JSON, unless the code typed it', async () => {
    const response = GuestResponse.json({ a: 1 }, { status: 202 });

    expect([response.status, response.headers.get('content-type'), await response.json()]).toEqual([
      202,
      'application/json',
      { a: 1 }
    ]);
    expect(
      GuestResponse.json({}, { headers: { 'content-type': 'application/problem+json' } }).headers.get('content-type')
    ).toBe('application/problem+json');
  });

  it('redirects with a redirect status alone, to an absolute address', () => {
    expect(GuestResponse.redirect('https://x.example.com/a', 307).headers.get('location')).toBe(
      'https://x.example.com/a'
    );
    expect(() => GuestResponse.redirect('https://x.example.com/', 200)).toThrow('200 is not a redirect status');
  });
});

describe('a body across to the runner and back', () => {
  it('crosses text as text and bytes as base64, once', () => {
    const response = new GuestResponse('plain');

    expect(wireOf(response)).toEqual({ text: 'plain' });
    expect(() => wireOf(response)).toThrow('Body has already been read');
    expect(wireOf(new GuestResponse(null))).toBeNull();
  });

  it('reads back what the runner sent, and nothing it did not', () => {
    expect(bodyOfWire({ text: 'a' })).toBe('a');
    expect(bodyOfWire({ base64: 'AQID' })).toEqual(new Uint8Array([1, 2, 3]));
    expect(bodyOfWire({ other: 1 })).toBeNull();
    expect(bodyOfWire('text')).toBeNull();
    expect(headerPairs([['a', '1'], ['b'], 'c', ['d', 2], ['e', '5']])).toEqual([
      ['a', '1'],
      ['e', '5']
    ]);
    expect(headerPairs('a')).toEqual([]);
  });
});
