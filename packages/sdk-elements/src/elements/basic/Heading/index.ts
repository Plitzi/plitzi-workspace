import BaseHeading from './Heading';

const Heading = Object.assign(BaseHeading, {
  type: 'heading',
  content: {
    attributes: {
      content: 'Heading',
      subType: 'h1'
    },
    definition: {
      label: 'Heading',
      type: 'heading',
      bindings: {},
      styleSelectors: {
        base: ''
      },
      initialState: {
        visibility: true
      }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'basic',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-heading'
    },
    defaultStyle: {
      name: 'Heading',
      displayMode: 'desktop',
      style: {},
      subTypes: {
        h1: {
          name: 'H1 Heading',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '25px',
                'margin-bottom': '25px',
                'font-size': '38px',
                'font-weight': 700,
                'line-height': '44px'
              }
            }
          }
        },
        h2: {
          name: 'H2 Heading',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '25px',
                'margin-bottom': '25px',
                'font-size': '32px',
                'font-weight': 700,
                'line-height': '36px'
              }
            }
          }
        },
        h3: {
          name: 'H3 Heading',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '25px',
                'margin-bottom': '25px',
                'font-size': '24px',
                'font-weight': 700,
                'line-height': '30px'
              }
            }
          }
        },
        h4: {
          name: 'H4 Heading',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '25px',
                'margin-bottom': '25px',
                'font-size': '18px',
                'font-weight': 700,
                'line-height': '24px'
              }
            }
          }
        },
        h5: {
          name: 'H5 Heading',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '25px',
                'margin-bottom': '25px',
                'font-size': '14px',
                'font-weight': 700,
                'line-height': '20px'
              }
            }
          }
        },
        h6: {
          name: 'H6 Heading',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '25px',
                'margin-bottom': '25px',
                'font-size': '12px',
                'font-weight': 700,
                'line-height': '18px'
              }
            }
          }
        }
      }
    },
    settings: {}
  }
});

export default Heading;
