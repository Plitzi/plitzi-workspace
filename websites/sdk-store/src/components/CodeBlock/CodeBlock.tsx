import { Highlight, themes } from 'prism-react-renderer';
import { useCallback, useState } from 'react';

import StackblitzPlayground from '../StackblitzPlayground';

export type CodeBlockProps = {
  code: string;
  language?: string;
  demoId?: string;
};

const CodeBlock = ({ code, language = 'tsx', demoId }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  }, [code]);

  return (
    <div>
      <div className="group relative overflow-hidden rounded-xl border border-ink-600 bg-ink-900/80">
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-ink-600 bg-ink-800/80 px-2.5 py-1 text-xs font-medium text-zinc-400 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-white"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} overflow-x-auto p-4 text-[13px] leading-relaxed`}
              style={{ ...style, background: 'transparent' }}
            >
              {tokens.map((line, lineIndex) => (
                <div key={lineIndex} {...getLineProps({ line })}>
                  {line.map((token, tokenIndex) => (
                    <span key={tokenIndex} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>

      {demoId && <StackblitzPlayground demoId={demoId} demoCode={code} />}
    </div>
  );
};

export default CodeBlock;
