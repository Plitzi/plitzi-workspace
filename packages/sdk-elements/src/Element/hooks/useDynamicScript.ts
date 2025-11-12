import { useEffect, useState } from 'react';

const useDynamicScript = ({
  url = '',
  type = 'text/javascript'
}: { url?: string; type?: 'text/javascript' | 'module' } = {}) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let script: HTMLScriptElement | undefined;
    const existingScript = document.querySelector(`script[src="${url}"]`);
    if (url) {
      if (!existingScript) {
        script = document.createElement('script');
        script.src = url;
        script.type = type;
        script.async = true;
      } else {
        script = existingScript as HTMLScriptElement;
      }

      setReady(false);
      setFailed(false);

      script.addEventListener('load', () => {
        if (process.env.NODE_ENV === 'development' && !existingScript) {
          console.log(`Dynamic Script Loaded: ${url}`);
        }

        setReady(true);
      });

      script.addEventListener('error', () => {
        if (process.env.NODE_ENV === 'development' && !existingScript) {
          console.error(`Dynamic Script Error: ${url}`);
        }

        setReady(true);
        setFailed(true);
      });

      try {
        if (!existingScript) {
          document.head.appendChild(script);
        }
      } catch {
        setReady(true);
        setFailed(true);
      }
    }

    return () => {
      if (url && script && !existingScript) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Dynamic Script Removed: ${url}`);
        }
      }
    };
  }, [type, url]);

  return {
    ready,
    failed
  };
};

export default useDynamicScript;
