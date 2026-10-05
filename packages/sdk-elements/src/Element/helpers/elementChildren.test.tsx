import { render } from '@testing-library/react';
import { Fragment } from 'react';
import { describe, expect, it } from 'vitest';

import elementChildren from './elementChildren';
import pluginSelector from './pluginSelector';
import ServerStaticShell from '../ServerStaticShell';

import type { ComponentPluginWithHOC } from '@plitzi/sdk-shared';

const Window = ({ internalProps }: { internalProps: { id: string } }) => <p>window {internalProps.id}</p>;
// A bare component stands in for a registered one: the HOC's static fields are not what is under test.
const components = { container: Window as unknown as ComponentPluginWithHOC };

/** An item exactly as a container's items are built (`useInternalItems`). */
const item = (id: string) =>
  pluginSelector({ key: id, type: 'container', internalProps: { id, rootId: 'page' }, components, plugins: {} });

describe('elementChildren', () => {
  it('hands over each of the space’s elements with the id it was authored under, in order', () => {
    const children = [item('feed'), item('dossier')];

    expect(elementChildren(children).map(child => child.id)).toEqual(['feed', 'dossier']);
  });

  it('knows a server element waiting in its shell by the element’s id', () => {
    const children = [
      <ServerStaticShell key="rates" id="rates">
        {item('rates')}
      </ServerStaticShell>,
      item('feed')
    ];

    expect(elementChildren(children).map(child => child.id)).toEqual(['rates', 'feed']);
  });

  it('leaves out what is not one of the space’s elements', () => {
    const children = [item('feed'), <Fragment key="#layout-body">the page</Fragment>, 'text', null];

    expect(elementChildren(children).map(child => child.id)).toEqual(['feed']);
  });

  it('takes a single child as well as a list', () => {
    expect(elementChildren(item('only')).map(child => child.id)).toEqual(['only']);
    expect(elementChildren(undefined)).toEqual([]);
  });

  it('gives back nodes a plugin renders in boxes of its own', () => {
    const { container } = render(
      <div>
        {elementChildren([item('feed'), item('dossier')]).map(({ id, node }) => (
          <section key={id} data-slot={id}>
            {node}
          </section>
        ))}
      </div>
    );

    expect([...container.querySelectorAll('section')].map(slot => slot.textContent)).toEqual([
      'window feed',
      'window dossier'
    ]);
  });
});
