/**
 * Static declaration for PlitziSdk: type, default attributes and builder metadata. Data only, no React.
 *
 * Here with every other declaration, so authoring and the builder's catalogue know the element; its component runs a
 * whole space, and lives with the SDK that does (`apps/sdk`).
 */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { Environment, OfflineDataRaw } from '@plitzi/sdk-shared';

/** What this element can be authored with. */
export type PlitziSdkAttributes = {
  /** The space drawn, fetched by its key. */
  spaceKey?: string;
  environment?: Environment;
  /**
   * The space drawn from its documents instead — `schema` and `style` with its compiled `cache`, what `plitzi_render`
   * answers — with no backend behind it: UI generated on the fly, a preview. Usually bound: whole, to an
   * `apiContainer`'s answer or a runtime's route, or `offlineData.schema` and `offlineData.style` from two elements.
   * With it, `spaceKey` is not read.
   */
  offlineData?: OfflineDataRaw;
};

const declaration = elementDeclaration<PlitziSdkAttributes>()({
  type: 'plitziSdk',
  content: {
    attributes: {
      spaceKey: '',
      environment: 'main'
    },
    definition: {
      label: 'Plitzi Sdk',
      description:
        'Another space drawn inside this one, as a widget — its home page, no router of its own: by its key, or from its documents (`offlineData`), bound to UI generated on the fly.'
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
