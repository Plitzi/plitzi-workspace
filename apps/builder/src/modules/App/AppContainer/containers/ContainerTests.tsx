import Tests from '@pmodules/Tests';

export type ContainerTestsProps = { externalStyle?: string };

/** The space's own tests, in place of the canvas — with a canvas of their own: an entry of the sidebar, as Server is. */
const ContainerTests = ({ externalStyle = '' }: ContainerTestsProps) => (
  <div className="flex min-h-0 grow basis-0 flex-col bg-white dark:bg-zinc-900">
    <Tests externalStyle={externalStyle} />
  </div>
);

export default ContainerTests;
