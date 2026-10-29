import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import contentAttributesFor from './contentAttributesFor';
import ElementContentSettings from './ElementContentSettings';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

/**
 * What a role that edits the content and not the design is offered of an element — its content attributes
 * (the declaration's), as fields; a viewer sees them and changes nothing; an element with none says so.
 */
describe('ElementContentSettings', () => {
  it('offers a link its words, address and label, and says each change', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <ElementContentSettings
        type="link"
        registered={undefined}
        attributes={{ content: 'Read more', href: '/about', label: '', target: 'self' }}
        readOnly={false}
        onChange={onChange}
      />
    );

    fireEvent.change(getByLabelText('Link address'), { target: { value: '/team' } });

    expect(onChange).toHaveBeenCalledWith('href', '/team');
    expect(getByLabelText('Text')).toHaveProperty('value', 'Read more');
    expect(() => getByLabelText('Target')).toThrow();
  });

  it('shows a viewer the content, never to change it', () => {
    const { getByLabelText, getByText } = render(
      <ElementContentSettings
        type="heading"
        registered={undefined}
        attributes={{ content: 'Welcome' }}
        readOnly
        onChange={vi.fn()}
      />
    );

    expect(getByLabelText('Text')).toHaveProperty('readOnly', true);
    expect(getByText(/You can view this space/).textContent).toContain('not changed');
  });

  it('says an element has nothing to edit when its type declares no content', () => {
    const { getByText } = render(
      <ElementContentSettings
        type="container"
        registered={undefined}
        attributes={{}}
        readOnly={false}
        onChange={vi.fn()}
      />
    );

    expect(getByText(/no words, link or picture of its own/).tagName).toBe('P');
  });

  it('reads a plugin’s content attributes from its manifest, over a built-in type of the same name', () => {
    // Only what the form reads of a registered plugin: that it came with a manifest, and what it names as content.
    const plugin = { manifest: {}, contentAttributes: ['caption'] } as unknown as ComponentDefinition;

    expect(contentAttributesFor('seatPicker', plugin)).toEqual(['caption']);
    expect(contentAttributesFor('heading', { ...plugin, contentAttributes: undefined })).toEqual([]);
    expect(contentAttributesFor('heading', undefined)).toEqual(['content']);
  });
});
