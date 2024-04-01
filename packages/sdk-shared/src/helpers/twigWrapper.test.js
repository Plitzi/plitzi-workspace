// Packages
import { expect, describe, test, jest } from '@jest/globals';

// Relatives
import { processTwig, processTokens } from './twigWrapper';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('twigWrapper', () => {
  test('processTokens should work successfully', () => {
    let result = processTokens(
      `{
        "id": "{{list-6464d847fb1604e21afad1eb.item.id}}",
        "label": "{{list-6464d847fb1604e21afad1eb.item.name}}"
      }`,
      true
    );

    expect(result).toStrictEqual(
      `{
        "id": "{{attribute(_context, 'list-6464d847fb1604e21afad1eb').item.id}}",
        "label": "{{attribute(_context, 'list-6464d847fb1604e21afad1eb').item.name}}"
      }`
    );

    result = processTokens(
      '{"id": "{{list-6464d847fb1604e21afad1eb.item.id}}","label": "{{list-6464d847fb1604e21afad1eb.item.name}}"}',
      true
    );
    expect(result).toStrictEqual(
      `{"id": "{{attribute(_context, 'list-6464d847fb1604e21afad1eb').item.id}}","label": "{{attribute(_context, 'list-6464d847fb1604e21afad1eb').item.name}}"}`
    );

    result = processTokens(
      '{"id": "{{list-6464d847fb1604e21afad1eb.item.id}}","label": "{{list-6464d847fb1604e21afad1eb.item.name}}"}',
      false
    );
    expect(result).toStrictEqual(
      `{"id": "{{attribute(_context, 'list-6464d847fb1604e21afad1eb').item.id| json_encode }}","label": "{{attribute(_context, 'list-6464d847fb1604e21afad1eb').item.name| json_encode }}"}`
    );
  });

  test('processTwig should work successfully', () => {
    let result = processTwig(
      `{"id": "{{list-6464d847fb1604e21afad1eb.item.id}}","label": "{{list-6464d847fb1604e21afad1eb.item.name}}"}`,
      {
        'list-6464d847fb1604e21afad1eb': {
          item: {
            id: '123',
            name: 'test'
          }
        }
      }
    );

    expect(result).toStrictEqual({ id: '123', label: 'test' });

    result = processTwig(
      `{"id": "{{list-6464d847fb1604e21afad1eb.item.id}}","label": "{{list-6464d847fb1604e21afad1eb.item.name}}"}`,
      {
        'list-6464d847fb1604e21afad1eb': {
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
