// Packages
import React, { useCallback, useEffect } from 'react';
import classNames from 'classnames';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   content: string;
 *   className: string;
 *   internalProps: object;
 * }} props
 * @returns {React.ReactElement}
 */
const BlockHtml = props => {
  const { ref, content = '', className = '', internalProps = emptyObject } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  const insertScript = useCallback(sourceScript => {
    return new Promise((resolve, reject) => {
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
      if (hasSrc === false) {
        resolve(script);
      }
    });
  }, []);

  const execute = useCallback(async container => {
    if (!container) {
      return;
    }

    const scripts = container.querySelectorAll('script');
    const syncTasks = [];
    const asyncTasks = [];
    scripts.forEach(script => {
      const tasks = script.hasAttribute('async') ? asyncTasks : syncTasks;
      tasks.push(() => insertScript(script));
    });

    if (!scripts.length) {
      return;
    }

    // Insert the script tags in parallel.
    for (const task of asyncTasks) {
      task();
    }

    // Insert the script tags sequentially to preserve execution order.
    for (const task of syncTasks) {
      await task();
    }
  }, []);

  useEffect(() => {
    const containerDOM = ref.current;
    if (containerDOM && previewMode && typeof window !== 'undefined' && typeof document !== 'undefined') {
      execute(containerDOM);
    }
  }, [previewMode]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__block-html', className, {
        'block-html--empty': content === '' || !content
      })}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default withElement(BlockHtml);

export { BlockHtml };
