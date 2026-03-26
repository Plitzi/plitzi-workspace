/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StyleCategory, StyleState } from '@plitzi/sdk-shared';

const getBasePath = (
  value: any,
  styleSelector: string,
  path?: StyleCategory,
  styleVariant?: string,
  styleState?: StyleState
) => {
  if (styleVariant && (value || path)) {
    return `attributes.${styleSelector}.variants.${styleVariant}.default`;
  }

  if (styleVariant) {
    return `attributes.${styleSelector}.variants`;
  }

  if (styleState && (value || path)) {
    return `attributes.${styleSelector}.states.${styleState}`;
  }

  if (styleState) {
    return `attributes.${styleSelector}.states`;
  }

  return `attributes.${styleSelector}.default`;
};

export default getBasePath;
