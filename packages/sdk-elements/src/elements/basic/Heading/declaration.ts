/** Static declaration for Heading: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { HeadingProps } from './Heading';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type HeadingAttributes = AuthorableAttributes<HeadingProps>;

const declaration = elementDeclaration<HeadingAttributes>()({
  type: 'heading',
  attributeValues: {
    subType: valuesOf<NonNullable<HeadingProps['subType']>>()(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
  },
  content: {
    attributes: {
      content: 'Heading',
      subType: 'h1'
    },
    definition: {
      label: 'Heading',
      description: 'A section heading (<h1>–<h6>) for titles and document hierarchy.'
    },
    market: {
      category: 'basic',
      icon: 'fa-solid fa-heading'
    },
    defaultStyle: {
      style: { base: { default: { 'margin-top': '25px', 'margin-bottom': '25px', 'font-weight': 700 } } },
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
                // A ratio landing on the same pixels at this size: a class that resizes the text keeps the proportion.
                'line-height': '1.158'
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
                'line-height': '1.125'
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
                'line-height': '1.25'
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
                'line-height': '1.333'
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
                'line-height': '1.429'
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
                'line-height': '1.5'
              }
            }
          }
        }
      }
    }
  }
});

export default declaration;
