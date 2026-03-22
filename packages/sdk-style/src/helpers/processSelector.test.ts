import { describe, it, expect } from 'vitest';

import processSelector, { processSelectorsMultiLine } from './processSelector';

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
      },
      cache: ''
    });
    expect(result).toEqual(
      '.page-1{align-items:center;justify-content:space-around;row-gap:32px;column-gap:32px;flex-wrap:nowrap;flex-direction:column;padding-right:10px;--fancyVariable:#111;}@media(prefers-color-scheme:light){.page-1{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.page-1{--fancyVariable:#000;}}'
    );

    const result2 = processSelector(
      {
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
        },
        cache: ''
      },
      false
    );
    expect(result2).toEqual(
      `.page-1 {
  align-items: center;
  justify-content: space-around;
  row-gap: 32px;
  column-gap: 32px;
  flex-wrap: nowrap;
  flex-direction: column;
  padding-right: 10px;
  --fancyVariable: #111;
}

@media(prefers-color-scheme: light) {
  .page-1 {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .page-1 {
    --fancyVariable: #000;
  }
}`
    );
  });

  it('functionality when is element', () => {
    const result = processSelector({
      name: 'button',
      type: 'element',
      componentType: 'button',
      attributes: {
        base: {
          'align-items': 'center',
          'justify-content': 'space-around',
          'row-gap': '32px',
          'column-gap': '32px',
          'flex-wrap': 'nowrap',
          'flex-direction': 'column',
          'padding-right': '10px'
        }
      },
      variables: {
        color: {
          fancyVariable: {
            light: '#111',
            dark: '#000',
            default: '#111'
          }
        }
      },
      cache: ''
    });
    expect(result).toEqual(
      '.button{align-items:center;justify-content:space-around;row-gap:32px;column-gap:32px;flex-wrap:nowrap;flex-direction:column;padding-right:10px;--fancyVariable:#111;}@media(prefers-color-scheme:light){.button{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.button{--fancyVariable:#000;}}'
    );

    const result2 = processSelector(
      {
        name: 'button',
        type: 'element',
        componentType: 'button',
        attributes: {
          base: {
            'align-items': 'center',
            'justify-content': 'space-around',
            'row-gap': '32px',
            'column-gap': '32px',
            'flex-wrap': 'nowrap',
            'flex-direction': 'column',
            'padding-right': '10px'
          }
        },
        variables: {
          color: {
            fancyVariable: {
              light: '#111',
              dark: '#000',
              default: '#111'
            }
          }
        },
        cache: ''
      },
      false
    );
    expect(result2).toEqual(
      `.button {
  align-items: center;
  justify-content: space-around;
  row-gap: 32px;
  column-gap: 32px;
  flex-wrap: nowrap;
  flex-direction: column;
  padding-right: 10px;
  --fancyVariable: #111;
}

@media(prefers-color-scheme: light) {
  .button {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .button {
    --fancyVariable: #000;
  }
}`
    );

    const result3 = processSelector({
      name: 'button',
      type: 'element',
      componentType: 'button',
      attributes: {
        base: {
          'align-items': 'center',
          'justify-content': 'space-around',
          'row-gap': '32px',
          'column-gap': '32px',
          'flex-wrap': 'nowrap',
          'flex-direction': 'column',
          'padding-right': '10px'
        },
        selectorA: {
          color: 'red'
        }
      },
      variables: {
        color: {
          fancyVariable: {
            light: '#111',
            dark: '#000',
            default: '#111'
          }
        }
      },
      cache: ''
    });
    expect(result3).toEqual(
      '.button{align-items:center;justify-content:space-around;row-gap:32px;column-gap:32px;flex-wrap:nowrap;flex-direction:column;padding-right:10px;--fancyVariable:#111;.button--selectorA{color:red;}}@media(prefers-color-scheme:light){.button{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.button{--fancyVariable:#000;}}'
    );

    const result4 = processSelector(
      {
        name: 'button',
        type: 'element',
        componentType: 'button',
        attributes: {
          base: {
            'align-items': 'center',
            'justify-content': 'space-around',
            'row-gap': '32px',
            'column-gap': '32px',
            'flex-wrap': 'nowrap',
            'flex-direction': 'column',
            'padding-right': '10px'
          },
          selectorA: {
            color: 'red'
          }
        },
        variables: {
          color: {
            fancyVariable: {
              light: '#111',
              dark: '#000',
              default: '#111'
            }
          }
        },
        cache: ''
      },
      false
    );
    expect(result4).toEqual(
      `.button {
  align-items: center;
  justify-content: space-around;
  row-gap: 32px;
  column-gap: 32px;
  flex-wrap: nowrap;
  flex-direction: column;
  padding-right: 10px;
  --fancyVariable: #111;

  .button--selectorA {
    color: red;
  }
}

@media(prefers-color-scheme: light) {
  .button {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .button {
    --fancyVariable: #000;
  }
}`
    );
  });

  describe('processSelector.processSelectorsMultiLine', () => {
    it('functionality', () => {
      const result = processSelectorsMultiLine([
        {
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
          },
          cache: ''
        },
        {
          name: 'page-2',
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
          },
          cache: ''
        }
      ]);
      expect(result).toEqual([
        `.page-1 {
  align-items: center;
  justify-content: space-around;
  row-gap: 32px;
  column-gap: 32px;
  flex-wrap: nowrap;
  flex-direction: column;
  padding-right: 10px;
  --fancyVariable: #111;
}

@media(prefers-color-scheme: light) {
  .page-1 {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .page-1 {
    --fancyVariable: #000;
  }
}`,
        `.page-2 {
  align-items: center;
  justify-content: space-around;
  row-gap: 32px;
  column-gap: 32px;
  flex-wrap: nowrap;
  flex-direction: column;
  padding-right: 10px;
  --fancyVariable: #111;
}

@media(prefers-color-scheme: light) {
  .page-2 {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .page-2 {
    --fancyVariable: #000;
  }
}`
      ]);
    });
  });
});
