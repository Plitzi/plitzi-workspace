/**
 * Whether a checkbox or a switch is on, from the value its field holds.
 *
 * Inside a form the value is the form's: `true`/`false` once the box has been clicked, the `defaultValue` string before
 * that. Outside one the control keeps its own, as the string `'true'`/`'false'`. Both read the same way here, so a
 * default or a binding of `'true'` shows the box ticked.
 */
export const isChecked = (value: unknown): boolean => value === true || value === 'true';
