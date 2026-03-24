import { describe, it, expect } from 'vitest';

import processSelector, { processSelectors } from './processSelector';

import type { StyleItem } from '@plitzi/sdk-shared';

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

  it('functionality + state', () => {
    const result = processSelector({
      name: 'btn',
      type: 'class',
      attributes: {
        color: 'blue'
      },
      stateAttributes: {
        hover: {
          color: 'red'
        }
      },
      cache: ''
    });

    expect(result).toEqual('.btn{color:blue;&:hover{color:red;}}');

    const result2 = processSelector(
      {
        name: 'btn',
        type: 'class',
        attributes: {
          color: 'blue'
        },
        stateAttributes: {
          hover: {
            color: 'red'
          }
        },
        cache: ''
      },
      false
    );

    expect(result2).toEqual(
      `.btn {
  color: blue;

  &:hover {
    color: red;
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
      '.plitzi__button{align-items:center;justify-content:space-around;row-gap:32px;column-gap:32px;flex-wrap:nowrap;flex-direction:column;padding-right:10px;--fancyVariable:#111;}@media(prefers-color-scheme:light){.plitzi__button{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.plitzi__button{--fancyVariable:#000;}}'
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
      `.plitzi__button {
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
  .plitzi__button {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .plitzi__button {
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
      '.plitzi__button{align-items:center;justify-content:space-around;row-gap:32px;column-gap:32px;flex-wrap:nowrap;flex-direction:column;padding-right:10px;--fancyVariable:#111;.plitzi__button-selectorA{color:red;}}@media(prefers-color-scheme:light){.plitzi__button{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.plitzi__button{--fancyVariable:#000;}}'
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
      `.plitzi__button {
  align-items: center;
  justify-content: space-around;
  row-gap: 32px;
  column-gap: 32px;
  flex-wrap: nowrap;
  flex-direction: column;
  padding-right: 10px;
  --fancyVariable: #111;

  .plitzi__button-selectorA {
    color: red;
  }
}

@media(prefers-color-scheme: light) {
  .plitzi__button {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .plitzi__button {
    --fancyVariable: #000;
  }
}`
    );
  });

  it('functionality when is element + state', () => {
    const styleItem = {
      name: 'button',
      type: 'element',
      componentType: 'button',
      attributes: {
        base: {
          color: 'blue'
        },
        selectorA: {
          color: 'blue'
        }
      },
      stateAttributes: {
        base: { hover: { color: 'red' } },
        selectorA: { hover: { color: 'green' } }
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
    } as StyleItem;

    const result = processSelector(styleItem);
    expect(result).toEqual(
      '.plitzi__button{color:blue;--fancyVariable:#111;&:hover{color:red;}.plitzi__button-selectorA{color:blue;&:hover{color:green;}}}@media(prefers-color-scheme:light){.plitzi__button{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.plitzi__button{--fancyVariable:#000;}}'
    );

    const result2 = processSelector(styleItem, false);
    expect(result2).toEqual(
      `.plitzi__button {
  color: blue;
  --fancyVariable: #111;

  &:hover {
    color: red;
  }

  .plitzi__button-selectorA {
    color: blue;

    &:hover {
      color: green;
    }
  }
}

@media(prefers-color-scheme: light) {
  .plitzi__button {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .plitzi__button {
    --fancyVariable: #000;
  }
}`
    );

    const styleItem2 = {
      name: 'button',
      type: 'element',
      componentType: 'button',
      attributes: {
        base: {
          color: 'blue'
        },
        selectorA: {
          color: 'blue'
        }
      },
      stateAttributes: {
        base: { hover: { color: 'red' }, focus: { 'background-color': 'purple' } },
        selectorA: { hover: { color: 'green' } }
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
    } as StyleItem;

    const result3 = processSelector(styleItem2);
    expect(result3).toEqual(
      '.plitzi__button{color:blue;--fancyVariable:#111;&:hover{color:red;}&:focus{background-color:purple;}.plitzi__button-selectorA{color:blue;&:hover{color:green;}}}@media(prefers-color-scheme:light){.plitzi__button{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.plitzi__button{--fancyVariable:#000;}}'
    );

    const result4 = processSelector(styleItem2, false);
    expect(result4).toEqual(
      `.plitzi__button {
  color: blue;
  --fancyVariable: #111;

  &:hover {
    color: red;
  }

  &:focus {
    background-color: purple;
  }

  .plitzi__button-selectorA {
    color: blue;

    &:hover {
      color: green;
    }
  }
}

@media(prefers-color-scheme: light) {
  .plitzi__button {
    --fancyVariable: #111;
  }
}

@media(prefers-color-scheme: dark) {
  .plitzi__button {
    --fancyVariable: #000;
  }
}`
    );
  });

  describe('processSelector.processSelectors', () => {
    it('functionality', () => {
      const result = processSelectors([
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
