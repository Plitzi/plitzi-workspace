import { describe, expect, it } from 'vitest';

import { notificationsCss } from './notifications';

describe('notificationsCss', () => {
  it('sets the library’s variables on the container, and nothing when nothing is asked', () => {
    expect(notificationsCss({ background: 'var(--card)', font: 'var(--font-sans)', shadow: 'var(--shadow-lg)' })).toBe(
      [
        '.Toastify__toast-container.plitzi-sdk-toasts {',
        '  --toastify-color-light: var(--card);',
        '  --toastify-color-dark: var(--card);',
        '  --toastify-font-family: var(--font-sans);',
        '  --toastify-toast-shadow: var(--shadow-lg);',
        '}'
      ].join('\n')
    );
    expect(notificationsCss(undefined)).toBe('');
  });

  it('writes what the library has no variable for on the toast itself, weighing nothing', () => {
    expect(notificationsCss({ fontSize: '13px', border: '1px solid var(--border)' })).toBe(
      [
        ':where(.Toastify__toast-container.plitzi-sdk-toasts .Toastify__toast) {',
        '  font-size: 13px;',
        '  border: 1px solid var(--border);',
        '}'
      ].join('\n')
    );
  });

  it('refuses a field it does not know, and a value that is not one CSS value', () => {
    expect(() => notificationsCss({ colour: 'red' } as never)).toThrow('It takes background, text');
    expect(() => notificationsCss({ border: '1px solid red; color: blue' })).toThrow('not one CSS value');
  });
});
