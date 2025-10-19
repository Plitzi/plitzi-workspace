import get from 'lodash/get';
import set from 'lodash/set';
import { useCallback, useEffect, useRef, memo } from 'react';

import type { ComponentPlugin } from '@plitzi/sdk-shared';

export type PluginLoaderProps = {
  type?: 'script' | 'link';
  pluginType?: string;
  url?: string;
  entryPoint?: string;
  onLoad?: (component: ComponentPlugin, pluginType: string, type: string) => void;
  onError?: (pluginType: string) => void;
  onUnload?: (pluginType: string) => void;
};

const PluginLoader = ({
  type = 'script',
  pluginType = '',
  url = '',
  entryPoint = '',
  onLoad,
  onError,
  onUnload
}: PluginLoaderProps) => {
  const pluginDOM = useRef<HTMLScriptElement | HTMLLinkElement | null>(null);

  const handleLoad = useCallback(() => {
    const component = get(window, entryPoint) as ComponentPlugin | undefined;
    if (!component) {
      return;
    }

    onLoad?.(component, pluginType, type);
  }, [onLoad, pluginType, type, entryPoint]);

  const handleError = useCallback(() => onError?.(pluginType), [onError, pluginType]);

  const paramsBuilder = useCallback(
    (element: HTMLScriptElement | HTMLLinkElement, url: string) => {
      const params = {
        src: url,
        crossOrigin: 'anonymous',
        onload: handleLoad,
        onerror: handleError
      };

      Object.keys(params).forEach(key => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        element[key] = params[key];
      });
    },
    [handleError, handleLoad]
  );

  const datasetBuilder = (dataset: DOMStringMap, params: Record<string, string | boolean>) => {
    Object.keys(params).forEach(key => {
      dataset[key] = String(params[key]);
    });
  };

  const isPluginLoaded = useCallback(() => !!get(window, entryPoint), [entryPoint]);

  const initPlugin = useCallback(() => {
    pluginDOM.current = document.head.querySelector(`${type}[data-plitzi-plugin-type="${pluginType}"]`);
    if (pluginDOM.current) {
      if (isPluginLoaded()) {
        handleLoad();
      } else {
        pluginDOM.current.addEventListener('load', handleLoad);
        pluginDOM.current.addEventListener('error', handleError);
      }

      return;
    }

    const newPlugin = document.createElement(type);
    paramsBuilder(newPlugin, url);
    datasetBuilder(newPlugin.dataset, {
      plitziPlugin: true,
      plitziPluginType: pluginType,
      plitziPluginEntryPoint: entryPoint
    });

    pluginDOM.current = newPlugin;
    document.head.appendChild(newPlugin);
  }, [type, pluginType, paramsBuilder, url, entryPoint, isPluginLoaded, handleLoad, handleError]);

  useEffect(() => {
    initPlugin();

    return () => {
      if (!pluginDOM.current) {
        return;
      }

      if (!isPluginLoaded()) {
        pluginDOM.current.removeEventListener('load', handleLoad);
        pluginDOM.current.removeEventListener('error', handleError);
      }

      pluginDOM.current.remove();
      onUnload?.(pluginType);
      set(window, entryPoint, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default memo(PluginLoader);
