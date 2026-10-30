import Tests from '@pmodules/Tests';

/** The space's own tests, in place of the canvas: an entry of the sidebar, as Server and Settings are. */
const ContainerTests = () => (
  <div className="flex min-h-0 grow basis-0 flex-col bg-white dark:bg-zinc-900">
    <Tests />
  </div>
);

export default ContainerTests;
