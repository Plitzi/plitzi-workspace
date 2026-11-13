import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import Settings from './Settings';

const page = (id: string, name: string, slug: string, folder = '') => ({
  id,
  attributes: { name, slug, ...(folder ? { folder } : {}) },
  definition: { rootId: id, label: name, type: 'page', items: [], styleSelectors: { base: '' } }
});

const schema = {
  flat: {
    home: page('home', 'Home', ''),
    billing: page('billing', 'Billing', 'billing'),
    login: page('login', 'Sign in', 'login')
  },
  pages: ['home', 'billing', 'login'],
  pageFolders: []
};

const drawn = (props: Parameters<typeof Settings>[0]) =>
  render(
    <StoreProvider value={{ schema }}>
      <Settings {...props} />
    </StoreProvider>
  );

afterEach(() => localStorage.clear());

/** A section's header, by its title. */
const header = (title: string) => screen.getByText(title, { exact: true });

describe('a page’s settings', () => {
  it('open on the page’s own fields, and say on every closed header what it holds', () => {
    drawn({
      id: 'billing',
      name: 'Billing',
      slug: 'billing',
      accessLevel: 'authenticated',
      unauthorizedBehaviour: 'redirect',
      unauthorizedPageRedirect: 'login',
      documentScroll: 'locked'
    });

    expect(screen.getByText('Page Name')).toBeTruthy();
    expect(screen.getByText('Slug / Path')).toBeTruthy();
    expect(screen.getByText('Folder')).toBeTruthy();
    expect(screen.getByText('Signed-in visitors · others to Sign in')).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.queryByText('Restrict Access')).toBeNull();
  });

  // A redesign is the same settings, laid out: every field the form had is one click away.
  it('keeps every field it had, each in its section', () => {
    drawn({ id: 'billing', accessLevel: 'authenticated', unauthorizedBehaviour: 'redirect', seoEnabled: true });

    fireEvent.click(header('Access'));
    fireEvent.click(header('Scroll'));
    fireEvent.click(header('Search & sharing'));
    fireEvent.click(header('Previews'));

    for (const label of [
      'Page Enabled',
      'Page Name',
      'Slug / Path',
      'Folder',
      'Restrict Access',
      'Required permissions',
      'Unauthorized Behaviour',
      'Redirect Page',
      'Document Scroll',
      'SEO Enabled',
      'SEO Title',
      'SEO Description',
      'Robots',
      'Kind of page',
      'Share image',
      'Share image description'
    ]) {
      expect(screen.getAllByText(label, { exact: false }).length, label).toBeGreaterThan(0);
    }

    expect(screen.getByText(/show in search results/)).toBeTruthy();
  });
});

describe('a page’s settings and the 404 page', () => {
  const withLost = {
    flat: {
      home: page('home', 'Home', ''),
      lost: page('lost', 'Not found', '*'),
      about: page('about', 'About', 'about'),
      guide: page('guide', 'Guide', 'guide', 'docs')
    },
    pages: ['home', 'lost', 'about', 'guide'],
    pageFolders: [{ id: 'docs', name: 'Docs', slug: 'docs' }]
  };
  const drawnIn = (props: Parameters<typeof Settings>[0]) =>
    render(
      <StoreProvider value={{ schema: withLost }}>
        <Settings {...props} />
      </StoreProvider>
    );

  // One per place: a second `*` would leave the router to pick one of the two.
  it('refuses a second 404 page in the same place, saying which one it is and how to swap them', () => {
    const onUpdate = vi.fn();
    drawnIn({ id: 'about', name: 'About', slug: 'about', onUpdate });

    fireEvent.change(screen.getByDisplayValue('about'), { target: { value: '*' } });

    expect(onUpdate).not.toHaveBeenCalledWith('slug', '*');
    expect(screen.getByText(/"Not found" is already the 404 page of the space: one per place/)).toBeTruthy();
  });

  it('takes one in a folder that has none, and says on the 404 page what it is', () => {
    const onUpdate = vi.fn();
    drawnIn({ id: 'guide', name: 'Guide', slug: 'guide', folder: 'docs', onUpdate });
    fireEvent.change(screen.getByDisplayValue('guide'), { target: { value: '*' } });
    expect(onUpdate).toHaveBeenCalledWith('slug', '*');
  });

  it('says on the 404 page what it is, on its header too', () => {
    drawnIn({ id: 'lost', name: 'Not found', slug: '*' });

    expect(screen.getByText('404 page')).toBeTruthy();
    expect(screen.getByText(/The 404 page of the space: every address no other page answers lands here/)).toBeTruthy();
  });
});
