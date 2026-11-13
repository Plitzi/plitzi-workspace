import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import Settings from './Settings';

const page = (id: string, name: string, slug: string) => ({
  id,
  attributes: { name, slug },
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
