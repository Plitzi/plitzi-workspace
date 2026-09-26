import { container, onClick, styles, variantFrom } from '@plitzi/sdk-authoring';

import { dutyButton } from './duty.ts';
import { FLOAT, divide, iconAction, iconButton } from './kit.ts';
import { boardAction } from './stylePanel.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * What can be done to the selection, standing beside it: stacking, a frame's column and presenting, tidying, grouping,
 * duplicating, locking, deleting.
 *
 * Authored here and handed to the canvas as its children — the canvas knows where the selection is on screen and
 * places them there, above it (below near the top edge), and hides them while it is dragged or typed into. Which
 * buttons show is the page's: grouping needs two things, ungrouping a group.
 */

/** A run of the tools that shows or hides as one, laid out as if it were not there. */
const group = styles('selectionToolsGroup', { display: 'contents' });

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
      // What would change the selection, hidden while all of it is locked — letting it go is all there is to do then.
      container({
        class: group,
        visible: '!computed.selectionIsLocked',
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
          // A frame: made a column, which stacks what is dropped in it — a kanban lane — or presented from.
          container({
            id: 'frame-tools',
            visible: 'computed.selectionIsFrame',
            class: styles('frameTools', { display: 'flex', 'align-items': 'center', gap: '2px' }),
            children: [
              iconAction({
                id: 'column',
                icon: 'fa-solid fa-table-columns',
                title: 'Column — stack what is put in it, like a kanban lane',
                bind: [
                  variantFrom(iconButton, 'computed.selectionIsColumn', { template: "{{ source ? 'active' : '' }}" })
                ],
                flow: [onClick(), boardAction('toggleColumn')]
              }),
              // A column: another beside it, for the next stage of the board — and whether it is the one that completes.
              container({
                visible: 'computed.selectionIsColumn',
                class: styles('columnTools', { display: 'contents' }),
                children: [
                  iconAction({
                    id: 'add-column',
                    icon: 'fa-solid fa-plus',
                    title: 'Add a column beside it',
                    flow: [onClick(), boardAction('addColumn')]
                  }),
                  // The team's Done: a card moved into it is ticked off, and moved out of it, open again.
                  iconAction({
                    id: 'column-completes',
                    icon: 'fa-solid fa-flag-checkered',
                    title: 'Done column — a card moved here is ticked off',
                    bind: [
                      variantFrom(iconButton, 'computed.selectionCompletes', {
                        template: "{{ source ? 'active' : '' }}"
                      })
                    ],
                    flow: [onClick(), boardAction('toggleCompletes')]
                  })
                ]
              }),
              dutyButton(),
              iconAction({
                id: 'branch-frame',
                icon: 'fa-solid fa-code-branch',
                title: 'Branch — a copy beside it, to try another way',
                flow: [onClick(), boardAction('branchFrame')]
              }),
              // A branch: taken back into its original's place — the way it tried is the way now.
              container({
                visible: 'computed.selectionIsBranch',
                children: [
                  iconAction({
                    id: 'merge-branch',
                    icon: 'fa-solid fa-code-merge',
                    title: 'Use this branch — it replaces what the original holds',
                    flow: [onClick(), boardAction('mergeBranch')]
                  })
                ]
              }),
              iconAction({
                id: 'present-frame',
                icon: 'fa-solid fa-play',
                title: 'Present from this frame — everyone follows',
                flow: [onClick(), boardAction('present')]
              }),
              divide()
            ]
          }),
          // A card ticked done, a comment resolved — the same button, named for what it is.
          container({
            id: 'done-tool',
            visible: 'computed.selectionIsTask',
            children: [
              iconAction({
                id: 'done',
                icon: 'fa-solid fa-check',
                title: 'Done · resolved — or not',
                bind: [
                  variantFrom(iconButton, 'computed.selectionIsDone', { template: "{{ source ? 'active' : '' }}" })
                ],
                flow: [onClick(), boardAction('toggleDone')]
              })
            ]
          }),
          container({
            id: 'tidy-tool',
            visible: 'computed.canTidy',
            children: [
              iconAction({
                id: 'tidy',
                icon: 'fa-solid fa-table-cells-large',
                title: 'Tidy up — a neat grid',
                flow: [onClick(), boardAction('tidy')]
              })
            ]
          }),
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
          })
        ]
      }),
      // A vote for what is selected — shown on it as a badge everyone sees, and toggled by clicking the badge too.
      iconAction({
        id: 'vote',
        icon: 'fa-regular fa-thumbs-up',
        title: 'Vote — ⇧V',
        flow: [onClick(), boardAction('vote')]
      }),
      iconAction({
        id: 'duplicate',
        icon: 'fa-regular fa-clone',
        title: 'Duplicate — ⌘D',
        flow: [onClick(), boardAction('duplicate')]
      }),
      // Locked, the selection stays as it is — moved, resized, restyled or deleted by nobody — until it is let go here.
      iconAction({
        id: 'lock',
        icon: 'fa-solid fa-lock',
        title: 'Lock in place, or unlock — ⌘⇧L',
        bind: [variantFrom(iconButton, 'computed.selectionIsLocked', { template: "{{ source ? 'active' : '' }}" })],
        flow: [onClick(), boardAction('toggleLock')]
      }),
      container({
        class: group,
        visible: '!computed.selectionIsLocked',
        children: [
          iconAction({
            id: 'delete',
            icon: 'fa-regular fa-trash-can',
            title: 'Delete — ⌫',
            flow: [onClick(), boardAction('deleteSelection')]
          })
        ]
      })
    ]
  });
