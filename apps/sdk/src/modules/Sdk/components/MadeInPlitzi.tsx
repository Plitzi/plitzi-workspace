export type MadeInPlitziProps = {
  pageId?: string;
};

const MadeInPlitzi = ({ pageId = '' }: MadeInPlitziProps) => {
  return (
    <a
      className="made-in-plitzi"
      href="https://plitzi.com"
      data-page-id={pageId}
      rel="noreferrer noopener"
      target="_blank"
    >
      Made in Plitzi
    </a>
  );
};

export default MadeInPlitzi;
