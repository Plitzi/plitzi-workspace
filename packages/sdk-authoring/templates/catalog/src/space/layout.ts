/**
 * The chrome every page shares — a header with the menu, and a footer — written once. Pages name the layout and the
 * slot their body goes in (`site-main`); the current menu entry marks itself, not each page.
 */
import { container, link, styles, text } from '@plitzi/sdk-authoring';

import { t } from './tokens.ts';

import type { LayoutSpec } from '@plitzi/sdk-authoring';

const shell = styles('shell', {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: t.background,
  color: t.foreground,
  fontFamily: 'system-ui, sans-serif'
});

const header = styles('site-header', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  borderBottom: `1px solid ${t.border}`
});

const brand = styles('brand', { fontWeight: 700, color: t.foreground, textDecoration: 'none' });

const nav = styles('nav', { display: 'flex', gap: 20 });

const navLink = styles('nav-link', {
  css: { color: t.muted, textDecoration: 'none' },
  states: { current: { color: t.foreground, fontWeight: 600 } }
});

const main = styles('main', {
  flexGrow: 1,
  width: '100%',
  maxWidth: '1120px',
  margin: '0px auto',
  padding: '40px 24px'
});

const footer = styles('site-footer', { padding: '24px', color: t.muted, fontSize: '14px', textAlign: 'center' });

/** The menu: one entry per section — Products stays current on every product, which is under its path. */
const MENU = [
  { href: '/', label: 'Home', current: 'page' },
  { href: '/products', label: 'Products', current: 'section' }
] as const;

export const layout: LayoutSpec = {
  id: 'site',
  body: [
    container({
      id: 'site-shell',
      class: shell,
      children: [
        container({
          id: 'site-header',
          subType: 'header',
          class: header,
          children: [
            link({ id: 'site-brand', href: '/', class: brand, content: 'Desk & Co.' }),
            container({
              id: 'site-nav',
              subType: 'nav',
              class: nav,
              children: MENU.map(entry =>
                link({
                  href: entry.href,
                  class: navLink,
                  current: entry.current,
                  content: entry.label
                })
              )
            })
          ]
        }),
        container({ id: 'site-main', subType: 'main', class: main }),
        container({
          id: 'site-footer',
          subType: 'footer',
          class: footer,
          children: [text('Demo content: the products and their prices are made up.')]
        })
      ]
    })
  ]
};
