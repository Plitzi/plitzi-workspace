import { describe, it, expect } from 'vitest';

import processSelector, { processSelectors } from './processSelector';

import type { StyleBlock } from '@plitzi/sdk-shared';

describe('processSelector', () => {
  it('functionality', () => {
    const result = processSelector({
      name: 'page-1',
      type: 'class',
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
      '.page-1{align-items:center;justify-content:space-around;row-gap:32px;column-gap:32px;flex-wrap:nowrap;flex-direction:column;padding-right:10px;--fancyVariable:#111;}@media(prefers-color-scheme:light){.page-1{--fancyVariable:#111;}}@media(prefers-color-scheme:dark){.page-1{--fancyVariable:#000;}}'
    );

    const result2 = processSelector(
      {
        name: 'page-1',
        type: 'class',
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
        base: {
          default: {
            color: 'blue'
          },
          states: {
            hover: {
              color: 'red'
            }
          }
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
          base: {
            default: {
              color: 'blue'
            },
            states: {
              hover: {
                color: 'red'
              }
            }
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

  it('functionality + state + variants', () => {
    const result = processSelector({
      name: 'btn',
      type: 'class',
      attributes: {
        base: {
          default: {
            color: 'blue'
          },
          states: {
            hover: {
              color: 'red'
            }
          },
          variants: {
            primary: { default: { 'background-color': 'purple' }, states: { hover: { 'background-color': 'blue' } } }
          }
        },
        selectorA: {
          default: {
            color: 'red'
          },
          states: {
            hover: {
              color: 'orange'
            }
          },
          variants: {
            secondary: { default: { 'background-color': 'pink' }, states: { hover: { 'background-color': 'blue' } } }
          }
        }
      },
      cache: ''
    });

    expect(result).toEqual(
      '.btn{color:blue;&:hover{color:red;}&[data-variant="primary"],&.btn--primary{background-color:purple;&:hover{background-color:blue;}}.btn-selectorA{color:red;&:hover{color:orange;}&[data-variant="secondary"],&.btn-selectorA--secondary{background-color:pink;&:hover{background-color:blue;}}}}'
    );

    const result2 = processSelector(
      {
        name: 'btn',
        type: 'class',
        attributes: {
          base: {
            default: {
              color: 'blue'
            },
            states: {
              hover: {
                color: 'red'
              }
            },
            variants: {
              primary: { default: { 'background-color': 'purple' }, states: { hover: { 'background-color': 'blue' } } }
            }
          },
          selectorA: {
            default: {
              color: 'red'
            },
            states: {
              hover: {
                color: 'orange'
              }
            },
            variants: {
              secondary: { default: { 'background-color': 'pink' }, states: { hover: { 'background-color': 'blue' } } }
            }
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

  &[data-variant="primary"], &.btn--primary {
    background-color: purple;

    &:hover {
      background-color: blue;
    }
  }

  .btn-selectorA {
    color: red;

    &:hover {
      color: orange;
    }

    &[data-variant="secondary"], &.btn-selectorA--secondary {
      background-color: pink;

      &:hover {
        background-color: blue;
      }
    }
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

  describe('processSelector.processSelectors', () => {
    it('functionality', () => {
      const result = processSelectors([
        {
          name: 'page-1',
          type: 'class',
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
        {
          name: 'page-2',
          type: 'class',
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

describe('processSelector / the order states are written in', () => {
  const cacheOf = (states: NonNullable<StyleBlock['states']>): string =>
    processSelector({
      name: 'btn',
      type: 'class',
      attributes: { base: { default: { color: 'black' }, states } },
      cache: ''
    });

  it('writes them in the order they win in, not the order they were added in', () => {
    const cache = cacheOf({
      disabled: { color: 'gray' },
      active: { color: 'red' },
      hover: { color: 'blue' },
      'focus-visible': { color: 'green' },
      visited: { color: 'purple' }
    });

    expect(cache).toBe(
      '.btn{color:black;&:visited{color:purple;}&:hover{color:blue;}&:focus-visible{color:green;}&:active{color:red;}&:disabled{color:gray;}}'
    );
  });

  it('puts a press after a hover, so pressing a hovered button shows the press', () => {
    const cache = cacheOf({ active: { color: 'red' }, hover: { color: 'blue' } });

    expect(cache.indexOf('&:hover')).toBeLessThan(cache.indexOf('&:active'));
  });

  it('orders the states of a variant the same way', () => {
    const cache = processSelector({
      name: 'btn',
      type: 'class',
      attributes: {
        base: {
          default: {},
          variants: { primary: { default: {}, states: { active: { color: 'red' }, hover: { color: 'blue' } } } }
        }
      },
      cache: ''
    });

    expect(cache.indexOf('&:hover')).toBeLessThan(cache.indexOf('&:active'));
  });
});

describe('processSelector / ancestor conditions', () => {
  const cacheOf = (block: StyleBlock, name = 'icon'): string =>
    processSelector({ name, type: 'class', attributes: { base: block }, cache: '' });

  it('writes an ancestor state as a nested rule that weighs what the class alone does', () => {
    const cache = cacheOf({
      default: { transform: 'none' },
      ancestors: { card: { states: { hover: { transform: 'translateX(3px)' } } } }
    });

    expect(cache).toBe('.icon{transform:none;:where(.card:hover) &{transform:translateX(3px);}}');
  });

  it('matches an ancestor variant by attribute and by modifier class, like the variant itself', () => {
    const cache = cacheOf({
      default: {},
      ancestors: {
        sidebar: {
          variants: { collapsed: { default: { display: 'none' }, states: { hover: { display: 'block' } } } }
        }
      }
    });

    expect(cache).toBe(
      '.icon{:where(.sidebar[data-variant="collapsed"],.sidebar--collapsed) &{display:none;}' +
        ':where(.sidebar[data-variant="collapsed"]:hover,.sidebar--collapsed:hover) &{display:block;}}'
    );
  });

  it('writes them after the class own states and variants, and the ancestor states in cascade order', () => {
    const cache = cacheOf({
      default: { color: 'black' },
      states: { hover: { color: 'blue' } },
      variants: { muted: { default: { color: 'gray' } } },
      ancestors: { card: { states: { active: { color: 'red' }, hover: { color: 'green' } } } }
    });

    expect(cache.indexOf('&:hover')).toBeLessThan(cache.indexOf(':where(.card:hover)'));
    expect(cache.indexOf('.icon--muted')).toBeLessThan(cache.indexOf(':where(.card:hover)'));
    expect(cache.indexOf(':where(.card:hover)')).toBeLessThan(cache.indexOf(':where(.card:active)'));
  });

  it('works on an element type and on its slots', () => {
    const cache = processSelector({
      name: 'text',
      type: 'element',
      componentType: 'text',
      attributes: {
        base: { default: {} },
        label: { default: {}, ancestors: { card: { states: { hover: { color: 'red' } } } } }
      },
      cache: ''
    });

    expect(cache).toBe('.plitzi__text{.plitzi__text-label{:where(.card:hover) &{color:red;}}}');
  });

  it('writes the rules that hold inside an ancestor at all times before its states', () => {
    const cache = cacheOf({
      default: {},
      ancestors: { toolbar: { default: { 'font-size': '12px' }, states: { hover: { 'font-size': '14px' } } } }
    });

    expect(cache).toBe('.icon{:where(.toolbar) &{font-size:12px;}:where(.toolbar:hover) &{font-size:14px;}}');
  });

  it('leaves out an ancestor with nothing under it', () => {
    expect(cacheOf({ default: { color: 'black' }, ancestors: { card: { states: { hover: {} } } } })).toBe(
      '.icon{color:black;}'
    );
  });
});
