// Packages
import { expect, describe, test } from '@jest/globals';
import get from 'lodash/get';

// Relatives
import FlatMap from './FlatMap';

// Fixtures
import schema1 from '../tests/fixtures/json/schema1.json';
import styleSchema1 from '../tests/fixtures/json/styleSchema1.json';

describe('Testing FlatMap', () => {
  // yarn test FlatMap.test.js -t cloneNested
  test('cloneNested', () => {
    // const { elements, elementsStyle } = FlatMap.flatAsTemplate(
    //   get(schema1, 'flat', {}),
    //   styleSchema1 ?? { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
    //   ''
    // );
    // expect(space).toStrictEqual({});
  });
});
