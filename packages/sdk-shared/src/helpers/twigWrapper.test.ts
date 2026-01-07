import { expect, describe, test, vi } from 'vitest';

import { processTwig } from './twigWrapper';

vi.mock('plitziSdkFederation/usePlitziServiceContext');

describe('twigWrapper', () => {
  test('processTwig should work successfully', () => {
    let result = processTwig(
      '{"id": "{{list_6464d847fb1604e21afad1eb.item.id}}","label": "{{list_6464d847fb1604e21afad1eb.item.name}}"}',
      {
        list_6464d847fb1604e21afad1eb: {
          item: {
            id: '123',
            name: 'test'
          }
        }
      }
    );

    expect(result).toStrictEqual('{"id": "123","label": "test"}');

    result = processTwig(
      '{"id": "{{list_6464d847fb1604e21afad1eb.item.id}}","label": "{{list_6464d847fb1604e21afad1eb.item.name}}"}',
      {
        list_6464d847fb1604e21afad1eb: {
          item: {
            id: '123',
            name: 'test'
          }
        }
      },
      true
    );

    expect(result).toStrictEqual('{"id": "123","label": "test"}');
  });
});
