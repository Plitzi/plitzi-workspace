// Packages
import { useEffect, useState } from 'react';

/**
 * @param {{
 *   url?: string;
 *   type?: 'text/javascript' | 'module';
 * }} props
 * @returns {{
 *   ready: boolean;
 *   failed: boolean;
 * }}
 */
const useDynamicScript = ({ url = '', type = 'text/javascript' } = {}) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let script;
    if (url) {
      script = document.createElement('script');
      script.src = url;
      script.type = type;
      script.async = true;

      setReady(false);
      setFailed(false);

      script.onload = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Dynamic Script Loaded: ${url}`);
        }

        setReady(true);
      };

      script.onerror = () => {
        if (process.env.NODE_ENV === 'development') {
          console.error(`Dynamic Script Error: ${url}`);
        }

        setReady(true);
        setFailed(true);
      };

      try {
        document.head.appendChild(script);
      } catch (e) {
        setReady(true);
        setFailed(true);
      }
    }

    return () => {
      if (url && script) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Dynamic Script Removed: ${url}`);
        }

        document.head.removeChild(script);
      }
    };
  }, [url]);

  return {
    ready,
    failed
  };
};

export default useDynamicScript;
