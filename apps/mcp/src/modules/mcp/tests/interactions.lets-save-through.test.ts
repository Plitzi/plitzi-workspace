import { describe, expect, it } from 'vitest';

import { capturing } from './helpers';
import { apply } from '../tools';
import { clickTrigger, interactiveSpace } from './interactionsHelpers';

describe('MCP interactions', () => {
  it('lets the save through once the same patch ALSO corrects the malformation', async () => {
    const space = interactiveSpace();
    space.schema.flat.c1.definition.interactions = {
      ...clickTrigger('delayTime-bad'),
      'delayTime-bad': {
        id: 'delayTime-bad',
        title: 'Notify',
        type: 'globalCallback',
        action: 'addNotification',
        params: { content: 'Hi', autoDismissTimeout: 'soon' },
        preview: {},
        elementId: 'space',
        beforeNode: 'onClick-1',
        afterNode: '',
        flowId: 'onClick-1',
        enabled: true
      }
    };
    const cap = capturing(space);
    const res = await apply(
      {
        operations: [
          {
            type: 'patchInteractionNode',
            pageRef: 'home',
            ref: 'c1',
            nodeId: 'delayTime-bad',
            params: { content: 'Nuevo contenido', autoDismissTimeout: 3000 }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const stored = cap.saved().schema.flat.c1.definition.interactions?.['delayTime-bad'];
    expect(stored?.params.autoDismissTimeout).toBe(3000);
    expect(stored?.params.content).toBe('Nuevo contenido');
  });
});
