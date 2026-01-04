/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { produce } from 'immer';
import get from 'lodash-es/get';
import pick from 'lodash-es/pick';
import set from 'lodash-es/set';

import generateStyleSelector from '@plitzi/sdk-style/helpers/generateStyleSelector';
import { generateCache, makeSelector } from '@plitzi/sdk-style/StyleHelper';

import { generateID } from '../../helpers/utils';

import type {
  BuilderContextValue,
  BuilderSchemaContextValue,
  ComponentDefinition,
  Element,
  Schema,
  SchemaVariable,
  Style
} from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

const getImageSize = async (file: File): Promise<{ height: number; width: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Read the contents of Image File.
    reader.readAsDataURL(file);
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const image = new Image();

      // Set the Base64 string return from FileReader as source.
      image.src = e.target?.result as string;

      image.onload = function () {
        const { height, width } = this as HTMLImageElement;
        resolve({ height, width });
      };

      image.onerror = function () {
        reject(new Error('Invalid image'));
      };
    };
  });

const processResource = async (clipboardData: DataTransfer) => {
  const file = get(clipboardData, 'files.0') as File | undefined;
  // const metadata = clipboardData.getData('text/html');
  if (!file) {
    return undefined;
  }

  if (file.type.includes('image')) {
    const size = await getImageSize(file);

    if (!(size instanceof Error) && size.width && size.height && size.width <= 1000 && size.height <= 1000) {
      return { file: new File([file], file.name, { type: file.type }), metadata: { size } };
    }
  }

  return { file: new File([file], file.name, { type: file.type }), metadata: {} };
};

const processPlitziTemplate = (clipboardData: DataTransfer) => {
  const data = clipboardData.getData('application/json');
  if (!data) {
    return undefined;
  }

  let dataParsed:
    | {
        type: string;
        payload: {
          elements: { acum: Record<string, Element>; item: Element };
          style: Style;
          variables: Schema['variables'];
        };
      }
    | undefined;
  try {
    dataParsed = JSON.parse(data) as {
      type: string;
      payload: {
        elements: { acum: Record<string, Element>; item: Element };
        style: Style;
        variables: Schema['variables'];
      };
    };
  } catch {
    return undefined;
  }

  if (dataParsed.type !== 'add##plitzi-template') {
    return undefined;
  }

  return dataParsed;
};

const processText = (clipboardData: DataTransfer) => {
  const text = clipboardData.getData('text/plain');
  if (!text) {
    return undefined;
  }

  return text.split('\n').filter(p => p);
};

export const getClipboardDataProcessed = async (clipboardData?: DataTransfer) => {
  if (!clipboardData) {
    return undefined;
  }

  let data: unknown;
  let dataType: 'text' | 'resource' | 'template' = 'text';
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

  return { dataType, data } as
    | { dataType: 'text'; data: string[] }
    | { dataType: 'resource'; data: { file: File; metadata: { size?: { height: number; width: number } } } }
    | {
        dataType: 'template';
        data: {
          payload: {
            elements: { acum: Record<string, Element>; item: Element };
            style: Style;
            variables: Schema['variables'];
          };
        };
      };
};

export const getElementDefinition = (
  componentDefinitions: Record<string, ComponentDefinition>,
  type: string,
  attributes?: Element['attributes'],
  styleSelectors?: Element['definition']['styleSelectors'],
  parentId: string = ''
) => {
  let elementDefinition = pick(componentDefinitions[type], ['definition', 'attributes']) as
    | { definition: Element['definition']; attributes: Element['attributes'] }
    | undefined;
  if (!elementDefinition) {
    return undefined;
  }

  elementDefinition = produce(elementDefinition, draft => {
    if (attributes) {
      switch (type) {
        case 'image':
          if (attributes.src) {
            set(draft, 'attributes.src', attributes.src);
          }

          break;
        case 'video':
          if (attributes.src) {
            set(draft, 'attributes.src', attributes.src);
          }

          break;

        case 'paragraph': {
          if (attributes.content) {
            set(draft, 'attributes.content', attributes.content);
          }

          break;
        }

        case 'reference': {
          if (attributes.referenceType && attributes.referenceId) {
            set(draft, 'attributes.referenceType', attributes.referenceType);
            set(draft, 'attributes.referenceId', attributes.referenceId);
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

  return {
    id: generateID(),
    ...(JSON.parse(JSON.stringify(elementDefinition)) as {
      definition: Element['definition'];
      attributes: Element['attributes'];
    })
  };
};

type BuilderMetadata = {
  mutate: NetworkContextValue['mutate'];
  builderDropElement: BuilderSchemaContextValue['builderDropElement'];
  elementSelected: string;
  componentDefinitions: Record<string, ComponentDefinition>;
  baseElementId?: string;
  builderHandler: BuilderContextValue['builderHandler'];
};

export const processPaste = async (
  clipboardData?: DataTransfer | null,
  builderMetadata: BuilderMetadata = {} as BuilderMetadata
) => {
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
  let templateData: {
    elements: Record<string, Element>;
    baseElement?: Element;
    style: Style;
    variables: SchemaVariable[];
  } = {
    elements: {},
    baseElement: undefined,
    style: {
      platform: { desktop: {}, tablet: {}, mobile: {} },
      variables: {},
      theme: { default: 'system', schemes: ['light', 'dark'] },
      cache: ''
    },
    variables: []
  };
  if (dataType === 'resource') {
    const {
      file,
      metadata: { size }
    } = data;
    const type = file.type.split('/')[0];
    const selector = size ? makeSelector(type) : '';
    const elementDefinition = getElementDefinition(componentDefinitions, type, {}, { base: selector });
    void mutate('SpaceAddResource', { resource: file, type }, false, false, { customFetch: true }).then(
      (result: unknown) => {
        if (result instanceof Error) {
          return;
        }

        const src = get(result, 'path', '');
        builderHandler('schemaUpdateElement', { ...elementDefinition, attributes: { src } });
      }
    );

    if (size && selector) {
      set(
        templateData,
        `style.platform.desktop.${selector}`,
        generateStyleSelector(selector, 'class', { height: `${size.height}px`, width: `${size.width}px` }, {})
      );
      set(templateData, 'style.cache', generateCache(templateData.style));
    }

    set(templateData, 'baseElement', elementDefinition);
  } else if (dataType === 'template') {
    const {
      payload: { elements, style, variables }
    } = data;
    delete elements.acum[elements.item.id];
    templateData = { elements: elements.acum, baseElement: elements.item, style, variables };
  } else if (Array.isArray(data) && data.length > 1) {
    // dataType is Text
    const elementContainerDefinition = getElementDefinition(componentDefinitions, 'container');
    data.forEach(paragraph => {
      const elementDefinition = getElementDefinition(
        componentDefinitions,
        'paragraph',
        { content: paragraph },
        {},
        elementContainerDefinition?.id
      );
      if (elementDefinition && elementContainerDefinition) {
        templateData.elements[elementDefinition.id] = elementDefinition;
        set(elementContainerDefinition, 'definition.items', [
          ...get(elementContainerDefinition, 'definition.items', []),
          elementDefinition.id
        ]);
      }
    });
    set(templateData, 'baseElement', elementContainerDefinition);
  } else if (Array.isArray(data) && data.length === 1) {
    // dataType is Text
    const elementDefinition = getElementDefinition(componentDefinitions, 'paragraph', { content: data[0] });
    set(templateData, 'baseElement', elementDefinition);
  }

  if (templateData.baseElement) {
    result = builderDropElement('add##plitzi-template', templateData, 'inside', elementSelected, baseElementId);
  }

  return result;
};
