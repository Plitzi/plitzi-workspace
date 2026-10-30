import { describe, expect, test } from 'vitest';

import { ACCESSIBILITY_CODES } from './accessibility';
import { ANCHOR_CODES } from './anchors';
import { BINDING_CODES } from './bindings';
import { COMPONENT_CODES } from './components';
import { CSS_CODES } from './css';
import { ELEMENT_CODES } from './elements';
import { FLAG_CODES } from './flags';
import { FLOW_CODES } from './flows';
import { AUTHORING_CODES } from './index';
import { PAGE_CODES } from './pages';
import { SELECTOR_CODES } from './selectors';
import { SERVER_CODES } from './server';
import { SPACE_CODES } from './space';
import { SUGGESTION_CODES } from './suggestions';
import { TEST_CODES } from './tests';

const SUBJECTS = {
  SPACE_CODES,
  PAGE_CODES,
  ANCHOR_CODES,
  SELECTOR_CODES,
  CSS_CODES,
  ELEMENT_CODES,
  BINDING_CODES,
  COMPONENT_CODES,
  FLAG_CODES,
  FLOW_CODES,
  SERVER_CODES,
  ACCESSIBILITY_CODES,
  TEST_CODES,
  SUGGESTION_CODES
};

describe('AUTHORING_CODES', () => {
  // Spread together, a code written in two subjects is one row and no compile error: the later silently wins.
  test('holds every subject whole, with no code in two of them', () => {
    const seen = new Map<string, string>();
    const twice = Object.entries(SUBJECTS).flatMap(([subject, codes]) =>
      Object.keys(codes).flatMap(code => {
        const before = seen.get(code);
        seen.set(code, subject);

        return before ? [`${code} (${before}, ${subject})`] : [];
      })
    );

    expect(twice).toEqual([]);
    expect(Object.keys(AUTHORING_CODES)).toHaveLength(seen.size);
  });
});
