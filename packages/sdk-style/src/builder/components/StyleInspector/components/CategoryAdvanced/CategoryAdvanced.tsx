import { use } from 'react';

import CategoryAdvancedContext from './CategoryAdvancedContext';

import type { ReactNode } from 'react';

export type CategoryAdvancedProps = {
  children?: ReactNode;
};

const CategoryAdvanced = ({ children }: CategoryAdvancedProps) => {
  const showAdvanced = use(CategoryAdvancedContext);
  if (!showAdvanced) {
    return null;
  }

  return children;
};

export default CategoryAdvanced;
