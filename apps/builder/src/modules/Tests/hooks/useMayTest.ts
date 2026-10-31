import { useSpaceAccess } from '@pmodules/Space/hooks/useSpaceEntitlements';

/**
 * Whether the person writes the space's tests here — `spaceTests`: a tester, and every role that edits — and, when not,
 * the calm line that says so. Reading and playing them in the builder is everyone's; writing them, and playing them on
 * the server (which counts against the plan), is not.
 */
const useMayTest = (): { mayTest: boolean; why?: string } => {
  const { access, may } = useSpaceAccess();
  if (may('spaceTests')) {
    return { mayTest: true };
  }

  return {
    mayTest: false,
    why: `Your role here${access ? ` (${access.label})` : ''} reads the tests and plays them in the builder; writing them, or playing them on the server, takes Can test or above — ask an administrator of the space.`
  };
};

export default useMayTest;
