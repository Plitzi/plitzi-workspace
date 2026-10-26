import { describe, expect, it } from 'vitest';

import { browserServerInput, inputProviders, serverInputOf } from './serverInput';

import type { Element, ElementBinding } from '../types';

const provider = (
  input: unknown,
  bindings: Omit<ElementBinding, 'id'>[]
): Pick<Element, 'attributes' | 'definition'> => ({
  attributes: { action: 'dm-thread', input },
  definition: {
    type: 'apiContainer',
    bindings: { attributes: bindings.map((binding, index) => ({ id: `b${String(index)}`, ...binding })) }
    // A provider's definition holds more than a fixture needs; what this reads is its type and its bindings.
  } as Element['definition']
});

const template = (body: string) => [{ action: 'twigTemplate', params: { template: body, returnMode: 'value' } }];

const address = { routeParams: { username: 'mika' }, queryParams: { page: '2' } };

// A conversation's provider bound `{ with: routeParams.username }` reached the page server with no `with`: refused on
// every load and logged with a stack, while the browser asked again and drew it.
describe('the input a server provider is resolved with on the page server', () => {
  it('applies a binding that reads the address alone — the route, the query', () => {
    expect(
      serverInputOf(
        provider({}, [
          { to: 'input', source: 'navigation.routeParams.username', transformers: template('{{ { with: source } }}') }
        ]),
        address
      )
    ).toEqual({ with: 'mika' });
    expect(
      serverInputOf(provider({ size: 10 }, [{ to: 'input.page', source: 'navigation.queryParams.page' }]), address)
    ).toEqual({ size: 10, page: '2' });
  });

  it('leaves the browser a binding that reads the visitor’s state, or holds a condition — the saved input stays', () => {
    const saved = { with: '' };
    expect(serverInputOf(provider(saved, [{ to: 'input', source: 'state.open' }]), address)).toBe(saved);
    expect(
      serverInputOf(
        provider(saved, [
          {
            to: 'input',
            source: 'navigation.routeParams.username',
            transformers: template('{{ { with: source, draft: state.draft } }}')
          }
        ]),
        address
      )
    ).toBe(saved);
    expect(
      serverInputOf(
        provider(saved, [
          {
            to: 'input',
            source: 'navigation.routeParams.username',
            when: { combinator: 'and', rules: [{ field: 'auth.isAuthenticated', operator: '=', value: true }] }
          }
        ]),
        address
      )
    ).toBe(saved);
  });
});

// A room's crate bound its person to the room's answer: resolved on the page server with none, refused on every load.
describe('a server provider’s input bound to another server provider', () => {
  const crate = provider({}, [
    { to: 'input', source: 'apiContainer_room.data.host', transformers: template('{{ { username: source } }}') }
  ]);

  it('waits on the providers whose answers it reads, and on nothing the server cannot know', () => {
    expect(inputProviders(crate, new Set(['room']))).toEqual(['room']);
    expect(inputProviders(crate, new Set())).toEqual([]);
    expect(inputProviders(provider({}, [{ to: 'input', source: 'state.who' }]), new Set(['room']))).toEqual([]);
  });

  it('is worked out by the browser from the payload it was sent, the same — and nothing from no payload', () => {
    expect(browserServerInput(crate, {}, { room: { data: { host: 'dax' } } }, address)).toEqual({ username: 'dax' });
    expect(browserServerInput(crate, undefined, undefined, address)).toEqual({});
    expect(browserServerInput(undefined, {}, {}, address)).toBeUndefined();
  });

  it('is resolved with their answers, as the browser publishes them', () => {
    expect(serverInputOf(crate, address, { apiContainer_room: { data: { host: 'dax' } } })).toEqual({
      username: 'dax'
    });
    expect(serverInputOf(crate, address)).toEqual({});
  });
});
