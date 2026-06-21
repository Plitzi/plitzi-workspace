import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore';

type State = {
  user: {
    profile: {
      name: string;
      email: string;
    };
  };
  count: number;
};

const createTestStore = () =>
  createStore<State>({
    user: { profile: { name: 'Carlos', email: 'c@plitzi.com' } },
    count: 0
  });

describe('get/set/watch facade', () => {
  describe('get', () => {
    it('returns the whole state when called without a path', () => {
      const store = createTestStore();

      expect(store.get()).toEqual({
        user: { profile: { name: 'Carlos', email: 'c@plitzi.com' } },
        count: 0
      });
    });

    it('resolves a single path', () => {
      const store = createTestStore();

      expect(store.get('user.profile.name')).toBe('Carlos');
      expect(store.get('count')).toBe(0);
    });

    it('mirrors getState/getPath', () => {
      const store = createTestStore();

      expect(store.get()).toEqual(store.getState());
      expect(store.get('user.profile.email')).toBe(store.getPath('user.profile.email'));
    });
  });

  describe('set', () => {
    it('writes a path and is readable through get', () => {
      const store = createTestStore();
      store.set('user.profile.name', 'Ada');

      expect(store.get('user.profile.name')).toBe('Ada');
    });

    it('accepts an updater function', () => {
      const store = createTestStore();
      store.set('count', prev => prev + 5);

      expect(store.get('count')).toBe(5);
    });

    it('is the same reference as setState', () => {
      const store = createTestStore();

      expect(store.set).toBe(store.setState);
    });
  });

  describe('watch', () => {
    it('fires on any change when called without a path', () => {
      const store = createTestStore();
      const spy = vi.fn();
      store.watch(spy);

      store.set('count', 1);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('fires only for the watched path', () => {
      const store = createTestStore();
      const spy = vi.fn();
      store.watch('user.profile.name', spy);

      store.set('count', 1);
      expect(spy).not.toHaveBeenCalled();

      store.set('user.profile.name', 'Ada');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function', () => {
      const store = createTestStore();
      const spy = vi.fn();
      const unsubscribe = store.watch('count', spy);

      store.set('count', 1);
      unsubscribe();
      store.set('count', 2);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('withBase facade', () => {
    it('exposes get/set/watch prefixed with the base path', () => {
      const store = createTestStore();
      const profile = store.withBase('user.profile');
      const spy = vi.fn();
      profile.watch('name', spy);

      profile.set('name', 'Ada');

      expect(profile.get('name')).toBe('Ada');
      expect(store.get('user.profile.name')).toBe('Ada');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('reads the base value with get() and no arguments', () => {
      const store = createTestStore();
      const profile = store.withBase('user.profile');

      expect(profile.get()).toEqual({ name: 'Carlos', email: 'c@plitzi.com' });
    });
  });
});
