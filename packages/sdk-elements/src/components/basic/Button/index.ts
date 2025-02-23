import BaseButton from './Button';

const Button = Object.assign(BaseButton, {
  type: 'button',
  content: {
    attributes: {
      contentPlacement: 'after',
      content: 'Button',
      subType: 'button',
      disabled: false
    },
    definition: {
      label: 'Button',
      type: 'button',
      items: [],
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
      icon: 'fa-solid fa-stop'
    },
    defaultStyle: {
      name: 'Button',
      displayMode: 'desktop',
      style: {},
      subTypes: {
        button: {
          name: 'Normal Button',
          displayMode: 'desktop',
          style: {
            base: {
              'min-height': '30px',
              'min-width': '30px',
              'padding-top': '6px',
              'padding-left': '12px',
              'padding-right': '12px',
              'padding-bottom': '6px',
              cursor: 'pointer',
              'font-size': '16px',
              'line-height': '24px',
              'border-top-left-radius': '4px',
              'border-top-right-radius': '4px',
              'border-bottom-left-radius': '4px',
              'border-bottom-right-radius': '4px'
            }
          }
        },
        reset: {
          name: 'Reset Button',
          displayMode: 'desktop',
          style: {
            base: {
              'min-height': '30px',
              'min-width': '30px',
              'padding-top': '6px',
              'padding-left': '12px',
              'padding-right': '12px',
              'padding-bottom': '6px',
              cursor: 'pointer',
              'font-size': '16px',
              'line-height': '24px',
              'border-top-left-radius': '4px',
              'border-top-right-radius': '4px',
              'border-bottom-left-radius': '4px',
              'border-bottom-right-radius': '4px'
            }
          }
        },
        submit: {
          name: 'Submit Button',
          displayMode: 'desktop',
          style: {
            base: {
              'min-height': '30px',
              'min-width': '30px',
              'padding-top': '6px',
              'padding-left': '12px',
              'padding-right': '12px',
              'padding-bottom': '6px',
              cursor: 'pointer',
              'font-size': '16px',
              'line-height': '24px',
              'border-top-left-radius': '4px',
              'border-top-right-radius': '4px',
              'border-bottom-left-radius': '4px',
              'border-bottom-right-radius': '4px'
            }
          }
        }
      }
    },
    settings: {}
  }
});

export default Button;
