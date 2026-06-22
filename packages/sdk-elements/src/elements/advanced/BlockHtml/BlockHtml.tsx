/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useEffect } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type BlockHtmlProps = {
  id: string;
  ref?: RefObject<HTMLElement>;
  className?: string;
  content?: string;
};

const BlockHtml = ({ id, ref, content = '', className = '' }: BlockHtmlProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  const insertScript = useCallback(
    (sourceScript: HTMLScriptElement) =>
      new Promise((resolve, reject) => {
        if (typeof document === 'undefined') {
          reject(new Error('Document is not available'));

          return;
        }

        const script = document.createElement('script');
        const hasSrc = sourceScript.hasAttribute('src');

        // Set all attributes from original script tag.
        for (const { name, value } of sourceScript.attributes) {
          script.setAttribute(name, value);
        }

        if (hasSrc) {
          script.addEventListener('load', () => resolve(script));
          script.addEventListener('error', reject);
        } else {
          script.textContent = sourceScript.innerText;
        }

        sourceScript.replaceWith(script);

        // Run the callback immediately for inline scripts.
        if (!hasSrc) {
          resolve(script);
        }
      }),
    []
  );

  const execute = useCallback(
    async (container?: HTMLElement) => {
      if (!container) {
        return;
      }

      const scripts = container.querySelectorAll('script');
      const syncTasks: (() => Promise<unknown>)[] = [];
      const asyncTasks: (() => Promise<unknown>)[] = [];
      scripts.forEach(script => {
        const tasks = script.hasAttribute('async') ? asyncTasks : syncTasks;
        tasks.push(() => insertScript(script));
      });

      if (!scripts.length) {
        return;
      }

      // Insert the script tags in parallel.
      for (const task of asyncTasks) {
        void task();
      }

      // Insert the script tags sequentially to preserve execution order.
      for (const task of syncTasks) {
        await task();
      }
    },
    [insertScript]
  );

  useEffect(() => {
    const containerDOM = ref?.current;
    if (containerDOM && previewMode && typeof window !== 'undefined' && typeof document !== 'undefined') {
      void execute(containerDOM);
    }
  }, [execute, previewMode, ref]);

  return (
    <RootElement
      id={id}
      ref={ref}
      className={clsx('plitzi-component__block-html', className, {
        'block-html--empty': content === '' || !content
      })}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default withElement(BlockHtml);

export { BlockHtml };
