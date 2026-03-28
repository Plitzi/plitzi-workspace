import { describe, it, expect } from 'vitest';

import processSelector, { processSelectors } from './processSelector';

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
          states: { hover: { color: 'red' }, focus: { 'background-color': 'purple' } }
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

  it('', () => {
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
