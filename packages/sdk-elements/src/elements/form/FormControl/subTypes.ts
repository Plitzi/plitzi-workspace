/**
 * Every kind of field a `formControl` is, as its `subType` — the one list: the component's props, the field-value HOC,
 * the builder's settings and the declaration authoring reads all take their type from here.
 */
export const FORM_CONTROL_SUBTYPES = [
  'text',
  'number',
  'email',
  'password',
  // A search box: the browser draws its clear button, and a phone shows its search key.
  'search',
  'url',
  // A phone number: a phone shows its dial pad.
  'tel',
  'date',
  'time',
  'checkbox',
  'switch',
  'select',
  'textarea',
  'hidden',
  // The browser's own colour picker: its value is `#rrggbb`.
  'color',
  // A file picked from the device: its value is the `File`, which a `webHook` step sends as a multipart form, under the
  // control's `name`.
  'file'
] as const;

export type FormControlSubType = (typeof FORM_CONTROL_SUBTYPES)[number];

/** The ones drawn as an `<input>` of that type — `Input`; the rest have a component of their own. */
export const INPUT_SUBTYPES: readonly FormControlSubType[] = [
  'text',
  'number',
  'email',
  'password',
  'search',
  'url',
  'tel',
  'date',
  'time',
  'color'
];

/** The ones that hold text somebody types: what a length, a pattern or a confirmation can mean anything for. */
export const TYPED_SUBTYPES: readonly FormControlSubType[] = [
  'text',
  'textarea',
  'number',
  'email',
  'password',
  'search',
  'url',
  'tel'
];

/**
 * What the builder's Input Type menu calls each, in the order it lists them — a `Record`, so a subtype added above and
 * not here is a compile error rather than a type nobody can pick.
 */
export const SUBTYPE_LABELS: Record<FormControlSubType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  time: 'Time',
  email: 'Email',
  search: 'Search',
  url: 'URL',
  tel: 'Phone',
  password: 'Password',
  select: 'Select',
  checkbox: 'Checkbox',
  switch: 'Switch',
  textarea: 'Long Text',
  hidden: 'Hidden',
  color: 'Color',
  file: 'File'
};

/** A checkbox and a switch: one box that holds `true` or `false`, drawn inside its label. */
export const CHECK_SUBTYPES: readonly FormControlSubType[] = ['checkbox', 'switch'];
