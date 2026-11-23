// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import { forcedExperimentsCookieName } from '@plitzi/sdk-shared/experiments';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';

import ExperimentsViewer from './ExperimentsViewer';

import type { CommonState, Element } from '@plitzi/sdk-shared';

const node = (id: string, type: string, attributes: Record<string, unknown>, items: string[] = []): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: type, type, styleSelectors: { base: '' }, items }
});

/** A space running one A/B test of three variants, its visitor shown B. */
const state = (): Partial<CommonState> => ({
  schema: {
    ...EMPTY_SCHEMA.schema,
    flat: {
      hero: node('hero', 'variants', { experiment: 'heroTest' }, ['heroA', 'heroB', 'heroC']),
      heroA: node('heroA', 'variantItem', { weight: 50 }),
      heroB: node('heroB', 'variantItem', { weight: 30 }),
      heroC: node('heroC', 'variantItem', { weight: 20 })
    }
  },
  experiments: { assigned: { heroTest: 'b' } }
});

const cookieName = forcedExperimentsCookieName(window.location.host);

afterEach(() => {
  document.cookie = `${cookieName}=;path=/;max-age=0`;
});

describe('ExperimentsViewer', () => {
  it('lists every experiment with the variant this page shows and each variant’s share', () => {
    render(createElement(StoreProvider, { value: state() }, createElement(ExperimentsViewer)));

    expect(screen.getByText('heroTest')).toBeTruthy();
    expect(screen.getByText('shows B')).toBeTruthy();
    expect(screen.getByText('A 50% · B 30% · C 20%')).toBeTruthy();
  });

  it('forces a variant for the page that is open and for the next one this browser asks for', () => {
    const store = createStore<Partial<CommonState>>(state());
    render(createElement(StoreProvider, { store }, createElement(ExperimentsViewer)));

    fireEvent.click(screen.getByTitle('Force variant C (weight 20) for this browser'));

    expect(store.get('experiments.qa')).toEqual({ heroTest: 'c' });
    expect(document.cookie).toContain(`${cookieName}=heroTest%3Ac`);

    fireEvent.click(screen.getByText('Stop forcing all'));

    expect(store.get('experiments.qa')).toEqual({});
    expect(document.cookie).not.toContain(cookieName);
  });

  it('says so when the space runs none', () => {
    render(createElement(StoreProvider, { value: { schema: EMPTY_SCHEMA.schema } }, createElement(ExperimentsViewer)));

    expect(screen.getByText('This space runs no A/B tests')).toBeTruthy();
  });
});
