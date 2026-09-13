import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import clsx from 'clsx';

import { useTheme } from '@plitzi/sdk-shared';

import type { ReactNode } from 'react';

export type ThemedRootProps = {
  className?: string;
  /** True when this space is embedded in an application with a theme of its own — see `ThemeProvider`'s `scope`. */
  scoped?: boolean;
  children?: ReactNode;
};

/**
 * The SDK's own root, wearing the theme when the document is not this space's to write on.
 *
 * An embedded space cannot stamp `<html>` — the desktop window's chrome reads that class, and repainting the
 * application around a space is not what toggling the space's theme means. So the class lands here instead, on the
 * element the space actually occupies, which is all its own styles ever needed: `.dark` and `.light` declare
 * `color-scheme` wherever they sit, and Tailwind's `dark:` variant matches any ancestor.
 *
 * `system` writes nothing, here as everywhere else: with no class the space inherits whatever the host document
 * settled on, which for an embedded surface is the right default.
 */
const ThemedRoot = ({ className, scoped = false, children }: ThemedRootProps) => {
  const { theme } = useTheme();

  return <ContainerRoot className={clsx(className, scoped && theme !== 'system' && theme)}>{children}</ContainerRoot>;
};

export default ThemedRoot;
