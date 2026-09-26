import { container, onClick, styles } from '@plitzi/sdk-authoring';

import { FLOAT, divide, iconAction } from './kit.ts';
import { boardAction } from './stylePanel.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * What can be done to the selection, standing beside it: stacking, grouping, duplicating, deleting.
 *
 * Authored here and handed to the canvas as its children — the canvas knows where the selection is on screen and
 * places them there, above it (below near the top edge), and hides them while it is dragged or typed into. Which
 * buttons show is the page's: grouping needs two things, ungrouping a group.
 */

const bar = styles('selectionTools', {
  ...FLOAT,
  display: 'flex',
  'align-items': 'center',
  gap: '2px',
  padding: '4px',
  'white-space': 'nowrap'
});

export const selectionTools = (): ElementSpec =>
  container({
    id: 'selection-tools',
    class: bar,
    children: [
      iconAction({
        id: 'to-front',
        icon: 'fa-solid fa-angles-up',
        title: 'Bring to front — ]',
        flow: [onClick(), boardAction('bringToFront')]
      }),
      iconAction({
        id: 'to-back',
        icon: 'fa-solid fa-angles-down',
        title: 'Send to back — [',
        flow: [onClick(), boardAction('sendToBack')]
      }),
      divide(),
      container({
        id: 'group-tool',
        visible: 'computed.canGroup',
        children: [
          iconAction({
            id: 'group',
            icon: 'fa-regular fa-object-group',
            title: 'Group — ⌘G',
            flow: [onClick(), boardAction('group')]
          })
        ]
      }),
      container({
        id: 'ungroup-tool',
        visible: 'computed.selectionGrouped',
        children: [
          iconAction({
            id: 'ungroup',
            icon: 'fa-regular fa-object-ungroup',
            title: 'Ungroup — ⌘⇧G',
            flow: [onClick(), boardAction('ungroup')]
          })
        ]
      }),
      iconAction({
        id: 'duplicate',
        icon: 'fa-regular fa-clone',
        title: 'Duplicate — ⌘D',
        flow: [onClick(), boardAction('duplicate')]
      }),
      iconAction({
        id: 'delete',
        icon: 'fa-regular fa-trash-can',
        title: 'Delete — ⌫',
        flow: [onClick(), boardAction('deleteSelection')]
      })
    ]
  });
