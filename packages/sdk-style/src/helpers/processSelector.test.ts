import { describe, it, expect } from 'vitest';

import processSelector from './processSelector';

describe('processSelector', () => {
  it('functionality', () => {
    const result = processSelector({
      name: 'page-1',
      type: 'class',
      attributes: {
        'align-items': 'center',
        'justify-content': 'space-around',
        'row-gap': '32px',
        'column-gap': '32px',
        'flex-wrap': 'nowrap',
        'flex-direction': 'column',
        'padding-right': '10px'
      },
      variables: {
        color: {
          fancyVariable: {
            light: '#111',
            dark: '#000',
            default: '#111'
          }
        }
      }
    });
    expect(result).toEqual(
      '.page-1{align-items:center;justify-content:space-around;row-gap:32px;column-gap:32px;flex-wrap:nowrap;flex-direction:column;padding-right:10px;--fancyVariable:#111;}@media(prefers-color-scheme:light){.page-1{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.page-1{--fancyVariable:#000;}}'
    );
  });
});
