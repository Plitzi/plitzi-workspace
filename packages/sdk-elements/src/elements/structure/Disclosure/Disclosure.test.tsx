import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Disclosure } from './Disclosure';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { DisclosureProps } from './Disclosure';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

const surface = vi.hoisted(() => ({ previewMode: true }));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: surface.previewMode } })
}));

/** What the element's state became after each write, read off the updaters it was handed. */
let written: Record<string, unknown>[] = [];
const setElementState = <S extends Record<string, unknown> = Record<string, unknown>>(
  value?: S | ((prev: S) => S)
): boolean => {
  // The disclosure's own writes are updaters over the state it was handed: none, here.
  const empty = {} as S; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- no state to start from: `{}` is every state's empty one
  written.push(typeof value === 'function' ? value(empty) : (value ?? empty));

  return true;
};

const entry = elementEntry('question', { plitziJsxSkipHOC: true, setElementState });

/** The disclosure on a page at `href`, its summary first; `rerender` moves it to another page. */
const drawn = (props: DisclosureProps, href = 'https://site.test/') => {
  const tree = (at: string, next: DisclosureProps) => (
    <StoreProvider value={{ navigation: { href: at } }}>
      <ElementContext value={entry}>
        <Disclosure {...next}>
          <summary>Can I cancel?</summary>
          <p>Any time.</p>
        </Disclosure>
      </ElementContext>
    </StoreProvider>
  );
  const view = render(tree(href, props));

  return { ...view, moveTo: (at: string, next = props) => view.rerender(tree(at, next)) };
};

const details = () => screen.getByText('Can I cancel?').closest('details');

describe('Disclosure', () => {
  beforeEach(() => {
    written = [];
    surface.previewMode = true;
  });

  it('is a <details> with what it holds, open as it says', () => {
    drawn({ open: true, name: 'faq' });

    expect(details()?.open).toBe(true);
    expect(details()?.getAttribute('name')).toBe('faq');
    expect(screen.getByText('Any time.')).toBeTruthy();
  });

  it('keeps what the browser opened or closed — its summary pressed, find-in-page, its group', () => {
    drawn({ open: false });
    const element = details();
    if (!element) {
      throw new Error('no <details>');
    }

    element.open = true;
    fireEvent(element, new Event('toggle'));

    expect(written).toEqual([{ open: true }]);
  });

  it('closes on Escape and gives the focus back to its summary', () => {
    drawn({ open: true });
    const summary = screen.getByText('Can I cancel?');

    fireEvent.keyDown(screen.getByText('Any time.'), { key: 'Escape' });

    expect(written).toEqual([{ open: false }]);
    expect(document.activeElement).toBe(summary);
  });

  it('closes on a press outside only when asked, never on one inside', () => {
    drawn({ open: true, closeOnClickOutside: true });

    fireEvent.pointerDown(screen.getByText('Any time.'));
    expect(written).toEqual([]);

    fireEvent.pointerDown(document.body);
    expect(written).toEqual([{ open: false }]);
  });

  it('closes when the page changes, unless told to stay', () => {
    const { moveTo } = drawn({ open: true });

    act(() => moveTo('https://site.test/pricing'));
    expect(written).toEqual([{ open: false }]);

    written = [];
    act(() => moveTo('https://site.test/about', { open: true, closeOnNavigate: false }));
    expect(written).toEqual([]);
  });

  it('in the builder, stays open to be edited and its summary selects rather than closes it', () => {
    surface.previewMode = false;
    drawn({ open: false, name: 'faq' });

    expect(details()?.open).toBe(true);
    expect(details()?.hasAttribute('name')).toBe(false);

    const press = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByText('Can I cancel?').dispatchEvent(press);

    expect(press.defaultPrevented).toBe(true);
  });
});
