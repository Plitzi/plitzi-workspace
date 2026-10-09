/** Static declaration for PlitziSdk: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { PlitziSdkProps } from './PlitziSdk';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type PlitziSdkAttributes = AuthorableAttributes<PlitziSdkProps>;

const declaration = elementDeclaration<PlitziSdkAttributes>()({
  type: 'plitziSdk',
  content: {
    attributes: {
      spaceKey: '',
      environment: 'main'
    },
    definition: {
      label: 'Plitzi Sdk'
    },
    market: {
      category: 'advanced',
      icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      }
    }
  }
});

export default declaration;
