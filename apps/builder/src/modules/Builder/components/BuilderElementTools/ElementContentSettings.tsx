import Input from '@plitzi/plitzi-ui/Input';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback } from 'react';

import contentAttributesFor from './contentAttributesFor';

import type { ComponentDefinition, Element } from '@plitzi/sdk-shared';

/** What each content attribute is called on the form; the rest are said from their name. */
const LABELS: Readonly<Record<string, string>> = {
  content: 'Text',
  href: 'Link address',
  src: 'Source',
  alt: 'Text alternative',
  label: 'Label',
  placeholder: 'Placeholder',
  title: 'Title',
  seoPageTitle: 'Page title (search engines)',
  seoPageDescription: 'Page description (search engines)'
};

/** The attributes whose words run to several lines. */
const LONG: ReadonlySet<string> = new Set(['content', 'seoPageDescription']);

const labelOf = (name: string): string =>
  LABELS[name] ?? name.replace(/([A-Z])/g, ' $1').replace(/^./, first => first.toUpperCase());

type Option = { label: string; value: unknown };

const isOptionList = (value: unknown): value is Option[] =>
  Array.isArray(value) &&
  value.every(
    (each: unknown) => typeof each === 'object' && each !== null && 'label' in each && typeof each.label === 'string'
  );

export type ElementContentSettingsProps = {
  type: string;
  /** What the builder registered for the type: a plugin's carries its manifest. */
  registered: ComponentDefinition | undefined;
  attributes: Element['attributes'];
  /** The role views the space: the content is shown, never changed. */
  readOnly: boolean;
  onChange: (key: string, value: string | Option[]) => void;
};

/**
 * The inspector of a role that edits the content and not the design: the element's content attributes —
 * its words, a link's address, an image's source — as a form, read as the server's gate reads them
 * (`contentAttributesFor`). Nothing else of the element is offered, so nothing is changed that the server would refuse.
 * A select's choices are its labels alone: their values are what the page reads, the design's to change.
 */
const ElementContentSettings = ({ type, registered, attributes, readOnly, onChange }: ElementContentSettingsProps) => {
  const names = contentAttributesFor(type, registered);
  const relabel = useCallback(
    (name: string, options: Option[], index: number) => (label: string) =>
      onChange(
        name,
        options.map((option, at) => (at === index ? { ...option, label } : option))
      ),
    [onChange]
  );

  if (names.length === 0) {
    return (
      <p className="m-0 px-2 text-xs text-gray-500 dark:text-zinc-400">
        This element has no words, link or picture of its own to edit.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-2">
      <p className="m-0 text-xs text-gray-500 dark:text-zinc-400">
        {readOnly
          ? 'You can view this space: its content is shown, not changed.'
          : 'You can edit the content — the words, links and pictures — not the design.'}
      </p>
      {names.map(name => {
        const value: unknown = attributes[name];
        if (isOptionList(value)) {
          return (
            <fieldset key={name} className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="mb-1 text-xs font-semibold">{labelOf(name)}</legend>
              {value.map((option, index) => (
                <Input
                  key={String(index)}
                  size="xs"
                  value={option.label}
                  aria-label={`${labelOf(name)} ${String(index + 1)}`}
                  readOnly={readOnly}
                  onChange={relabel(name, value, index)}
                />
              ))}
            </fieldset>
          );
        }

        const text = typeof value === 'string' ? value : '';
        const change = (next: string) => onChange(name, next);

        return LONG.has(name) ? (
          <TextArea key={name} size="xs" label={labelOf(name)} value={text} readOnly={readOnly} onChange={change} />
        ) : (
          <Input key={name} size="xs" label={labelOf(name)} value={text} readOnly={readOnly} onChange={change} />
        );
      })}
    </div>
  );
};

export default ElementContentSettings;
