// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import { flagsCookieName } from '@plitzi/sdk-shared/flags';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';

import FlagsViewer from './FlagsViewer';

import type { CommonState } from '@plitzi/sdk-shared';

const state = (): Partial<CommonState> => ({
  schema: {
    ...EMPTY_SCHEMA.schema,
    flags: {
      newCheckout: { description: 'The checkout in one step', value: false, rules: [] },
      legacyNav: { value: true, rules: [] }
    }
  },
  flags: {
    overrides: {},
    resolved: { newCheckout: { value: false, layer: 'space' }, legacyNav: { value: true, layer: 'space' } }
  }
});

const cookieName = flagsCookieName(window.location.host);

afterEach(() => {
  document.cookie = `${cookieName}=;path=/;max-age=0`;
});

describe('FlagsViewer', () => {
  it('lists every declared flag with what decided it', () => {
    render(createElement(StoreProvider, { value: state() }, createElement(FlagsViewer)));

    expect(screen.getByText('newCheckout')).toBeTruthy();
    expect(screen.getByText('The checkout in one step')).toBeTruthy();
    expect(screen.getAllByText('default')).toHaveLength(2);
  });

  it('forces a flag for the page that is open and for the next one this browser asks for', () => {
    const store = createStore<Partial<CommonState>>(state());
    render(createElement(StoreProvider, { store }, createElement(FlagsViewer)));

    fireEvent.click(screen.getAllByTitle('Force this flag on for this browser')[0]);

    expect(store.get('flags.overrides.qa')).toEqual({ newCheckout: true });
    expect(document.cookie).toContain(`${cookieName}=newCheckout%3A1`);

    fireEvent.click(screen.getByText('Stop forcing all'));

    expect(store.get('flags.overrides.qa')).toEqual({});
    expect(document.cookie).not.toContain(cookieName);
  });

  it('says so when the space declares none', () => {
    render(
      createElement(StoreProvider, { value: { schema: {} as CommonState['schema'] } }, createElement(FlagsViewer))
    );

    expect(screen.getByText('This space declares no feature flags')).toBeTruthy();
  });
});
