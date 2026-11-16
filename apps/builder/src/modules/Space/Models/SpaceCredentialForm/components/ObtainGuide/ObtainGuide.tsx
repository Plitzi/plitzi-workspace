import { CREDENTIAL_KINDS } from '@plitzi/sdk-shared/credentials';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';

export type ObtainGuideProps = {
  provider: SpaceCredentialProvider;
};

/** Where the provider issues one and with what permissions — open beside the fields, so nobody has to go looking. */
const ObtainGuide = ({ provider }: ObtainGuideProps) => {
  const { label, obtain } = CREDENTIAL_KINDS[provider];
  if (!obtain) {
    return null;
  }

  return (
    <details open className="border-ui-line group rounded-lg border">
      <summary className="text-ui-fg hover:bg-ui-hover flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium select-none">
        <i className="fa-solid fa-circle-question text-ui-fg-subtle" aria-hidden />
        Where to get it
        <i
          className="fa-solid fa-chevron-down text-ui-fg-subtle ml-auto text-[10px] transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-3 px-3 pt-1 pb-3">
        <ol className="text-ui-fg-subtle flex list-decimal flex-col gap-1.5 pl-4 text-xs leading-relaxed">
          {obtain.steps.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {obtain.url && (
          <a
            href={obtain.url}
            target="_blank"
            rel="noreferrer noopener"
            className="border-ui-line bg-ui-panel text-ui-fg hover:bg-ui-hover inline-flex items-center gap-1.5 self-start rounded-md border px-2.5 py-1 text-xs font-medium"
          >
            Open {label}
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden />
          </a>
        )}
      </div>
    </details>
  );
};

export default ObtainGuide;
