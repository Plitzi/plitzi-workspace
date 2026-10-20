import { describe, it, expect } from 'vitest';

import processSelector from './processSelector';

describe('processSelector', () => {
  it('functionality when is element', () => {
    const result = processSelector({
      name: 'button',
      type: 'element',
      componentType: 'button',
      attributes: {
        base: {
          default: {
            'align-items': 'center',
            'justify-content': 'space-around',
            'row-gap': '32px',
            'column-gap': '32px',
            'flex-wrap': 'nowrap',
            'flex-direction': 'column',
            'padding-right': '10px'
          }
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
            default: {
              'align-items': 'center',
              'justify-content': 'space-around',
              'row-gap': '32px',
              'column-gap': '32px',
              'flex-wrap': 'nowrap',
              'flex-direction': 'column',
              'padding-right': '10px'
            }
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
          default: {
            'align-items': 'center',
            'justify-content': 'space-around',
            'row-gap': '32px',
            'column-gap': '32px',
            'flex-wrap': 'nowrap',
            'flex-direction': 'column',
            'padding-right': '10px'
          }
        },
        selectorA: {
          default: {
            color: 'red'
          }
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
            default: {
              'align-items': 'center',
              'justify-content': 'space-around',
              'row-gap': '32px',
              'column-gap': '32px',
              'flex-wrap': 'nowrap',
              'flex-direction': 'column',
              'padding-right': '10px'
            }
          },
          selectorA: {
            default: {
              color: 'red'
            }
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

    const result5 = processSelector({
      name: 'container',
      type: 'element',
      attributes: {
        base: {
          default: {},
          variants: { 'container-md': { default: { 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '0%' } } }
        }
      },
      componentType: 'container',
      cache: '.plitzi__container{}'
    });

    expect(result5).toEqual(
      '.plitzi__container{&[data-variant="container-md"],&.container--container-md{flex-grow:1;flex-shrink:1;flex-basis:0%;}}'
    );

    const result6 = processSelector(
      {
        name: 'container',
        type: 'element',
        attributes: {
          base: {
            default: {},
            variants: { 'container-md': { default: { 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '0%' } } }
          }
        },
        componentType: 'container',
        cache: '.plitzi__container{}'
      },
      false
    );

    expect(result6).toEqual(
      `.plitzi__container {
  &[data-variant="container-md"], &.container--container-md {
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: 0%;
  }
}`
    );
  });
  it('functionality when is element + state', () => {
    const styleItem = {
      name: 'button',
      type: 'element' as const,
      componentType: 'button',
      attributes: {
        base: {
          default: { color: 'blue' },
          states: { hover: { color: 'red' } }
        },
        selectorA: {
          default: { color: 'blue' },
          states: { hover: { color: 'green' } }
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
    };

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
      type: 'element' as const,
      componentType: 'button',
      attributes: {
        base: {
          default: { color: 'blue' },
          states: { hover: { color: 'red' }, focus: { 'background-color': 'purple' } },
          variants: {
            primary: { default: { 'background-color': 'purple' }, states: { hover: { 'background-color': 'blue' } } }
          }
        },
        selectorA: {
          default: { color: 'blue' },
          states: { hover: { color: 'green' } }
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
    };

    const result3 = processSelector(styleItem2);
    expect(result3).toEqual(
      '.plitzi__button{color:blue;--fancyVariable:#111;&:hover{color:red;}&:focus{background-color:purple;}&[data-variant="primary"],&.button--primary{background-color:purple;&:hover{background-color:blue;}}.plitzi__button-selectorA{color:blue;&:hover{color:green;}}}@media(prefers-color-scheme:light){.plitzi__button{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.plitzi__button{--fancyVariable:#000;}}'
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

  &[data-variant="primary"], &.button--primary {
    background-color: purple;

    &:hover {
      background-color: blue;
    }
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
  it('functionality when is element + multiple styleSelector', () => {
    const styleItem = {
      name: 'modalContainer',
      type: 'element' as const,
      attributes: {
        base: {
          default: {}
        },
        headerContainer: {
          default: {
            'border-bottom-color': 'var(--border)',
            'border-bottom-style': 'solid',
            'border-bottom-width': '1px'
          }
        },
        rootContainer: {
          default: {
            'background-color': 'var(--card)',
            height: 'auto'
          }
        }
      },
      componentType: 'modalContainer',
      cache: ''
    };
    const result = processSelector(styleItem);
    expect(result).toEqual(
      '.plitzi__modalContainer{.plitzi__modalContainer-headerContainer{border-bottom-color:var(--border);border-bottom-style:solid;border-bottom-width:1px;}.plitzi__modalContainer-rootContainer{background-color:var(--card);height:auto;}}'
    );

    const result2 = processSelector(styleItem, false);
    expect(result2).toEqual(`.plitzi__modalContainer {
  .plitzi__modalContainer-headerContainer {
    border-bottom-color: var(--border);
    border-bottom-style: solid;
    border-bottom-width: 1px;
  }

  .plitzi__modalContainer-rootContainer {
    background-color: var(--card);
    height: auto;
  }
}`);
  });
});
