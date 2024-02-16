// Packages
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';
import pick from 'lodash/pick';

// Monorepo
import { EventBridgeTypes } from '@repo/event-bridge-shared/EventBridgeHelper';
import FlatMap from '@repo/schema-shared/FlatMap';

// Alias
import { DropDirectionConstants } from '@pmodules/Elements/ElementHelper';
import { generateCache, generateStyleSelector, makeSelector } from '@pmodules/Style/StyleHelper';

// Relatives
import { generateID } from '../../helpers/utils';

export const DISPLAY_BORDER_NONE = 'none';
export const DISPLAY_BORDER_WHITE = 'white';
export const DISPLAY_BORDER_BLACK = 'black';

export const DISPLAY_BORDER = [DISPLAY_BORDER_BLACK, DISPLAY_BORDER_WHITE, DISPLAY_BORDER_NONE];

const getImageSize = async file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Read the contents of Image File.
    reader.readAsDataURL(file);
    reader.onload = e => {
      const image = new Image();

      // Set the Base64 string return from FileReader as source.
      image.src = e.target.result;

      image.onload = function () {
        const { height, width } = this;
        resolve({ height, width });
      };

      image.onerror = function () {
        reject(new Error('Invalid image'));
      };
    };
  });

const processResource = async clipboardData => {
  const file = get(clipboardData, 'files.0');
  // const metadata = clipboardData.getData('text/html');
  if (!file) {
    return undefined;
  }

  if (file.type.includes('image')) {
    const size = await getImageSize(file);

    if (!(size instanceof Error) && size?.width && size?.height && size?.width <= 1000 && size?.height <= 1000) {
      return { file: new File([file], file.name, { type: file.type }), metadata: { size } };
    }
  }

  return { file: new File([file], file.name, { type: file.type }), metadata: {} };
};

const processPlitziTemplate = clipboardData => {
  let data = clipboardData.getData('application/json');
  if (!data) {
    return undefined;
  }

  try {
    data = JSON.parse(data);
  } catch (err) {
    return undefined;
  }

  if (data?.type !== 'add##plitzi-template') {
    return undefined;
  }

  return data;
};

const processText = clipboardData => {
  const text = clipboardData.getData('text/plain');
  if (!text) {
    return undefined;
  }

  return text.split('\n').filter(p => p);
};

export const getClipboardDataProcessed = async clipboardData => {
  if (!clipboardData) {
    return undefined;
  }

  let data;
  let dataType = 'text';
  if (clipboardData.types.includes('Files')) {
    dataType = 'resource';
    data = await processResource(clipboardData);
  } else if (clipboardData.types.includes('application/json')) {
    dataType = 'template';
    data = processPlitziTemplate(clipboardData);
  } else {
    dataType = 'text';
    data = processText(clipboardData);
  }

  if (!data) {
    return undefined;
  }

  return { dataType, data };
};

export const getElementDefinition = (
  componentDefinitions,
  type,
  attributes = {},
  styleSelectors = {},
  parentId = ''
) => {
  let elementDefinition = pick(componentDefinitions[type], ['definition', 'attributes']);
  if (!elementDefinition) {
    return undefined;
  }

  elementDefinition = produce(elementDefinition, draft => {
    if (attributes) {
      switch (type) {
        case 'image':
          if (attributes?.src) {
            set(draft, 'attributes.src', attributes?.src);
          }

          break;
        case 'video':
          if (attributes?.src) {
            set(draft, 'attributes.src', attributes?.src);
          }

          break;

        case 'paragraph': {
          if (attributes?.content) {
            set(draft, 'attributes.content', attributes?.content);
          }

          break;
        }

        case 'reference': {
          if (attributes?.referenceType && attributes?.referenceId) {
            set(draft, 'attributes.referenceType', attributes?.referenceType);
            set(draft, 'attributes.referenceId', attributes?.referenceId);
          }

          break;
        }

        default:
      }
    }

    if (styleSelectors && Object.keys(styleSelectors).length > 0) {
      Object.keys(styleSelectors).forEach(mode => {
        set(draft, `definition.styleSelectors.${mode}`, styleSelectors[mode]);
      });
    }

    if (parentId) {
      set(draft, 'attributes.parentId', parentId);
    }
  });

  return { id: generateID(), ...JSON.parse(JSON.stringify(elementDefinition)) };
};

export const processPaste = async (clipboardData, builderMetadata = {}) => {
  const { mutate, builderDropElement, elementSelected, componentDefinitions, baseElementId, builderHandler } =
    builderMetadata;
  if (!clipboardData) {
    return false;
  }

  const details = await getClipboardDataProcessed(clipboardData);
  if (!details) {
    return false;
  }

  const { dataType, data } = details;
  let result = false;
  let templateData = {
    elements: {},
    baseElement: undefined,
    style: { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' }
  };
  if (dataType === 'resource') {
    const {
      file,
      metadata: { size }
    } = data;
    const type = file.type.split('/')[0];
    const selector = `.${makeSelector(type)}`;
    const elementDefinition = getElementDefinition(componentDefinitions, type, {}, { base: selector });
    mutate('SpaceAddResource', { resource: file }, false, false, { customFetch: true }).then(result => {
      if (result instanceof Error) {
        return;
      }

      const src = get(result, 'path', '');
      builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, { ...elementDefinition, attributes: { src } });
    });

    if (size) {
      set(
        templateData,
        `style.platform.desktop.${btoa(selector)}`,
        generateStyleSelector(selector, { height: `${size?.height}px`, width: `${size?.width}px` })
      );
      set(templateData, 'style.cache', generateCache({ platform: get(templateData, 'style.platform') }));
    }

    set(templateData, 'baseElement', elementDefinition);
  } else if (dataType === 'template') {
    const {
      payload: { elements, style }
    } = data;
    const { acum, item } = FlatMap.cloneNested(elements.item.id, elements.acum);
    delete acum[item.id];

    templateData = { elements: acum, baseElement: item, style };
  } else if (dataType === 'text' && Array.isArray(data) && data.length > 1) {
    const elementContainerDefinition = getElementDefinition(componentDefinitions, 'container');
    data.forEach(paragraph => {
      const elementDefinition = getElementDefinition(
        componentDefinitions,
        'paragraph',
        { content: paragraph },
        {},
        elementContainerDefinition.id
      );
      templateData.elements[elementDefinition.id] = elementDefinition;
      set(elementContainerDefinition, 'definition.items', [
        ...get(elementContainerDefinition, 'definition.items', []),
        elementDefinition.id
      ]);
    });
    set(templateData, 'baseElement', elementContainerDefinition);
  } else if (dataType === 'text' && Array.isArray(data) && data.length === 1) {
    const elementDefinition = getElementDefinition(componentDefinitions, 'paragraph', { content: data[0] });
    set(templateData, 'baseElement', elementDefinition);
  }

  if (templateData?.baseElement) {
    result = await builderDropElement(
      'add##plitzi-template',
      templateData,
      DropDirectionConstants.DROP_DIRECTION_INSIDE,
      elementSelected,
      baseElementId
    );
  }

  return result;
};
