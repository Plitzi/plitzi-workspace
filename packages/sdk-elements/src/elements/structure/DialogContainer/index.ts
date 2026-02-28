import BaseDialogContainer from './DialogContainer';

const DialogContainer = Object.assign(BaseDialogContainer, {
  type: 'dialogContainer',
  content: {
    attributes: {
      headerLabel: 'Dialog Header',
      acceptButtonLabel: 'Accept',
      rejectButtonLabel: 'Cancel',
      autoHideAfterClick: true
    },
    definition: {
      label: 'Dialog Container',
      type: 'dialogContainer',
      description: '',
      items: [],
      bindings: {},
      styleSelectors: {
        base: '',
        backgroundContainer: '',
        rootContainer: '',
        headerContainer: '',
        headerTitle: '',
        headerCloseButton: '',
        bodyContainer: '',
        footerContainer: '',
        acceptButton: '',
        cancelButton: ''
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
      category: 'structure',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-regular fa-clone'
    },
    defaultStyle: {
      name: 'Dialog Container',
      displayMode: 'desktop',
      style: {
        base: {
          position: 'absolute',
          top: '0',
          bottom: '0',
          left: '0',
          right: '0'
        },
        backgroundContainer: {
          height: '100%',
          width: '100%',
          left: '0',
          top: '0',
          position: 'absolute',
          'background-color': 'black',
          opacity: '0.5'
        },
        rootContainer: {
          display: 'flex',
          'flex-direction': 'column',
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '500px',
          height: '300px',
          'background-color': 'white',
          transform: 'translate3d(-50%, -50%, 0px)',
          'padding-top': '20px',
          'padding-bottom': '20px',
          'padding-left': '20px',
          'padding-right': '20px',
          'border-top-left-radius': '8px',
          'border-top-right-radius': '8px',
          'border-bottom-left-radius': '8px',
          'border-bottom-right-radius': '8px'
        },
        headerContainer: {
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between'
        },
        headerTitle: {
          'font-size': '20px',
          'font-weight': '500',
          'line-height': '1.2',
          color: '#333'
        },
        headerCloseButton: {
          height: '20px',
          width: '20px',
          padding: '4px',
          display: 'flex',
          'justify-content': 'center',
          'align-items': 'center',
          cursor: 'pointer'
        },
        bodyContainer: {
          display: 'flex',
          'flex-direction': 'column',
          'flex-grow': '1',
          'flex-basis': '0'
        },
        footerContainer: {
          display: 'flex',
          'justify-content': 'flex-end',
          'margin-top': '8px'
        }
      },
      subTypes: {}
    },
    settings: {}
  },
  initialItems: ['container']
});

export default DialogContainer;
