import { describe, expect, it } from 'vitest';

import { notificationsCss, notificationsProblem, splitNotificationsCss, withNotificationsCss } from './notifications';

describe('notifications', () => {
  it('says what is wrong with a spec instead of refusing it, for an editor to show', () => {
    expect(notificationsProblem({ background: 'var(--card)' })).toBeUndefined();
    expect(notificationsProblem({ colour: 'red' })).toContain('has no "colour"');
    expect(notificationsProblem({ background: 'red; } body {' })).toContain('not one CSS value');
  });

  it('writes and reads back the rule, apart from the own CSS of the space', () => {
    const written = withNotificationsCss('.a{}', { radius: '12px' });

    expect(notificationsCss({ radius: '12px' })).toContain('--toastify-toast-bd-radius: 12px;');
    expect(splitNotificationsCss(written)).toEqual({ notifications: { radius: '12px' }, customCss: '.a{}' });
  });

  it('names the field a misspelt one meant, given a way to tell', () => {
    const meant = (name: string, fields: readonly string[]) =>
      fields.includes(`${name}Size`) ? ` — did you mean "${name}Size"?` : '';

    expect(notificationsProblem({ icon: '18px' }, meant)).toContain(
      'has no "icon" — did you mean "iconSize"? It takes'
    );
  });

  it('dresses the parts inside the toast over the library’s own rules, and the close button only at rest', () => {
    expect(
      notificationsCss({
        minHeight: '0px',
        iconSize: '18px',
        closeColor: 'var(--muted)',
        closeOpacity: '0.8',
        progressHeight: '2px'
      })
    ).toBe(
      [
        '.Toastify__toast-container.plitzi-sdk-toasts {',
        '  --toastify-toast-min-height: 0px;',
        '}',
        '.Toastify__toast-container.plitzi-sdk-toasts .Toastify__toast-icon {',
        '  width: 18px;',
        '}',
        '.Toastify__toast-container.plitzi-sdk-toasts .Toastify__close-button {',
        '  color: var(--muted);',
        '}',
        '.Toastify__toast-container.plitzi-sdk-toasts .Toastify__close-button:not(:hover, :focus) {',
        '  opacity: 0.8;',
        '}',
        '.Toastify__toast-container.plitzi-sdk-toasts .Toastify__progress-bar--wrp {',
        '  height: 2px;',
        '}'
      ].join('\n')
    );
  });

  it('reads every field back as it was written, whatever rule it went to', () => {
    const spec = {
      background: 'var(--card)',
      fontWeight: '500',
      lineHeight: '1.45',
      minHeight: '0px',
      iconSize: '18px',
      iconGap: '10px',
      closeColor: 'var(--muted)',
      closeOpacity: '0.8',
      progressHeight: '2px'
    };
    const written = withNotificationsCss('.a{}', spec);

    expect(splitNotificationsCss(written)).toEqual({ notifications: spec, customCss: '.a{}' });
    expect(withNotificationsCss('.a{}', splitNotificationsCss(written).notifications)).toBe(written);
  });

  it('reads its own rule, not one of the space’s for the same part written before it', () => {
    const own = '.Toastify__toast-container.plitzi-sdk-toasts .Toastify__toast-icon {\n  display: none;\n}';
    const written = withNotificationsCss(own, { iconSize: '18px' });

    expect(splitNotificationsCss(written)).toEqual({ notifications: { iconSize: '18px' }, customCss: own });
  });
});
